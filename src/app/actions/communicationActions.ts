"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";
import {
  normalizeCommunicationMedium,
  type MediumId,
} from "@/lib/membershipUtils";
import { syncMemberBackground } from "@/lib/memberBackground";
import { canManageDepartment, isAdminViewer, normalizeDepartment } from "@/lib/authorization";

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;
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

async function requireStaffUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    throw new Error("You must be logged in to edit communication history.");
  }
  return session.user;
}

function canManageCommunication(
  user: Awaited<ReturnType<typeof requireStaffUser>>,
  log: {
    staffUserId?: string | null;
    staffEmail?: string | null;
    staffDepartment?: string | null;
  },
) {
  if (isAdminViewer(user)) return true;
  if (canManageDepartment(user, log.staffDepartment)) return true;
  return Boolean(
    (user.id && log.staffUserId === user.id) ||
      (user.email &&
        log.staffEmail?.trim().toLowerCase() === user.email.trim().toLowerCase()),
  );
}

export async function getContactAttributionStaff() {
  const user = await requireStaffUser();
  const isAdmin = isAdminViewer(user);
  const department = normalizeDepartment(user.department);
  const staff = await prisma.user.findMany({
    where: {
      active: true,
      ...(isAdmin
        ? {}
        : { department: { equals: department, mode: "insensitive" as const } }),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
    },
    orderBy: [{ department: "asc" }, { name: "asc" }],
  });

  return {
    currentAdminId: user.id || "",
    staff,
  };
}

export async function updateCommunicationLog(input: {
  callLogId: string;
  contactedAt: string;
  type: "inbound" | "outbound";
  medium: string;
  outcome: string;
  duration: number;
  notes: string;
  staffUserId: string;
  editReason: string;
}) {
  const editor = await requireStaffUser();

  if (
    !OBJECT_ID_PATTERN.test(input.callLogId) ||
    (input.staffUserId && !OBJECT_ID_PATTERN.test(input.staffUserId))
  ) {
    return { success: false, error: "Invalid communication or staff member." };
  }
  const medium = normalizeCommunicationMedium(input.medium);
  if (!medium || !VALID_MEDIA.has(medium)) {
    return { success: false, error: "Invalid communication medium." };
  }
  if (!new Set(["inbound", "outbound"]).has(input.type)) {
    return { success: false, error: "Invalid communication direction." };
  }

  const contactedAt = new Date(input.contactedAt);
  if (Number.isNaN(contactedAt.getTime()) || contactedAt.getTime() > Date.now() + 5 * 60_000) {
    return { success: false, error: "Please choose a valid communication time." };
  }

  const outcome = input.outcome?.trim().slice(0, 200);
  const notes = input.notes?.trim().slice(0, 4000);
  const editReason = input.editReason?.trim().slice(0, 1000);
  const duration = Math.max(0, Math.min(1440, Math.round(Number(input.duration) || 0)));
  if (!outcome || !notes) {
    return { success: false, error: "Outcome and communication notes are required." };
  }
  if (!editReason) {
    return { success: false, error: "Edit reason is required for audit history." };
  }

  const [existingLog, staff] = await Promise.all([
    prisma.callLog.findUnique({
      where: { id: input.callLogId },
      select: {
        id: true,
        memberId: true,
        staffUserId: true,
        staffEmail: true,
        staffDepartment: true,
        source: true,
      },
    }),
    prisma.user.findFirst({
      where: { id: input.staffUserId || editor.id || "", active: true },
      select: { id: true, name: true, email: true, department: true },
    }),
  ]);
  if (!existingLog) return { success: false, error: "Communication record not found." };
  if (!staff) return { success: false, error: "Active contacted-by staff member not found." };
  if (!canManageCommunication(editor, existingLog)) {
    return { success: false, error: "You can edit only your own or your department's communication logs." };
  }
  if (existingLog.source && existingLog.source !== "manual" && !isAdminViewer(editor)) {
    return { success: false, error: "Only administrators can edit automated communication records." };
  }
  if (!isAdminViewer(editor) && staff.id !== existingLog.staffUserId && staff.id !== editor.id) {
    return { success: false, error: "Only administrators can change who contacted the member." };
  }

  await prisma.callLog.update({
    where: { id: existingLog.id },
    data: {
      date: contactedAt,
      type: input.type,
      medium,
      outcome,
      duration,
      notes,
      staffUserId: staff.id,
      staffName: staff.name,
      staffEmail: staff.email,
      staffDepartment: staff.department,
      editedAt: new Date(),
      editedByName: editor.name || "Staff Member",
      editedByEmail: editor.email || "",
      editedReason: editReason,
    },
  });

  const latestLog = await prisma.callLog.findFirst({
    where: { memberId: existingLog.memberId },
    orderBy: { date: "desc" },
    select: {
      date: true,
      medium: true,
      staffName: true,
    },
  });
  if (latestLog) {
    await prisma.member.update({
      where: { id: existingLog.memberId },
      data: {
        lastConnectDate: latestLog.date,
        lastContactMedium:
          normalizeCommunicationMedium(latestLog.medium) || latestLog.medium,
        lastContactStaff: latestLog.staffName,
      },
    });
  }

  await syncMemberBackground(existingLog.memberId);

  revalidatePath(`/members/${existingLog.memberId}`);
  revalidatePath("/members");
  revalidatePath("/calls");
  revalidatePath("/followups");
  revalidatePath("/dashboard");

  return { success: true };
}

export async function deleteCommunicationLog(callLogId: string) {
  const editor = await requireStaffUser();
  if (!isAdminViewer(editor)) {
    return { success: false, error: "Only administrators can delete communication logs." };
  }
  if (!OBJECT_ID_PATTERN.test(callLogId)) {
    return { success: false, error: "Invalid communication record." };
  }

  const existingLog = await prisma.callLog.findUnique({
    where: { id: callLogId },
    select: {
      id: true,
      memberId: true,
      staffUserId: true,
      staffEmail: true,
      staffDepartment: true,
      source: true,
    },
  });
  if (!existingLog) return { success: false, error: "Communication record not found." };
  await prisma.callLog.delete({ where: { id: existingLog.id } });

  const latestLog = await prisma.callLog.findFirst({
    where: { memberId: existingLog.memberId },
    orderBy: { date: "desc" },
    select: { date: true, medium: true, staffName: true },
  });
  await prisma.member.update({
    where: { id: existingLog.memberId },
    data: latestLog
      ? {
          lastConnectDate: latestLog.date,
          lastContactMedium:
            normalizeCommunicationMedium(latestLog.medium) || latestLog.medium,
          lastContactStaff: latestLog.staffName,
        }
      : {
          lastConnectDate: null,
          lastContactMedium: null,
          lastContactStaff: null,
        },
  });
  await syncMemberBackground(existingLog.memberId);

  revalidatePath(`/members/${existingLog.memberId}`);
  revalidatePath("/members");
  revalidatePath("/calls");
  revalidatePath("/followups");
  revalidatePath("/dashboard");

  return { success: true };
}
