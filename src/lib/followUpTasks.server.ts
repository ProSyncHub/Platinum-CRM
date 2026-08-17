import "server-only";

import { prisma } from "@/lib/db";
import { isElevatedViewer, normalizeDepartment } from "@/lib/authorization";
import { isMemberFollowUpEligible } from "@/lib/followupEligibility";
import type {
  FollowUpAssignmentType,
  FollowUpPriority,
  FollowUpSourceType,
} from "@/lib/followups";

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;
const OPEN_STATUSES = ["pending", "in_progress"];
const VALID_PRIORITIES = new Set<FollowUpPriority>([
  "low",
  "medium",
  "high",
  "urgent",
]);

export interface FollowUpActor {
  id?: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  department?: string | null;
}

export interface FollowUpAssignmentInput {
  assignedToUser: string;
  dueAt: string;
  priority?: FollowUpPriority;
  title?: string;
  instructions?: string;
}

interface PrepareOptions {
  requiredDepartment?: string;
  allowCrossDepartment?: boolean;
}

export async function prepareFollowUpAssignment(
  memberId: string,
  input: FollowUpAssignmentInput,
  actor: FollowUpActor,
  options: PrepareOptions = {},
) {
  const assignedToUser = input.assignedToUser?.trim();
  if (!OBJECT_ID_PATTERN.test(memberId) || !OBJECT_ID_PATTERN.test(assignedToUser)) {
    return { success: false as const, error: "Choose a valid follow-up owner." };
  }

  const priority = input.priority || "medium";
  if (!VALID_PRIORITIES.has(priority)) {
    return { success: false as const, error: "Choose a valid follow-up priority." };
  }

  const dueAt = new Date(input.dueAt);
  if (
    Number.isNaN(dueAt.getTime()) ||
    dueAt.getTime() < Date.now() - 5 * 60_000
  ) {
    return { success: false as const, error: "Choose a future follow-up date and time." };
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

  if (!member) return { success: false as const, error: "Member not found." };
  if (!assignee) return { success: false as const, error: "Active follow-up owner not found." };
  if (!isMemberFollowUpEligible(member)) {
    return {
      success: false as const,
      error: "This member is not currently eligible for follow-ups.",
    };
  }

  const assigneeDepartment = normalizeDepartment(assignee.department);
  const requiredDepartment = options.requiredDepartment
    ? normalizeDepartment(options.requiredDepartment)
    : "";
  if (requiredDepartment && assigneeDepartment !== requiredDepartment) {
    return {
      success: false as const,
      error: "The selected owner must belong to the receiving department.",
    };
  }

  if (
    !options.allowCrossDepartment &&
    !isElevatedViewer(actor) &&
    assigneeDepartment !== normalizeDepartment(actor.department)
  ) {
    return {
      success: false as const,
      error: "Employees can assign follow-ups only within their department.",
    };
  }

  return {
    success: true as const,
    member,
    assignee,
    dueAt,
    priority,
    title:
      input.title?.trim().slice(0, 160) ||
      `Follow up with ${member.fullName}`,
    instructions: input.instructions?.trim().slice(0, 2000) || null,
  };
}

export async function saveFollowUpAssignment(input: {
  memberId: string;
  actor: FollowUpActor;
  prepared: Extract<
    Awaited<ReturnType<typeof prepareFollowUpAssignment>>,
    { success: true }
  >;
  sourceType: FollowUpSourceType;
  assignmentType?: FollowUpAssignmentType;
  sourceCallLogId?: string | null;
  sourceTransferId?: string | null;
}) {
  const { member, assignee, dueAt, priority, title, instructions } = input.prepared;
  const assignmentType =
    input.assignmentType ||
    (assignee.id === input.actor.id ? "self" : "transferred");
  const creatorId = input.actor.id || assignee.id;
  const taskData = {
    title,
    instructions,
    priority,
    status: "pending",
    dueAt,
    sourceType: input.sourceType,
    assignmentType,
    sourceCallLogId: input.sourceCallLogId || null,
    sourceTransferId: input.sourceTransferId || null,
    assignedToUser: assignee.id,
    assignedToName: assignee.name,
    assignedToEmail: assignee.email,
    assignedToDepartment: assignee.department,
    createdByUser: creatorId,
    createdByName: input.actor.name || "Staff Member",
    createdByEmail: input.actor.email || "",
    createdByDepartment: input.actor.department || "operations",
    completedAt: null,
    completedByUser: null,
    completedByName: null,
    completionNotes: null,
  };

  const existing = await prisma.followUpTask.findFirst({
    where: {
      memberId: input.memberId,
      assignedToUser: assignee.id,
      status: { in: OPEN_STATUSES },
    },
    select: { id: true },
  });

  const task = existing
    ? await prisma.followUpTask.update({
        where: { id: existing.id },
        data: taskData,
        select: { id: true },
      })
    : await prisma.followUpTask.create({
        data: { memberId: input.memberId, ...taskData },
        select: { id: true },
      });

  if (!member.nextConnectDate || dueAt < member.nextConnectDate) {
    await prisma.member.update({
      where: { id: input.memberId },
      data: { nextConnectDate: dueAt },
      select: { id: true },
    });
  }

  return task;
}
