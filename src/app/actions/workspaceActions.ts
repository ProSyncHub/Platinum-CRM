"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";
import {
  canAccessMember,
  memberScopeFor,
  normalizeDepartment,
} from "@/lib/authorization";
import { generateMemberCode, type MediumId } from "@/lib/membershipUtils";
import { syncMemberBackground } from "@/lib/memberBackground";
import type { Prisma } from "@prisma/client";
import {
  prepareFollowUpAssignment,
  saveFollowUpAssignment,
} from "@/lib/followUpTasks.server";

const ADMIN_ROLES = new Set(["admin", "superadmin"]);
const VALID_MEDIA = new Set<MediumId>([
  "phone",
  "whatsapp",
  "zoom",
  "meet",
  "email",
  "sms",
  "telegram",
  "in_person",
  "internal",
]);
const VALID_UPDATE_STATUSES = new Set([
  "not_started",
  "in_progress",
  "waiting",
  "completed",
  "blocked",
]);
const VALID_PRIORITIES = new Set(["low", "medium", "high", "urgent"]);

const MEMBER_SEARCH_SELECT = {
  id: true,
  memberCode: true,
  fullName: true,
  phone: true,
  email: true,
  programType: true,
  activeStatus: true,
  approvalStatus: true,
  department: true,
  currentStage: true,
  healthStatus: true,
  lastConnectDate: true,
  lastContactStaff: true,
  updatedAt: true,
} satisfies Prisma.MemberSelect;

type MemberSearchRecord = Prisma.MemberGetPayload<{
  select: typeof MEMBER_SEARCH_SELECT;
}>;

function normalizeName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function damerauLevenshtein(left: string, right: string) {
  const rows = left.length + 1;
  const columns = right.length + 1;
  const matrix = Array.from({ length: rows }, () => Array<number>(columns).fill(0));

  for (let row = 0; row < rows; row += 1) matrix[row][0] = row;
  for (let column = 0; column < columns; column += 1) matrix[0][column] = column;

  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const substitutionCost = left[row - 1] === right[column - 1] ? 0 : 1;
      matrix[row][column] = Math.min(
        matrix[row - 1][column] + 1,
        matrix[row][column - 1] + 1,
        matrix[row - 1][column - 1] + substitutionCost,
      );

      if (
        row > 1 &&
        column > 1 &&
        left[row - 1] === right[column - 2] &&
        left[row - 2] === right[column - 1]
      ) {
        matrix[row][column] = Math.min(
          matrix[row][column],
          matrix[row - 2][column - 2] + 1,
        );
      }
    }
  }

  return matrix[left.length][right.length];
}

function stringSimilarity(left: string, right: string) {
  const longest = Math.max(left.length, right.length);
  if (longest === 0) return 1;
  return 1 - damerauLevenshtein(left, right) / longest;
}

function nameSimilarity(query: string, fullName: string) {
  const normalizedQuery = normalizeName(query);
  const normalizedName = normalizeName(fullName);
  if (!normalizedQuery || !normalizedName) return 0;
  if (normalizedName.includes(normalizedQuery)) return 1;

  const queryWords = normalizedQuery.split(" ");
  const nameWords = normalizedName.split(" ");
  let bestScore = stringSimilarity(normalizedQuery, normalizedName);

  if (queryWords.length === 1) {
    for (const nameWord of nameWords) {
      if (nameWord.startsWith(normalizedQuery)) return 0.98;
      bestScore = Math.max(bestScore, stringSimilarity(normalizedQuery, nameWord));
    }
  } else {
    const wordScores = queryWords.map((queryWord) =>
      Math.max(...nameWords.map((nameWord) => stringSimilarity(queryWord, nameWord))),
    );
    bestScore = Math.max(
      bestScore,
      wordScores.reduce((sum, score) => sum + score, 0) / wordScores.length,
    );
  }

  return bestScore;
}

function serializeSearchMember(
  member: MemberSearchRecord,
  suggestedByName = false,
) {
  return {
    ...member,
    approvalStatus: member.approvalStatus || "approved",
    lastConnectDate: member.lastConnectDate?.toISOString() || null,
    updatedAt: member.updatedAt.toISOString(),
    suggestedByName,
  };
}

function isAdmin(role?: string | null) {
  return ADMIN_ROLES.has(role?.trim().toLowerCase() || "");
}

function clean(value?: string | null) {
  return value?.trim() || "";
}

function refreshMemberWorkspace(memberId: string) {
  revalidatePath("/workspace");
  revalidatePath(`/workspace/${memberId}`);
  revalidatePath(`/members/${memberId}`);
  revalidatePath("/members");
  revalidatePath("/dashboard");
  revalidatePath("/followups");
  revalidatePath("/approvals");
}

async function allocateMemberCode(programType: string) {
  const year = new Date().getFullYear();
  const count = await prisma.member.count({
    where: { programType: { equals: programType, mode: "insensitive" } },
  });

  for (let offset = 1; offset <= 100; offset += 1) {
    const candidate = generateMemberCode(programType, count + offset, year);
    const exists = await prisma.member.findUnique({
      where: { memberCode: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
  }

  return generateMemberCode(programType, Date.now() % 100000, year);
}

export async function searchWorkspaceMembers(query: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { success: false, error: "Unauthorized", members: [] };

  const rawQuery = clean(query);
  if (rawQuery.length < 3) {
    return { success: false, error: "Enter at least 3 characters.", members: [] };
  }

  const digits = rawQuery.replace(/\D/g, "");
  const phoneFragments = Array.from(
    new Set([rawQuery, digits, digits.length >= 8 ? digits.slice(-8) : ""].filter(Boolean)),
  );
  const isPhoneSearch = /^[+\d\s().-]+$/.test(rawQuery) && digits.length >= 3;
  const isEmailSearch =
    !isPhoneSearch &&
    (rawQuery.includes("@") || (rawQuery.includes(".") && /[a-z]/i.test(rawQuery)));
  const isCodeSearch = /^(plt|pnp|aws|mem)(?:-|$)/i.test(rawQuery);
  const isNameSearch = !isPhoneSearch && !isEmailSearch && !isCodeSearch;

  try {
    const visibilityWhere: Prisma.MemberWhereInput = {
      AND: [
        memberScopeFor(session.user),
        {
          OR: [
            { approvalStatus: null },
            { approvalStatus: { isSet: false } },
            { approvalStatus: { in: ["approved", "pending"] } },
            ...(isAdmin(session.user.role) ? [{ approvalStatus: "rejected" }] : []),
          ],
        },
      ],
    };

    const exactFilter: Prisma.MemberWhereInput = isPhoneSearch
      ? { OR: phoneFragments.map((fragment) => ({ phone: { contains: fragment } })) }
      : isEmailSearch
        ? { email: { contains: rawQuery, mode: "insensitive" } }
        : isCodeSearch
          ? { memberCode: { contains: rawQuery, mode: "insensitive" } }
          : { fullName: { contains: rawQuery, mode: "insensitive" } };

    const exactMembers = await prisma.member.findMany({
      where: { AND: [visibilityWhere, exactFilter] },
      select: MEMBER_SEARCH_SELECT,
      orderBy: [{ updatedAt: "desc" }],
      take: 15,
    });

    if (!isNameSearch || exactMembers.length >= 15) {
      return {
        success: true,
        members: exactMembers.map((member) => serializeSearchMember(member)),
      };
    }

    // Typo tolerance is intentionally limited to names. Email addresses and
    // phone numbers never enter this candidate pass and therefore stay exact.
    const candidateMembers = await prisma.member.findMany({
      where: visibilityWhere,
      select: MEMBER_SEARCH_SELECT,
      orderBy: [{ updatedAt: "desc" }],
      take: 1500,
    });
    const exactIds = new Set(exactMembers.map((member) => member.id));
    const normalizedQueryLength = normalizeName(rawQuery).replace(/\s/g, "").length;
    const threshold = rawQuery.includes(" ")
      ? 0.72
      : normalizedQueryLength <= 4
        ? 0.66
        : 0.68;
    const fuzzyMembers = candidateMembers
      .filter((member) => !exactIds.has(member.id))
      .map((member) => ({ member, score: nameSimilarity(rawQuery, member.fullName) }))
      .filter(({ score }) => score >= threshold)
      .sort(
        (left, right) =>
          right.score - left.score ||
          right.member.updatedAt.getTime() - left.member.updatedAt.getTime(),
      )
      .slice(0, Math.max(0, 15 - exactMembers.length));

    return {
      success: true,
      members: [
        ...exactMembers.map((member) => serializeSearchMember(member)),
        ...fuzzyMembers.map(({ member }) => serializeSearchMember(member, true)),
      ],
    };
  } catch (error) {
    console.error("Workspace member search failed:", error);
    return { success: false, error: "Could not search members.", members: [] };
  }
}

export async function registerMember(data: {
  firstName: string;
  lastName?: string;
  email: string;
  phone: string;
  programType: string;
  otherProgram?: string;
  state?: string;
  communicationMedium?: MediumId;
  communicationOutcome?: string;
  communicationNotes?: string;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { success: false, error: "Unauthorized" };

  const firstName = clean(data.firstName);
  const lastName = clean(data.lastName);
  const email = clean(data.email).toLowerCase();
  const phone = clean(data.phone);
  const selectedProgram = clean(data.programType) || "Platinum";
  const otherProgram = clean(data.otherProgram);
  const programType = selectedProgram === "Other" ? otherProgram : selectedProgram;
  const communicationNotes = clean(data.communicationNotes);
  const medium = VALID_MEDIA.has(data.communicationMedium || "phone")
    ? data.communicationMedium || "phone"
    : "phone";

  if (!firstName || !email || !phone) {
    return { success: false, error: "Name, phone number, and email are required." };
  }
  if (selectedProgram === "Other" && !otherProgram) {
    return { success: false, error: "Enter the requested program or service." };
  }

  try {
    const duplicate = await prisma.member.findFirst({
      where: {
        OR: [
          { email: { equals: email, mode: "insensitive" } },
          { phone },
        ],
      },
      select: { id: true, fullName: true, memberCode: true },
    });
    if (duplicate) {
      return {
        success: false,
        error: `${duplicate.fullName} already exists as ${duplicate.memberCode}. Search and open that journey instead.`,
        memberId: duplicate.id,
      };
    }

    const administrator = isAdmin(session.user.role);
    const department = normalizeDepartment(session.user.department);
    const now = new Date();
    const memberCode = await allocateMemberCode(programType);
    const fullName = `${firstName} ${lastName}`.trim();

    const member = await prisma.member.create({
      data: {
        memberCode,
        firstName,
        lastName: lastName || null,
        fullName,
        phone,
        email,
        state: clean(data.state) || null,
        programType,
        department,
        activeStatus: administrator ? "Active" : "Pending Approval",
        approvalStatus: administrator ? "approved" : "pending",
        requestedProgram: selectedProgram,
        requestedProgramOther: otherProgram || null,
        submittedByUser: session.user.id || null,
        submittedByName: session.user.name || "Staff Member",
        submittedByEmail: session.user.email || "",
        submittedByDepartment: department,
        submittedAt: now,
        allotedTo: session.user.name || null,
        currentStage: "onboarding",
        currentMilestone: "New contact registered",
        healthStatus: "healthy",
        lastConnectDate: communicationNotes ? now : null,
        lastContactMedium: communicationNotes ? medium : null,
        lastContactStaff: communicationNotes ? session.user.name || "Staff Member" : null,
      },
    });

    if (communicationNotes) {
      await prisma.callLog.create({
        data: {
          memberId: member.id,
          date: now,
          type: "outbound",
          medium,
          outcome: clean(data.communicationOutcome) || "New contact registered",
          notes: communicationNotes,
          staffUserId: session.user.id || null,
          staffName: session.user.name || "Staff Member",
          staffEmail: session.user.email || "",
          staffDepartment: department,
        },
      });
    }

    await syncMemberBackground(member.id);

    refreshMemberWorkspace(member.id);
    return {
      success: true,
      memberId: member.id,
      pendingApproval: !administrator,
    };
  } catch (error) {
    console.error("Member registration failed:", error);
    return { success: false, error: "Could not register this member." };
  }
}

export async function addDepartmentUpdate(
  memberId: string,
  data: {
    department?: string;
    category?: string;
    status: string;
    summary: string;
    details?: string;
    nextStep?: string;
  },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!(await canAccessMember(session.user, memberId))) {
    return { success: false, error: "You do not have access to this member." };
  }

  const summary = clean(data.summary);
  if (!summary) return { success: false, error: "Add a short status update." };
  if (!VALID_UPDATE_STATUSES.has(data.status)) {
    return { success: false, error: "Choose a valid department status." };
  }

  const department = isAdmin(session.user.role)
    ? normalizeDepartment(data.department || session.user.department)
    : normalizeDepartment(session.user.department);

  try {
    await prisma.departmentUpdate.create({
      data: {
        memberId,
        department,
        category: clean(data.category) || null,
        status: data.status,
        summary,
        details: clean(data.details) || null,
        nextStep: clean(data.nextStep) || null,
        updatedByUser: session.user.id || null,
        updatedByName: session.user.name || "Staff Member",
        updatedByEmail: session.user.email || "",
      },
    });

    await syncMemberBackground(memberId);

    refreshMemberWorkspace(memberId);
    return { success: true };
  } catch (error) {
    console.error("Department update failed:", error);
    return { success: false, error: "Could not save the department update." };
  }
}

export async function transferWithCommunication(
  memberId: string,
  data: {
    toDepartment: string;
    assignedToUser: string;
    dueAt: string;
    reason: string;
    priority: "low" | "medium" | "high" | "urgent";
    medium: MediumId;
    type: "inbound" | "outbound";
    outcome: string;
    communicationNotes: string;
  },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!(await canAccessMember(session.user, memberId))) {
    return { success: false, error: "You do not have access to this member." };
  }

  const requestedDepartment = clean(data.toDepartment);
  const toDepartment = normalizeDepartment(requestedDepartment);
  const fromDepartment = normalizeDepartment(session.user.department);
  const reason = clean(data.reason);
  const notes = clean(data.communicationNotes);
  const outcome = clean(data.outcome);
  if (!requestedDepartment || !reason || !notes || !outcome) {
    return { success: false, error: "Team, issue, outcome, and communication notes are required." };
  }
  if (reason.length > 2000 || notes.length > 4000 || outcome.length > 160) {
    return { success: false, error: "Transfer details are too long." };
  }
  if (!VALID_PRIORITIES.has(data.priority)) {
    return { success: false, error: "Choose a valid transfer priority." };
  }
  if (!VALID_MEDIA.has(data.medium)) {
    return { success: false, error: "Choose a valid communication medium." };
  }

  const preparedFollowUp = await prepareFollowUpAssignment(
    memberId,
    {
      assignedToUser: data.assignedToUser,
      dueAt: data.dueAt,
      priority: data.priority,
      title: `Transferred follow-up: ${outcome}`,
      instructions: reason,
    },
    session.user,
    { requiredDepartment: toDepartment, allowCrossDepartment: true },
  );
  if (!preparedFollowUp.success) return preparedFollowUp;

  try {
    const now = new Date();
    const transfer = await prisma.queryTransfer.create({
      data: {
        memberId,
        fromDepartment,
        toDepartment,
        assignedToUser: preparedFollowUp.assignee.id,
        assignedToName: preparedFollowUp.assignee.name,
        assignedToEmail: preparedFollowUp.assignee.email,
        reason,
        priority: data.priority,
        status: "pending",
      },
      select: { id: true },
    });
    const callLog = await prisma.callLog.create({
      data: {
        memberId,
        date: now,
        type: data.type,
        medium: data.medium,
        outcome,
        notes,
        staffUserId: session.user.id || null,
        staffName: session.user.name || "Staff Member",
        staffEmail: session.user.email || "",
        staffDepartment: fromDepartment,
      },
      select: { id: true },
    });
    await prisma.member.update({
      where: { id: memberId },
      data: {
        lastConnectDate: now,
        lastContactMedium: data.medium,
        lastContactStaff: session.user.name || "Staff Member",
      },
    });

    await saveFollowUpAssignment({
      memberId,
      actor: session.user,
      prepared: preparedFollowUp,
      sourceType: "transfer",
      assignmentType: "transferred",
      sourceCallLogId: callLog.id,
      sourceTransferId: transfer.id,
    });

    await syncMemberBackground(memberId);

    refreshMemberWorkspace(memberId);
    return { success: true };
  } catch (error) {
    console.error("Transfer with communication failed:", error);
    return { success: false, error: "Could not complete the transfer." };
  }
}

export async function reviewMemberRegistration(
  memberId: string,
  decision: "approved" | "rejected",
  data: { programType?: string; reviewNotes?: string },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.role)) {
    return { success: false, error: "Only a Super Admin can review registrations." };
  }

  try {
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      select: { id: true, programType: true, approvalStatus: true },
    });
    if (!member) return { success: false, error: "Registration not found." };
    if ((member.approvalStatus || "approved") !== "pending") {
      return { success: false, error: "This registration has already been reviewed." };
    }

    const programType = clean(data.programType) || member.programType;
    const memberCode =
      decision === "approved" && programType !== member.programType
        ? await allocateMemberCode(programType)
        : undefined;

    await prisma.member.update({
      where: { id: memberId },
      data: {
        approvalStatus: decision,
        activeStatus: decision === "approved" ? "Active" : "Not Active",
        programType,
        ...(memberCode ? { memberCode } : {}),
        reviewedAt: new Date(),
        reviewedByName: session.user.name || "Super Admin",
        reviewedByEmail: session.user.email || "",
        reviewNotes: clean(data.reviewNotes) || null,
      },
    });
    await prisma.callLog.create({
      data: {
        memberId,
        date: new Date(),
        type: "outbound",
        medium: "internal",
        outcome: decision === "approved" ? "Registration approved" : "Registration rejected",
        notes:
          clean(data.reviewNotes) ||
          (decision === "approved"
            ? `Approved for ${programType}.`
            : "Registration rejected by Super Admin."),
        staffUserId: session.user.id || null,
        staffName: session.user.name || "Super Admin",
        staffEmail: session.user.email || "",
        staffDepartment: normalizeDepartment(session.user.department),
      },
    });

    refreshMemberWorkspace(memberId);
    return { success: true };
  } catch (error) {
    console.error("Registration review failed:", error);
    return { success: false, error: "Could not review this registration." };
  }
}
