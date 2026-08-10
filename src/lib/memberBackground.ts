import "server-only";

import { prisma } from "@/lib/db";

export const AUTO_BACKGROUND_MARKER = "AUTO-GENERATED CRM SUMMARY";

interface CommunicationForBackground {
  date: Date | string;
  medium: string;
  outcome: string;
  notes: string;
  staffName?: string | null;
  staffDepartment?: string | null;
}

interface DepartmentUpdateForBackground {
  createdAt: Date | string;
  department: string;
  status: string;
  summary: string;
  details?: string | null;
  nextStep?: string | null;
  updatedByName: string;
}

interface BackgroundInput {
  existingNotes?: string | null;
  manualBackground?: string | null;
  communications: CommunicationForBackground[];
  departmentUpdates: DepartmentUpdateForBackground[];
}

function asTimestamp(value: Date | string) {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(value instanceof Date ? value : new Date(value));
}

function label(value?: string | null) {
  return (value || "Not set")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function legacyBackground(existingNotes?: string | null) {
  const notes = existingNotes?.trim() || "";
  return notes && !notes.startsWith(AUTO_BACKGROUND_MARKER) ? notes : "";
}

function originalBackgroundText(
  manualBackground?: string | null,
  existingNotes?: string | null,
) {
  const manual = manualBackground?.trim() || "";
  const legacy = legacyBackground(existingNotes);
  if (!manual) return legacy;
  if (!legacy || manual.includes(legacy)) return manual;
  return `${manual}\n${legacy}`;
}

/**
 * Produces one concise operational summary: the latest verified customer
 * conversation for every department and the latest status update owned by
 * every department. Historical events remain available in the journey timeline.
 */
export function composeMemberBackground({
  existingNotes,
  manualBackground,
  communications,
  departmentUpdates,
}: BackgroundInput) {
  const customerCommunications = communications
    .filter((communication) => communication.medium.toLowerCase() !== "internal")
    .toSorted((left, right) => asTimestamp(right.date) - asTimestamp(left.date));

  const latestDepartmentConversations = new Map<string, CommunicationForBackground>();
  for (const communication of customerCommunications) {
    const department = (communication.staffDepartment || "unassigned").trim().toLowerCase();
    if (!latestDepartmentConversations.has(department)) {
      latestDepartmentConversations.set(department, communication);
    }
  }

  const latestDepartmentUpdates = new Map<string, DepartmentUpdateForBackground>();
  for (const update of departmentUpdates.toSorted(
    (left, right) => asTimestamp(right.createdAt) - asTimestamp(left.createdAt),
  )) {
    const department = update.department.trim().toLowerCase();
    if (!latestDepartmentUpdates.has(department)) {
      latestDepartmentUpdates.set(department, update);
    }
  }

  const sections: string[] = [AUTO_BACKGROUND_MARKER];

  if (latestDepartmentConversations.size > 0) {
    const conversationLines = Array.from(latestDepartmentConversations.entries()).map(
      ([department, communication]) =>
        [
          `${label(department)} · ${formatDate(communication.date)} · ${label(communication.medium)} · ${communication.outcome}`,
          `By ${communication.staffName || "Staff Member"}`,
          `Discussed: ${communication.notes}`,
        ].join("\n"),
    );
    sections.push(
      ["LATEST CUSTOMER CONVERSATION BY DEPARTMENT", ...conversationLines].join("\n\n"),
    );
  }

  if (latestDepartmentUpdates.size > 0) {
    const departmentLines = Array.from(latestDepartmentUpdates.values()).map((update) =>
      [
        `${label(update.department)} · ${label(update.status)}: ${update.summary}`,
        update.details || "",
        update.nextStep ? `Next step: ${update.nextStep}` : "",
        `Updated by ${update.updatedByName} on ${formatDate(update.createdAt)}`,
      ]
        .filter(Boolean)
        .join("\n"),
    );
    sections.push(["LATEST DEPARTMENT UPDATES", ...departmentLines].join("\n\n"));
  }

  const background = originalBackgroundText(manualBackground, existingNotes);
  if (background) sections.push(`ORIGINAL MEMBER BACKGROUND\n${background}`);

  if (sections.length === 1) {
    sections.push("No verified communication or department update has been recorded yet.");
  }

  return sections.join("\n\n");
}

export async function syncMemberBackground(memberId: string) {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: {
      notes: true,
      detailedNotes: true,
      callLogs: {
        where: { medium: { not: "internal" } },
        orderBy: { date: "desc" },
        take: 250,
        select: {
          date: true,
          medium: true,
          outcome: true,
          notes: true,
          staffName: true,
          staffDepartment: true,
        },
      },
      departmentUpdates: {
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          createdAt: true,
          department: true,
          status: true,
          summary: true,
          details: true,
          nextStep: true,
          updatedByName: true,
        },
      },
    },
  });
  if (!member) return null;

  const originalBackground =
    originalBackgroundText(member.detailedNotes, member.notes) || null;
  const summary = composeMemberBackground({
    existingNotes: member.notes,
    manualBackground: originalBackground,
    communications: member.callLogs,
    departmentUpdates: member.departmentUpdates,
  });

  const backgroundChanged =
    Boolean(originalBackground) && member.detailedNotes?.trim() !== originalBackground;
  if (member.notes !== summary || backgroundChanged) {
    await prisma.member.update({
      where: { id: memberId },
      data: {
        notes: summary,
        ...(backgroundChanged ? { detailedNotes: originalBackground } : {}),
      },
    });
  }

  return summary;
}
