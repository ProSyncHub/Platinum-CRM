"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import {
  canAccessMember,
  isElevatedViewer,
  memberScopeFor,
  normalizeDepartment,
} from "@/lib/authorization";
import type {
  FollowUpPriority,
  FollowUpStatus,
} from "@/lib/followups";
import {
  isMemberFollowUpEligible,
  type FollowUpPreference,
} from "@/lib/followupEligibility";

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;
const OPEN_STATUSES = ["pending", "in_progress"];
const VALID_PRIORITIES = new Set<FollowUpPriority>([
  "low",
  "medium",
  "high",
  "urgent",
]);
const VALID_STATUSES = new Set<FollowUpStatus>([
  "pending",
  "in_progress",
  "completed",
  "cancelled",
]);
const VALID_PREFERENCES = new Set<FollowUpPreference>([
  "auto",
  "always",
  "never",
]);

function isSuperAdmin(user: { role?: string | null }) {
  const role = user.role?.trim().toLowerCase();
  return role === "admin" || role === "superadmin";
}

function revalidateFollowUpViews(memberId?: string) {
  revalidatePath("/followups");
  revalidatePath("/dashboard");
  revalidatePath("/members");
  if (memberId) revalidatePath(`/members/${memberId}`);
}

export async function getFollowUpWorkspace() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return {
      success: false as const,
      error: "Unauthorized",
      tasks: [],
      assignableStaff: [],
      currentUser: null,
    };
  }

  const viewer = session.user;
  const elevated = isElevatedViewer(viewer);
  const department = normalizeDepartment(viewer.department);
  const viewerId = viewer.id || "";

  const [tasks, assignableStaff] = await Promise.all([
    prisma.followUpTask.findMany({
      where: elevated
        ? {}
        : {
            AND: [
              { member: { is: memberScopeFor(viewer) } },
              {
                OR: [
                  { assignedToUser: viewerId },
                  {
                    assignedToDepartment: {
                      equals: department,
                      mode: "insensitive",
                    },
                  },
                  { createdByUser: viewerId },
                ],
              },
            ],
          },
      select: {
        id: true,
        memberId: true,
        title: true,
        instructions: true,
        priority: true,
        status: true,
        dueAt: true,
        sourceType: true,
        assignmentType: true,
        sourceCallLogId: true,
        sourceTransferId: true,
        assignedToUser: true,
        assignedToName: true,
        assignedToEmail: true,
        assignedToDepartment: true,
        createdByUser: true,
        createdByName: true,
        createdByEmail: true,
        createdByDepartment: true,
        completedAt: true,
        completedByUser: true,
        completedByName: true,
        completionNotes: true,
        createdAt: true,
        updatedAt: true,
        member: {
          select: {
            id: true,
            fullName: true,
            memberCode: true,
            phone: true,
            programType: true,
            department: true,
          },
        },
      },
      orderBy: [{ status: "desc" }, { dueAt: "asc" }],
      take: 1000,
    }),
    prisma.user.findMany({
      where: {
        active: true,
        ...(elevated
          ? {}
          : {
              department: {
                equals: department,
                mode: "insensitive" as const,
              },
            }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
      },
      orderBy: [{ department: "asc" }, { name: "asc" }],
    }),
  ]);

  return {
    success: true as const,
    tasks: tasks.map((task) => ({
      ...task,
      sourceType: task.sourceType || "manual",
      assignmentType:
        task.assignmentType ||
        (task.assignedToUser === task.createdByUser ? "self" : "transferred"),
      dueAt: task.dueAt.toISOString(),
      completedAt: task.completedAt?.toISOString() || null,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    })),
    assignableStaff,
    currentUser: {
      id: viewerId,
      name: viewer.name || "Staff Member",
      email: viewer.email || "",
      role: viewer.role || "employee",
      department: viewer.department || "operations",
      elevated,
      superAdmin: isSuperAdmin(viewer),
    },
    generatedAt: new Date().toISOString(),
  };
}

export async function createFollowUpTask(input: {
  memberId: string;
  assignedToUser: string;
  dueAt: string;
  priority: FollowUpPriority;
  title?: string;
  instructions?: string;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const memberId = input.memberId?.trim();
  const assignedToUser = input.assignedToUser?.trim();
  if (
    !OBJECT_ID_PATTERN.test(memberId) ||
    !OBJECT_ID_PATTERN.test(assignedToUser)
  ) {
    return { success: false, error: "Invalid member or assignee." };
  }

  if (!VALID_PRIORITIES.has(input.priority)) {
    return { success: false, error: "Invalid follow-up priority." };
  }

  const dueAt = new Date(input.dueAt);
  if (Number.isNaN(dueAt.getTime())) {
    return { success: false, error: "Please choose a valid due date." };
  }
  if (dueAt.getTime() < Date.now() - 5 * 60_000) {
    return { success: false, error: "The follow-up cannot be due in the past." };
  }

  if (!(await canAccessMember(session.user, memberId))) {
    return { success: false, error: "You do not have access to this member." };
  }

  const [member, assignee] = await Promise.all([
    prisma.member.findUnique({
      where: { id: memberId },
      select: {
        id: true,
        fullName: true,
        nextConnectDate: true,
        activeStatus: true,
        endDate: true,
        followUpPreference: true,
      },
    }),
    prisma.user.findFirst({
      where: { id: assignedToUser, active: true },
      select: { id: true, name: true, email: true, department: true },
    }),
  ]);

  if (!member) return { success: false, error: "Member not found." };
  if (!assignee) return { success: false, error: "Active assignee not found." };
  if (!isMemberFollowUpEligible(member)) {
    return {
      success: false,
      error: "This member is not currently eligible for follow-ups. A Super Admin can override the eligibility setting.",
    };
  }

  if (
    !isElevatedViewer(session.user) &&
    normalizeDepartment(assignee.department) !==
      normalizeDepartment(session.user.department)
  ) {
    return {
      success: false,
      error: "Employees can assign follow-ups only within their department.",
    };
  }

  const existingTask = await prisma.followUpTask.findFirst({
    where: {
      memberId,
      assignedToUser,
      status: { in: OPEN_STATUSES },
    },
    select: { id: true },
  });
  if (existingTask) {
    return {
      success: false,
      error: `${assignee.name} already has an open follow-up for this member.`,
    };
  }

  const title = input.title?.trim().slice(0, 160) || `Follow up with ${member.fullName}`;
  const instructions = input.instructions?.trim().slice(0, 2000) || null;
  const creatorDepartment = session.user.department || "operations";

  const taskData: Prisma.FollowUpTaskUncheckedCreateInput = {
    memberId,
    title,
    instructions,
    priority: input.priority,
    dueAt,
    sourceType: "manual",
    assignmentType:
      assignee.id === session.user.id ? "self" : "transferred",
    assignedToUser: assignee.id,
    assignedToName: assignee.name,
    assignedToEmail: assignee.email,
    assignedToDepartment: assignee.department,
    createdByUser: session.user.id || assignee.id,
    createdByName: session.user.name || "Staff Member",
    createdByEmail: session.user.email || "",
    createdByDepartment: creatorDepartment,
  };

  let task: { id: string };
  if (!member.nextConnectDate || dueAt < member.nextConnectDate) {
    [task] = await prisma.$transaction([
      prisma.followUpTask.create({
        data: taskData,
        select: { id: true },
      }),
      prisma.member.update({
        where: { id: memberId },
        data: { nextConnectDate: dueAt },
        select: { id: true },
      }),
    ]);
  } else {
    task = await prisma.followUpTask.create({
      data: taskData,
      select: { id: true },
    });
  }
  revalidateFollowUpViews(memberId);

  return { success: true, taskId: task.id };
}

export async function updateFollowUpTaskStatus(
  taskId: string,
  status: FollowUpStatus,
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!OBJECT_ID_PATTERN.test(taskId) || !VALID_STATUSES.has(status)) {
    return { success: false, error: "Invalid follow-up update." };
  }

  const task = await prisma.followUpTask.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      memberId: true,
      assignedToUser: true,
      createdByUser: true,
      status: true,
    },
  });
  if (!task) return { success: false, error: "Follow-up task not found." };

  if (!(await canAccessMember(session.user, task.memberId))) {
    return { success: false, error: "You do not have access to this follow-up." };
  }

  const canManage =
    isElevatedViewer(session.user) ||
    task.assignedToUser === session.user.id ||
    task.createdByUser === session.user.id;
  if (!canManage) {
    return { success: false, error: "Only the assignee, creator, or a manager can update this task." };
  }

  if (["completed", "cancelled"].includes(task.status)) {
    return { success: false, error: "This follow-up is already closed." };
  }

  await prisma.followUpTask.update({
    where: { id: task.id },
    data: {
      status,
      ...(status === "completed"
        ? {
            completedAt: new Date(),
            completedByUser: session.user.id || null,
            completedByName: session.user.name || "Staff Member",
          }
        : {}),
    },
  });

  revalidateFollowUpViews(task.memberId);
  return { success: true };
}

export async function updateFollowUpTask(input: {
  taskId: string;
  assignedToUser: string;
  dueAt: string;
  priority: FollowUpPriority;
  title?: string;
  instructions?: string;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (
    !OBJECT_ID_PATTERN.test(input.taskId) ||
    !OBJECT_ID_PATTERN.test(input.assignedToUser) ||
    !VALID_PRIORITIES.has(input.priority)
  ) {
    return { success: false, error: "Invalid follow-up update." };
  }

  const dueAt = new Date(input.dueAt);
  if (Number.isNaN(dueAt.getTime()) || dueAt.getTime() < Date.now() - 5 * 60_000) {
    return { success: false, error: "Please choose a valid future due date." };
  }

  const task = await prisma.followUpTask.findUnique({
    where: { id: input.taskId },
    select: {
      id: true,
      memberId: true,
      createdByUser: true,
      status: true,
      member: {
        select: {
          fullName: true,
          activeStatus: true,
          endDate: true,
          followUpPreference: true,
        },
      },
    },
  });
  if (!task) return { success: false, error: "Follow-up task not found." };
  if (["completed", "cancelled"].includes(task.status)) {
    return { success: false, error: "Closed follow-ups cannot be reassigned." };
  }
  if (!(await canAccessMember(session.user, task.memberId))) {
    return { success: false, error: "You do not have access to this follow-up." };
  }

  const canEdit =
    isElevatedViewer(session.user) || task.createdByUser === session.user.id;
  if (!canEdit) {
    return { success: false, error: "Only the creator or a manager can edit this assignment." };
  }
  if (!isMemberFollowUpEligible(task.member)) {
    return { success: false, error: "This member is not currently eligible for follow-ups." };
  }

  const assignee = await prisma.user.findFirst({
    where: { id: input.assignedToUser, active: true },
    select: { id: true, name: true, email: true, department: true },
  });
  if (!assignee) return { success: false, error: "Active assignee not found." };
  if (
    !isElevatedViewer(session.user) &&
    normalizeDepartment(assignee.department) !==
      normalizeDepartment(session.user.department)
  ) {
    return { success: false, error: "You can reassign only within your department." };
  }

  const duplicate = await prisma.followUpTask.findFirst({
    where: {
      id: { not: task.id },
      memberId: task.memberId,
      assignedToUser: assignee.id,
      status: { in: OPEN_STATUSES },
    },
    select: { id: true },
  });
  if (duplicate) {
    return { success: false, error: `${assignee.name} already has an open follow-up for this member.` };
  }

  await prisma.followUpTask.update({
    where: { id: task.id },
    data: {
      assignedToUser: assignee.id,
      assignedToName: assignee.name,
      assignedToEmail: assignee.email,
      assignedToDepartment: assignee.department,
      assignmentType:
        assignee.id === session.user.id ? "self" : "transferred",
      dueAt,
      priority: input.priority,
      title: input.title?.trim().slice(0, 160) || `Follow up with ${task.member.fullName}`,
      instructions: input.instructions?.trim().slice(0, 2000) || null,
    },
  });

  const nextOpenTask = await prisma.followUpTask.findFirst({
    where: { memberId: task.memberId, status: { in: OPEN_STATUSES } },
    orderBy: { dueAt: "asc" },
    select: { dueAt: true },
  });
  if (nextOpenTask) {
    await prisma.member.update({
      where: { id: task.memberId },
      data: { nextConnectDate: nextOpenTask.dueAt },
    });
  }

  revalidateFollowUpViews(task.memberId);
  return { success: true };
}

export async function setMemberFollowUpPreference(input: {
  memberId: string;
  preference: FollowUpPreference;
  reason?: string;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isSuperAdmin(session.user)) {
    return { success: false, error: "Super Admin access is required." };
  }

  if (
    !OBJECT_ID_PATTERN.test(input.memberId) ||
    !VALID_PREFERENCES.has(input.preference)
  ) {
    return { success: false, error: "Invalid follow-up eligibility update." };
  }

  const member = await prisma.member.findUnique({
    where: { id: input.memberId },
    select: { id: true },
  });
  if (!member) return { success: false, error: "Member not found." };

  await prisma.$transaction([
    prisma.member.update({
      where: { id: member.id },
      data: {
        followUpPreference: input.preference,
        followUpPreferenceReason: input.reason?.trim().slice(0, 500) || null,
        followUpPreferenceUpdatedAt: new Date(),
        followUpPreferenceUpdatedBy: session.user.name || "Super Admin",
      },
      select: { id: true },
    }),
    ...(input.preference === "never"
      ? [
          prisma.followUpTask.updateMany({
            where: {
              memberId: member.id,
              status: { in: OPEN_STATUSES },
            },
            data: { status: "cancelled" },
          }),
        ]
      : []),
  ]);

  revalidateFollowUpViews(member.id);
  return { success: true };
}
