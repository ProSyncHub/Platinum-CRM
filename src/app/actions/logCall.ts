"use server";

import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { revalidatePath } from "next/cache";
import { canAccessMember, normalizeDepartment } from "@/lib/authorization";
import { syncMemberBackground } from "@/lib/memberBackground";

export async function logCall(data: {
  memberId: string;
  type: string;
  outcome: string;
  notes: string;
  transferQuery: boolean;
  toDepartment?: string;
  assignedToUser?: string;
  reason?: string;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const { memberId, type, outcome, notes, transferQuery, toDepartment, assignedToUser, reason } = data;
  if (!(await canAccessMember(session.user, memberId))) {
    throw new Error("You do not have access to this member");
  }

  await prisma.callLog.create({
    data: {
      memberId,
      type,
      outcome,
      notes,
      staffName: session.user.name || undefined,
      staffEmail: session.user.email || undefined,
      staffDepartment: normalizeDepartment(session.user.department),
    },
  });

  await prisma.member.update({
    where: { id: memberId },
    data: {
      lastConnectDate: new Date(),
      ...(assignedToUser ? { allotedTo: assignedToUser } : {}),
    },
  });

  if (transferQuery && toDepartment && reason) {
    await prisma.queryTransfer.create({
      data: {
        memberId,
        fromDepartment: normalizeDepartment(session.user.department),
        toDepartment: normalizeDepartment(toDepartment),
        assignedToUser: assignedToUser || null,
        reason,
        status: "pending",
      },
    });
  }

  await syncMemberBackground(memberId);

  revalidatePath(`/members/${memberId}`);
  revalidatePath("/members");
  revalidatePath("/dashboard");
  return { success: true };
}
