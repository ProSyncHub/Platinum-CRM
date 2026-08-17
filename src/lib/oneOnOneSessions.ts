import "server-only";

import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { syncMemberBackground } from "@/lib/memberBackground";
import {
  generateOneOnOneAnalysis,
  oneOnOneAnalysisSourceHash,
  type OneOnOneAnalysis,
  type OneOnOneAnalysisSource,
} from "@/lib/oneOnOneAi";
import {
  getMeetingRecordings,
  getZoomConfiguration,
  listPastMeetingParticipants,
  downloadMeetingTranscript,
  ZoomDataNotReadyError,
  type ZoomPastParticipant,
} from "@/lib/zoom";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asRecord(value: unknown) {
  return isRecord(value) ? value : {};
}

function asString(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  return "";
}

function normalizeEmail(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

function normalizeName(value?: string | null) {
  return (value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function eventTimestamp(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const milliseconds = value > 10_000_000_000 ? value : value * 1_000;
  const date = new Date(milliseconds);
  return Number.isNaN(date.getTime()) ? null : date;
}

function zoomObjectFromPayload(payload: unknown) {
  const root = asRecord(payload);
  const payloadRecord = asRecord(root.payload);
  return asRecord(payloadRecord.object);
}

function zoomReferences(object: JsonRecord) {
  return {
    meetingId: asString(object.id),
    meetingUuid: asString(object.uuid),
  };
}

export async function recordZoomWebhookEvent(rawBody: string, payload: unknown) {
  const root = asRecord(payload);
  const eventType = asString(root.event) || "unknown";
  const object = zoomObjectFromPayload(root);
  const { meetingId, meetingUuid } = zoomReferences(object);
  const eventKey = createHash("sha256").update(rawBody).digest("hex");

  try {
    const event = await prisma.zoomWebhookEvent.create({
      data: {
        eventKey,
        eventType,
        eventTimestamp: eventTimestamp(root.event_ts),
        zoomMeetingId: meetingId || null,
        zoomMeetingUuid: meetingUuid || null,
        payloadJson: rawBody,
      },
      select: { id: true },
    });
    return { duplicate: false as const, eventId: event.id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await prisma.zoomWebhookEvent.findUnique({
        where: { eventKey },
        select: { id: true },
      });
      return { duplicate: true as const, eventId: existing?.id || null };
    }
    throw error;
  }
}

async function findSessionForZoomObject(object: JsonRecord) {
  const { meetingId, meetingUuid } = zoomReferences(object);
  if (!meetingId && !meetingUuid) return null;
  return prisma.oneOnOneSession.findFirst({
    where: {
      OR: [
        ...(meetingUuid ? [{ zoomMeetingUuid: meetingUuid }] : []),
        ...(meetingId ? [{ zoomMeetingId: meetingId }] : []),
      ],
    },
    orderBy: { createdAt: "desc" },
    include: { member: true },
  });
}

interface AttendanceSegment {
  participantKey: string;
  participantId: string | null;
  participantUserId: string | null;
  participantName: string;
  participantEmail: string | null;
  joinAt: Date;
  leaveAt: Date;
  durationSeconds: number;
  raw: ZoomPastParticipant;
}

function normalizeParticipant(participant: ZoomPastParticipant, index: number) {
  const participantName = participant.name || participant.user_name || "Unknown participant";
  const participantEmail = normalizeEmail(participant.email || participant.user_email) || null;
  const participantId = asString(participant.id) || null;
  const participantUserId = asString(participant.user_id) || null;
  const joinAt = new Date(asString(participant.join_time));
  const rawDuration = Number(participant.duration || 0);
  const leaveAtRaw = new Date(asString(participant.leave_time));
  const leaveAt = Number.isNaN(leaveAtRaw.getTime())
    ? new Date(joinAt.getTime() + Math.max(0, rawDuration) * 1_000)
    : leaveAtRaw;
  if (Number.isNaN(joinAt.getTime()) || leaveAt <= joinAt) return null;

  const durationSeconds = Math.max(
    0,
    rawDuration || Math.round((leaveAt.getTime() - joinAt.getTime()) / 1_000),
  );
  const participantKey =
    participantUserId ||
    participantId ||
    participantEmail ||
    `${normalizeName(participantName) || "unknown"}-${index}`;
  return {
    participantKey,
    participantId,
    participantUserId,
    participantName,
    participantEmail,
    joinAt,
    leaveAt,
    durationSeconds,
    raw: participant,
  } satisfies AttendanceSegment;
}

function mergeIntervals(segments: AttendanceSegment[]) {
  const ordered = segments
    .map((segment) => ({ start: segment.joinAt.getTime(), end: segment.leaveAt.getTime() }))
    .sort((left, right) => left.start - right.start);
  const merged: Array<{ start: number; end: number }> = [];
  for (const interval of ordered) {
    const latest = merged.at(-1);
    if (!latest || interval.start > latest.end) merged.push({ ...interval });
    else latest.end = Math.max(latest.end, interval.end);
  }
  return merged;
}

function overlapSeconds(host: AttendanceSegment[], member: AttendanceSegment[]) {
  const hostIntervals = mergeIntervals(host);
  const memberIntervals = mergeIntervals(member);
  let seconds = 0;
  for (const hostInterval of hostIntervals) {
    for (const memberInterval of memberIntervals) {
      const start = Math.max(hostInterval.start, memberInterval.start);
      const end = Math.min(hostInterval.end, memberInterval.end);
      if (end > start) seconds += (end - start) / 1_000;
    }
  }
  return Math.round(seconds);
}

function selectAttendanceRoles(
  segments: AttendanceSegment[],
  session: {
    zoomHostUserId: string;
    zoomHostEmail: string | null;
    zoomHostName: string | null;
    member: { email: string; fullName: string };
  },
) {
  const configuredHost = getZoomConfiguration().hostUserId;
  const hostEmails = new Set(
    [session.zoomHostEmail, configuredHost.includes("@") ? configuredHost : null]
      .map(normalizeEmail)
      .filter(Boolean),
  );
  let host = segments.filter(
    (segment) =>
      segment.participantUserId === session.zoomHostUserId ||
      (segment.participantEmail && hostEmails.has(segment.participantEmail)),
  );
  if (host.length === 0 && session.zoomHostName) {
    const hostName = normalizeName(session.zoomHostName);
    host = segments.filter((segment) => normalizeName(segment.participantName) === hostName);
  }

  const memberEmail = normalizeEmail(session.member.email);
  let member = segments.filter(
    (segment) => Boolean(memberEmail && segment.participantEmail === memberEmail),
  );
  let matchMethod = member.length > 0 ? "verified_email" : "";
  if (member.length === 0) {
    const memberName = normalizeName(session.member.fullName);
    const exactNameMatches = segments.filter(
      (segment) => normalizeName(segment.participantName) === memberName,
    );
    if (exactNameMatches.length > 0) {
      member = exactNameMatches;
      matchMethod = "unique_exact_name";
    }
  }
  return { host, member, matchMethod };
}

function communicationNotes(
  sessionNumber: number,
  verifiedMinutes: number,
  summary?: string | null,
) {
  return [
    `[ZOOM AUTOMATION] Platinum 1-on-1 Session ${sessionNumber} completed.`,
    `Verified host/member overlap: ${verifiedMinutes} minutes.`,
    summary ? `Summary: ${summary}` : "Transcript summary is still processing or requires review.",
  ].join("\n");
}

async function ensureAutomatedCallLog(sessionId: string) {
  const session = await prisma.oneOnOneSession.findUnique({
    where: { id: sessionId },
    include: { member: true },
  });
  if (!session || session.attendanceStatus !== "verified" || !session.verifiedMinutes) return null;

  const notes = communicationNotes(
    session.sessionNumber,
    session.verifiedMinutes,
    session.aiSummary,
  );
  let callLog = await prisma.callLog.findFirst({
    where: { oneOnOneSessionId: session.id, source: "zoom_automation" },
    select: { id: true },
  });

  if (!callLog) {
    callLog = await prisma.callLog.create({
      data: {
        memberId: session.memberId,
        date: session.actualStart || session.scheduledStart,
        type: "outbound",
        medium: "zoom",
        outcome: "1-on-1 completed",
        duration: session.verifiedMinutes,
        notes,
        staffName: session.zoomHostName || "Amar Sir",
        staffEmail: session.zoomHostEmail,
        staffDepartment: "management",
        source: "zoom_automation",
        externalReference: session.zoomMeetingUuid || session.zoomMeetingId,
        oneOnOneSessionId: session.id,
      },
      select: { id: true },
    });
  } else {
    await prisma.callLog.update({
      where: { id: callLog.id },
      data: {
        date: session.actualStart || session.scheduledStart,
        duration: session.verifiedMinutes,
        notes,
        outcome: "1-on-1 completed",
      },
    });
  }

  await prisma.oneOnOneSession.update({
    where: { id: session.id },
    data: { callLogId: callLog.id },
  });

  const [completedCount, highestCompleted, newestCall, currentMember] = await Promise.all([
    prisma.oneOnOneSession.count({
      where: { memberId: session.memberId, status: "completed" },
    }),
    prisma.oneOnOneSession.findFirst({
      where: { memberId: session.memberId, status: "completed" },
      orderBy: { sessionNumber: "desc" },
      select: { sessionNumber: true },
    }),
    prisma.callLog.findFirst({
      where: { memberId: session.memberId },
      orderBy: { date: "desc" },
      select: { id: true },
    }),
    prisma.member.findUnique({
      where: { id: session.memberId },
      select: { oneOnOneSessions: true },
    }),
  ]);
  await prisma.member.update({
    where: { id: session.memberId },
    data: {
      oneOnOneSessions: Math.min(
        6,
        Math.max(
          currentMember?.oneOnOneSessions || 0,
          completedCount,
          highestCompleted?.sessionNumber || 0,
        ),
      ),
      ...(newestCall?.id === callLog.id
        ? {
            lastConnectDate: session.actualStart || session.scheduledStart,
            lastContactMedium: "zoom",
            lastContactStaff: session.zoomHostName || "Amar Sir",
          }
        : {}),
    },
  });
  await syncMemberBackground(session.memberId);
  return callLog.id;
}

function parseDueDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function createVerifiedFollowUps(
  sessionId: string,
  analysis: OneOnOneAnalysis,
) {
  const session = await prisma.oneOnOneSession.findUnique({
    where: { id: sessionId },
    select: {
      memberId: true,
      callLogId: true,
      coordinatorUserId: true,
      coordinatorName: true,
      coordinatorEmail: true,
      coordinatorDepartment: true,
    },
  });
  if (!session?.callLogId || !session.coordinatorUserId) return;

  for (const item of analysis.actionItems) {
    const ownerEmail = normalizeEmail(item.ownerEmail);
    const dueAt = parseDueDate(item.dueDate);
    if (!ownerEmail || !dueAt) continue;
    const assignee = await prisma.user.findUnique({
      where: { email: ownerEmail },
      select: { id: true, name: true, email: true, department: true, active: true },
    });
    if (!assignee?.active) continue;

    const title = `1-on-1: ${item.task}`.slice(0, 240);
    const existing = await prisma.followUpTask.findFirst({
      where: {
        memberId: session.memberId,
        sourceCallLogId: session.callLogId,
        title,
        status: { not: "cancelled" },
      },
      select: { id: true },
    });
    if (existing) continue;

    await prisma.followUpTask.create({
      data: {
        memberId: session.memberId,
        title,
        instructions: item.evidence,
        priority: "medium",
        status: "pending",
        dueAt,
        sourceType: "one_on_one",
        assignmentType: "transferred",
        sourceCallLogId: session.callLogId,
        assignedToUser: assignee.id,
        assignedToName: assignee.name,
        assignedToEmail: assignee.email,
        assignedToDepartment: assignee.department,
        createdByUser: session.coordinatorUserId,
        createdByName: session.coordinatorName,
        createdByEmail: session.coordinatorEmail,
        createdByDepartment: session.coordinatorDepartment,
      },
    });
  }
}

async function analyzeTranscript(sessionId: string) {
  const session = await prisma.oneOnOneSession.findUnique({
    where: { id: sessionId },
    include: { member: true },
  });
  if (!session?.transcriptText || !session.verifiedMinutes) return;

  const source: OneOnOneAnalysisSource = {
    member: {
      memberCode: session.member.memberCode,
      fullName: session.member.fullName,
      programType: session.member.programType,
      currentStage: session.member.currentStage,
      healthStatus: session.member.healthStatus,
    },
    session: {
      sessionNumber: session.sessionNumber,
      scheduledStart: session.scheduledStart.toISOString(),
      verifiedMinutes: session.verifiedMinutes,
      memberQuestions: session.memberQuestions,
      preparationNotes: session.preparationNotes,
      postMeetingNotes: session.postMeetingNotes,
    },
    transcript: session.transcriptText,
  };
  const sourceHash = oneOnOneAnalysisSourceHash(source);
  if (session.aiStatus === "ready" && session.aiSourceHash === sourceHash) return;

  await prisma.oneOnOneSession.update({
    where: { id: session.id },
    data: { aiStatus: "processing", aiSourceHash: sourceHash, lastError: null },
  });

  try {
    const result = await generateOneOnOneAnalysis(source);
    await prisma.oneOnOneSession.update({
      where: { id: session.id },
      data: {
        aiStatus: result.analysis.reviewRequired ? "review_required" : "ready",
        aiSummary: result.analysis.executiveSummary,
        aiAnalysisJson: JSON.stringify(result.analysis),
        aiSourceHash: result.sourceHash,
        aiProvider: result.provider,
        aiModel: result.model,
        lastError: result.analysis.reviewReason,
      },
    });
    await ensureAutomatedCallLog(session.id);
    await createVerifiedFollowUps(session.id, result.analysis);
  } catch (error) {
    await prisma.oneOnOneSession.update({
      where: { id: session.id },
      data: {
        aiStatus: "failed",
        lastError: error instanceof Error ? error.message : "AI analysis failed.",
      },
    });
  }
}

async function reconcileAttendance(sessionId: string) {
  const session = await prisma.oneOnOneSession.findUnique({
    where: { id: sessionId },
    include: { member: true },
  });
  if (!session) throw new Error("1-on-1 session no longer exists.");
  const meetingReference = session.zoomMeetingUuid || session.zoomMeetingId;
  if (!meetingReference) throw new Error("The session has no Zoom meeting reference.");

  await prisma.oneOnOneSession.update({
    where: { id: session.id },
    data: {
      status: session.status === "completed" ? "completed" : "processing",
      attendanceStatus: "processing",
      processingAttempts: { increment: 1 },
      lastProcessedAt: new Date(),
      lastError: null,
    },
  });

  const participants = await listPastMeetingParticipants(meetingReference);
  const segments = participants
    .map(normalizeParticipant)
    .filter((segment): segment is AttendanceSegment => Boolean(segment));
  const roles = selectAttendanceRoles(segments, session);
  if (roles.host.length === 0 || roles.member.length === 0) {
    const missing = [roles.host.length === 0 ? "host" : "", roles.member.length === 0 ? "member" : ""]
      .filter(Boolean)
      .join(" and ");
    await prisma.oneOnOneSession.update({
      where: { id: session.id },
      data: {
        status: "review_required",
        attendanceStatus: "review_required",
        attendanceMatchMethod: roles.matchMethod || null,
        attendanceJson: JSON.stringify({
          participantCount: participants.length,
          normalizedCount: segments.length,
          missing,
        }),
        lastError: `Could not securely identify the ${missing} in Zoom attendance.`,
      },
    });
    return false;
  }

  const overlap = overlapSeconds(roles.host, roles.member);
  if (overlap <= 0) {
    await prisma.oneOnOneSession.update({
      where: { id: session.id },
      data: {
        status: "review_required",
        attendanceStatus: "review_required",
        lastError: "Host and member attendance was found, but no overlapping time was recorded.",
      },
    });
    return false;
  }

  const hostKeys = new Set(roles.host.map((segment) => segment.participantKey));
  const memberKeys = new Set(roles.member.map((segment) => segment.participantKey));
  await prisma.oneOnOneAttendanceSegment.deleteMany({ where: { sessionId: session.id } });
  await prisma.oneOnOneAttendanceSegment.createMany({
    data: segments.map((segment) => ({
      sessionId: session.id,
      participantKey: segment.participantKey,
      participantId: segment.participantId,
      participantUserId: segment.participantUserId,
      participantName: segment.participantName,
      participantEmail: segment.participantEmail,
      participantRole: hostKeys.has(segment.participantKey)
        ? "host"
        : memberKeys.has(segment.participantKey)
          ? "member"
          : "other",
      joinAt: segment.joinAt,
      leaveAt: segment.leaveAt,
      durationSeconds: segment.durationSeconds,
      rawJson: JSON.stringify(segment.raw),
    })),
  });

  const actualStart = new Date(
    Math.min(...[...roles.host, ...roles.member].map((segment) => segment.joinAt.getTime())),
  );
  const actualEnd = new Date(
    Math.max(...[...roles.host, ...roles.member].map((segment) => segment.leaveAt.getTime())),
  );
  const verifiedMinutes = Math.max(1, Math.round(overlap / 60));
  await prisma.oneOnOneSession.update({
    where: { id: session.id },
    data: {
      status: "completed",
      attendanceStatus: "verified",
      attendanceMatchMethod: roles.matchMethod,
      attendanceJson: JSON.stringify({
        verifiedOverlapSeconds: overlap,
        hostSegments: roles.host.length,
        memberSegments: roles.member.length,
        participantCount: participants.length,
      }),
      actualStart,
      actualEnd,
      verifiedMinutes,
      completedAt: session.completedAt || new Date(),
      lastError: null,
    },
  });
  await ensureAutomatedCallLog(session.id);
  return true;
}

async function reconcileTranscript(sessionId: string) {
  const session = await prisma.oneOnOneSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      zoomMeetingUuid: true,
      zoomMeetingId: true,
      transcriptHash: true,
    },
  });
  if (!session) throw new Error("1-on-1 session no longer exists.");
  const meetingReference = session.zoomMeetingUuid || session.zoomMeetingId;
  if (!meetingReference) throw new Error("The session has no Zoom meeting reference.");

  await prisma.oneOnOneSession.update({
    where: { id: session.id },
    data: { transcriptStatus: "processing" },
  });
  const recordings = await getMeetingRecordings(meetingReference);
  const transcriptText = await downloadMeetingTranscript(meetingReference);
  const transcriptHash = createHash("sha256").update(transcriptText).digest("hex");
  await prisma.oneOnOneSession.update({
    where: { id: session.id },
    data: {
      transcriptStatus: "ready",
      transcriptText,
      transcriptHash,
      recordingJson: JSON.stringify({
        uuid: recordings.uuid,
        id: recordings.id,
        topic: recordings.topic,
        startTime: recordings.start_time,
        duration: recordings.duration,
        totalSize: recordings.total_size,
        recordingCount: recordings.recording_count,
        files: (recordings.recording_files || []).map((file) => ({
          id: file.id,
          fileType: file.file_type,
          fileExtension: file.file_extension,
          fileSize: file.file_size,
          recordingType: file.recording_type,
          status: file.status,
          playUrl: file.play_url,
        })),
      }),
      ...(session.transcriptHash !== transcriptHash
        ? { aiStatus: "pending", aiSourceHash: null }
        : {}),
      lastError: null,
    },
  });
  await analyzeTranscript(session.id);
}

export async function reconcileOneOnOneSession(
  sessionId: string,
  options: { includeTranscript?: boolean } = {},
) {
  let attendanceReady = false;
  try {
    attendanceReady = await reconcileAttendance(sessionId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Attendance processing failed.";
    await prisma.oneOnOneSession.update({
      where: { id: sessionId },
      data: {
        attendanceStatus:
          error instanceof ZoomDataNotReadyError ? "pending" : "unavailable",
        lastError: message,
      },
    });
    if (!(error instanceof ZoomDataNotReadyError)) throw error;
  }

  if (options.includeTranscript) {
    try {
      await reconcileTranscript(sessionId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Transcript processing failed.";
      await prisma.oneOnOneSession.update({
        where: { id: sessionId },
        data: {
          transcriptStatus:
            error instanceof ZoomDataNotReadyError ? "pending" : "failed",
          lastError: message,
        },
      });
      if (!(error instanceof ZoomDataNotReadyError)) throw error;
    }
  }

  const session = await prisma.oneOnOneSession.findUnique({
    where: { id: sessionId },
    select: { memberId: true },
  });
  if (session) {
    revalidatePath(`/workspace/${session.memberId}`);
    revalidatePath(`/members/${session.memberId}`);
    revalidatePath("/dashboard");
    revalidatePath("/followups");
  }
  return { attendanceReady };
}

export async function processZoomWebhookEvent(eventId: string) {
  const event = await prisma.zoomWebhookEvent.findUnique({ where: { id: eventId } });
  if (!event || event.status === "processed" || event.status === "ignored") return;
  await prisma.zoomWebhookEvent.update({
    where: { id: event.id },
    data: { status: "processing", attempts: { increment: 1 }, lastError: null },
  });

  try {
    const payload = JSON.parse(event.payloadJson) as unknown;
    const root = asRecord(payload);
    const object = zoomObjectFromPayload(root);
    const session = await findSessionForZoomObject(object);
    if (!session) {
      await prisma.zoomWebhookEvent.update({
        where: { id: event.id },
        data: { status: "ignored", processedAt: new Date() },
      });
      return;
    }

    await prisma.zoomWebhookEvent.update({
      where: { id: event.id },
      data: { sessionId: session.id },
    });
    const occurredAt = event.eventTimestamp || new Date();

    if (event.eventType === "meeting.started") {
      await prisma.oneOnOneSession.update({
        where: { id: session.id },
        data: { status: "started", actualStart: session.actualStart || occurredAt },
      });
    } else if (event.eventType === "meeting.ended") {
      await prisma.oneOnOneSession.update({
        where: { id: session.id },
        data: { status: "processing", actualEnd: occurredAt },
      });
      await reconcileOneOnOneSession(session.id);
    } else if (event.eventType === "recording.completed") {
      await reconcileOneOnOneSession(session.id, { includeTranscript: true });
    }

    await prisma.zoomWebhookEvent.update({
      where: { id: event.id },
      data: { status: "processed", processedAt: new Date(), lastError: null },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Zoom event processing failed.";
    await prisma.zoomWebhookEvent.update({
      where: { id: event.id },
      data: { status: "failed", lastError: message },
    });
    console.error(`Zoom webhook event ${event.id} failed:`, error);
  }
}
