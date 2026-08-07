"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";
import {
  normalizeCommunicationMedium,
  type MediumId,
} from "@/lib/membershipUtils";

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
]);

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (
    !session?.user ||
    !["admin", "superadmin"].includes(
      session.user.role?.trim().toLowerCase() || "",
    )
  ) {
    throw new Error("Only administrators can edit communication history.");
  }
  return session.user;
}

export async function getContactAttributionStaff() {
  const admin = await requireAdmin();
  const staff = await prisma.user.findMany({
    where: { active: true },
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
    currentAdminId: admin.id || "",
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
}) {
  const admin = await requireAdmin();

  if (
    !OBJECT_ID_PATTERN.test(input.callLogId) ||
    !OBJECT_ID_PATTERN.test(input.staffUserId)
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
  const duration = Math.max(0, Math.min(1440, Math.round(Number(input.duration) || 0)));
  if (!outcome || !notes) {
    return { success: false, error: "Outcome and communication notes are required." };
  }

  const [existingLog, staff] = await Promise.all([
    prisma.callLog.findUnique({
      where: { id: input.callLogId },
      select: { id: true, memberId: true },
    }),
    prisma.user.findFirst({
      where: { id: input.staffUserId, active: true },
      select: { id: true, name: true, email: true, department: true },
    }),
  ]);
  if (!existingLog) return { success: false, error: "Communication record not found." };
  if (!staff) return { success: false, error: "Active contacted-by staff member not found." };

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
      editedByName: admin.name || "Administrator",
      editedByEmail: admin.email || "",
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

  revalidatePath(`/members/${existingLog.memberId}`);
  revalidatePath("/members");
  revalidatePath("/calls");
  revalidatePath("/followups");
  revalidatePath("/dashboard");

  return { success: true };
}
