"use server";

import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { revalidatePath } from "next/cache";

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

  await prisma.callLog.create({
    data: {
      memberId,
      type,
      outcome,
      notes,
    },
  });

  if (transferQuery && toDepartment && reason) {
    await prisma.queryTransfer.create({
      data: {
        memberId,
        fromDepartment: session.user.department,
        toDepartment,
        assignedToUser: assignedToUser || null,
        reason,
        status: "pending",
      },
    });

    // Optionally update the member's assigned executive for that department
    if (assignedToUser) {
      if (toDepartment === "ecom") {
        await prisma.member.update({ where: { id: memberId }, data: { assignedEcomExecutive: assignedToUser } });
      } else if (toDepartment === "brand") {
        await prisma.member.update({ where: { id: memberId }, data: { assignedBrandExecutive: assignedToUser } });
      } else if (toDepartment === "follow_up") {
        await prisma.member.update({ where: { id: memberId }, data: { assignedFollowUpExecutive: assignedToUser } });
      } else if (toDepartment === "manager") {
        await prisma.member.update({ where: { id: memberId }, data: { assignedManager: assignedToUser } });
      }
    }
  }

  revalidatePath(`/dashboard/members/${memberId}`);
  return { success: true };
}
