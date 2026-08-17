"use server";

import { getServerSession } from "next-auth/next";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { canAccessMember, normalizeDepartment } from "@/lib/authorization";
import { prisma } from "@/lib/db";
import { reconcileOneOnOneSession } from "@/lib/oneOnOneSessions";
import {
  createZoomMeeting,
  deleteZoomMeeting,
  getZoomConfiguration,
  updateZoomMeeting,
} from "@/lib/zoom";

const OBJECT_ID = /^[a-f\d]{24}$/i;
const ACTIVE_BOOKING_STATUSES = [
  "scheduling",
  "scheduled",
  "started",
  "processing",
  "review_required",
  "completed",
];

const scheduleSchema = z.object({
  memberId: z.string().regex(OBJECT_ID),
  sessionNumber: z.coerce.number().int().min(1).max(6),
  scheduledStart: z.coerce.date(),
  plannedDuration: z.coerce.number().int().min(15).max(240).default(60),
  memberQuestions: z.string().trim().max(5_000).optional().default(""),
  preparationNotes: z.string().trim().max(8_000).optional().default(""),
  coordinatorUserId: z.string().regex(OBJECT_ID).optional(),
});

const rescheduleSchema = z.object({
  sessionId: z.string().regex(OBJECT_ID),
  scheduledStart: z.coerce.date(),
  plannedDuration: z.coerce.number().int().min(15).max(240),
});

function canManageOneOnOnes(user: {
  role?: string | null;
  department?: string | null;
}) {
  const role = user.role?.trim().toLowerCase();
  const department = normalizeDepartment(user.department);
  return ["admin", "superadmin", "manager"].includes(role || "") || department === "management";
}

function isEligiblePlatinumMember(member: { programType: string; memberCode: string }) {
  const program = member.programType.trim().toLowerCase();
  return program.includes("platinum") || member.memberCode.toUpperCase().startsWith("PLT");
}

function futureDate(date: Date) {
  return date.getTime() > Date.now() + 5 * 60_000;
}

async function requireSessionManager() {
  const authSession = await getServerSession(authOptions);
  if (!authSession?.user) return { success: false as const, error: "Unauthorized" };
  if (!canManageOneOnOnes(authSession.user)) {
    return {
      success: false as const,
      error: "Only management, managers and administrators can manage 1-on-1 sessions.",
    };
  }
  return { success: true as const, user: authSession.user };
}

function revalidateMember(memberId: string) {
  revalidatePath(`/workspace/${memberId}`);
  revalidatePath(`/members/${memberId}`);
  revalidatePath("/dashboard");
  revalidatePath("/followups");
}

export async function scheduleOneOnOneSession(input: {
  memberId: string;
  sessionNumber: number;
  scheduledStart: string;
  plannedDuration: number;
  memberQuestions?: string;
  preparationNotes?: string;
  coordinatorUserId?: string;
}) {
  const manager = await requireSessionManager();
  if (!manager.success) return manager;

  const parsed = scheduleSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message || "Invalid session details." };
  }
  if (!futureDate(parsed.data.scheduledStart)) {
    return { success: false as const, error: "Choose a start time at least five minutes in the future." };
  }
  if (!(await canAccessMember(manager.user, parsed.data.memberId))) {
    return { success: false as const, error: "You do not have access to this member." };
  }

  const [member, existingSlot, coordinator] = await Promise.all([
    prisma.member.findUnique({
      where: { id: parsed.data.memberId },
      select: {
        id: true,
        memberCode: true,
        fullName: true,
        email: true,
        programType: true,
        approvalStatus: true,
        oneOnOneSessions: true,
      },
    }),
    prisma.oneOnOneSession.findFirst({
      where: {
        memberId: parsed.data.memberId,
        sessionNumber: parsed.data.sessionNumber,
        status: { in: ACTIVE_BOOKING_STATUSES },
      },
      select: { id: true, status: true },
    }),
    parsed.data.coordinatorUserId
      ? prisma.user.findUnique({
          where: { id: parsed.data.coordinatorUserId },
          select: { id: true, name: true, email: true, department: true, active: true },
        })
      : prisma.user.findUnique({
          where: { id: manager.user.id },
          select: { id: true, name: true, email: true, department: true, active: true },
        }),
  ]);

  if (!member) return { success: false as const, error: "Member not found." };
  if (!isEligiblePlatinumMember(member)) {
    return { success: false as const, error: "The six-session 1-on-1 entitlement is available only to Platinum members." };
  }
  if ((member.approvalStatus || "approved") !== "approved") {
    return { success: false as const, error: "Approve this member before scheduling a 1-on-1." };
  }
  if (existingSlot) {
    return { success: false as const, error: `Session ${parsed.data.sessionNumber} is already ${existingSlot.status}.` };
  }
  if (parsed.data.sessionNumber <= member.oneOnOneSessions) {
    return {
      success: false as const,
      error: `Session ${parsed.data.sessionNumber} is already included in this member's recorded session history.`,
    };
  }
  if (!coordinator?.active) {
    return { success: false as const, error: "Choose an active CRM employee as coordinator." };
  }

  const latestAttempt = await prisma.oneOnOneSession.findFirst({
    where: { memberId: member.id, sessionNumber: parsed.data.sessionNumber },
    orderBy: { sequence: "desc" },
    select: { sequence: true },
  });
  let config: ReturnType<typeof getZoomConfiguration>;
  try {
    config = getZoomConfiguration();
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Zoom is not configured on the server.",
    };
  }
  const crmSession = await prisma.oneOnOneSession.create({
    data: {
      memberId: member.id,
      sessionNumber: parsed.data.sessionNumber,
      sequence: (latestAttempt?.sequence || 0) + 1,
      status: "scheduling",
      scheduledStart: parsed.data.scheduledStart,
      timezone: config.timezone,
      plannedDuration: parsed.data.plannedDuration,
      memberQuestions: parsed.data.memberQuestions || null,
      preparationNotes: parsed.data.preparationNotes || null,
      coordinatorUserId: coordinator.id,
      coordinatorName: coordinator.name,
      coordinatorEmail: coordinator.email,
      coordinatorDepartment: coordinator.department,
      zoomHostUserId: config.hostUserId,
      zoomHostName: process.env.ZOOM_HOST_NAME?.trim() || "Amar Sir",
      zoomHostEmail: config.hostUserId.includes("@") ? config.hostUserId.toLowerCase() : null,
      createdByUser: manager.user.id,
      createdByName: manager.user.name || "Staff Member",
      createdByEmail: manager.user.email || "unknown@prosyncedu.com",
    },
    select: { id: true },
  });

  try {
    const meeting = await createZoomMeeting({
      topic: `ProSync Platinum 1-on-1 — ${member.fullName} (${member.memberCode}) — Session ${parsed.data.sessionNumber}`,
      agenda: `ProSync Platinum member session ${parsed.data.sessionNumber} of 6.`,
      startTime: parsed.data.scheduledStart,
      durationMinutes: parsed.data.plannedDuration,
      timezone: config.timezone,
    });
    if (!meeting.id || !meeting.join_url) {
      throw new Error("Zoom created the meeting without a usable meeting ID or join URL.");
    }

    const updated = await prisma.oneOnOneSession.update({
      where: { id: crmSession.id },
      data: {
        status: "scheduled",
        zoomMeetingId: String(meeting.id),
        zoomMeetingUuid: meeting.uuid || null,
        zoomHostUserId: meeting.host_id || config.hostUserId,
        zoomHostEmail:
          meeting.host_email?.trim().toLowerCase() ||
          (config.hostUserId.includes("@") ? config.hostUserId.toLowerCase() : null),
        joinUrl: meeting.join_url,
        lastError: null,
      },
      select: {
        id: true,
        sessionNumber: true,
        scheduledStart: true,
        joinUrl: true,
        zoomMeetingId: true,
      },
    });
    revalidateMember(member.id);
    return { success: true as const, session: updated };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Zoom meeting creation failed.";
    await prisma.oneOnOneSession.update({
      where: { id: crmSession.id },
      data: { status: "failed", lastError: message },
    });
    revalidateMember(member.id);
    return { success: false as const, error: message };
  }
}

export async function rescheduleOneOnOneSession(input: {
  sessionId: string;
  scheduledStart: string;
  plannedDuration: number;
}) {
  const manager = await requireSessionManager();
  if (!manager.success) return manager;
  const parsed = rescheduleSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message || "Invalid reschedule details." };
  }
  if (!futureDate(parsed.data.scheduledStart)) {
    return { success: false as const, error: "Choose a start time at least five minutes in the future." };
  }

  const crmSession = await prisma.oneOnOneSession.findUnique({
    where: { id: parsed.data.sessionId },
    select: {
      id: true,
      memberId: true,
      status: true,
      zoomMeetingId: true,
      timezone: true,
      scheduledStart: true,
      plannedDuration: true,
      rescheduleHistoryJson: true,
    },
  });
  if (!crmSession || !crmSession.zoomMeetingId) {
    return { success: false as const, error: "Scheduled Zoom meeting not found." };
  }
  if (!(await canAccessMember(manager.user, crmSession.memberId))) {
    return { success: false as const, error: "You do not have access to this member." };
  }
  if (!['scheduled', 'scheduling'].includes(crmSession.status)) {
    return { success: false as const, error: `A ${crmSession.status} session cannot be rescheduled.` };
  }

  try {
    await updateZoomMeeting(crmSession.zoomMeetingId, {
      startTime: parsed.data.scheduledStart,
      durationMinutes: parsed.data.plannedDuration,
      timezone: crmSession.timezone,
    });
    let history: unknown[] = [];
    if (crmSession.rescheduleHistoryJson) {
      try {
        const parsedHistory = JSON.parse(crmSession.rescheduleHistoryJson);
        if (Array.isArray(parsedHistory)) history = parsedHistory;
      } catch {
        history = [];
      }
    }
    history.push({
      scheduledStart: crmSession.scheduledStart.toISOString(),
      plannedDuration: crmSession.plannedDuration,
      changedAt: new Date().toISOString(),
      changedByUser: manager.user.id,
      changedByName: manager.user.name || "Staff Member",
    });
    await prisma.oneOnOneSession.update({
      where: { id: crmSession.id },
      data: {
        scheduledStart: parsed.data.scheduledStart,
        plannedDuration: parsed.data.plannedDuration,
        status: "scheduled",
        rescheduleHistoryJson: JSON.stringify(history.slice(-20)),
        lastError: null,
      },
    });
    revalidateMember(crmSession.memberId);
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Zoom meeting could not be rescheduled.",
    };
  }
}

export async function cancelOneOnOneSession(sessionId: string, reason: string) {
  const manager = await requireSessionManager();
  if (!manager.success) return manager;
  if (!OBJECT_ID.test(sessionId)) return { success: false as const, error: "Invalid session." };
  const cleanedReason = reason.trim().slice(0, 1_000);
  if (!cleanedReason) return { success: false as const, error: "Record a cancellation reason." };

  const crmSession = await prisma.oneOnOneSession.findUnique({
    where: { id: sessionId },
    select: { id: true, memberId: true, status: true, zoomMeetingId: true },
  });
  if (!crmSession) return { success: false as const, error: "Session not found." };
  if (!(await canAccessMember(manager.user, crmSession.memberId))) {
    return { success: false as const, error: "You do not have access to this member." };
  }
  if (["completed", "cancelled"].includes(crmSession.status)) {
    return { success: false as const, error: `A ${crmSession.status} session cannot be cancelled.` };
  }

  try {
    if (crmSession.zoomMeetingId) await deleteZoomMeeting(crmSession.zoomMeetingId);
  } catch (error) {
    console.error(`Zoom meeting ${crmSession.zoomMeetingId} could not be deleted:`, error);
  }
  await prisma.oneOnOneSession.update({
    where: { id: crmSession.id },
    data: {
      status: "cancelled",
      cancelledAt: new Date(),
      cancellationReason: cleanedReason,
      joinUrl: null,
    },
  });
  revalidateMember(crmSession.memberId);
  return { success: true as const };
}

export async function syncOneOnOneSession(sessionId: string) {
  const manager = await requireSessionManager();
  if (!manager.success) return manager;
  if (!OBJECT_ID.test(sessionId)) return { success: false as const, error: "Invalid session." };

  const crmSession = await prisma.oneOnOneSession.findUnique({
    where: { id: sessionId },
    select: { id: true, memberId: true, zoomMeetingId: true },
  });
  if (!crmSession?.zoomMeetingId) {
    return { success: false as const, error: "This session has no Zoom meeting to synchronize." };
  }
  if (!(await canAccessMember(manager.user, crmSession.memberId))) {
    return { success: false as const, error: "You do not have access to this member." };
  }

  try {
    await reconcileOneOnOneSession(crmSession.id, { includeTranscript: true });
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Zoom synchronization failed.",
    };
  }
}
