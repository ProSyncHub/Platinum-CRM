"use server";

import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function getUsersByDepartment(department: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const users = await prisma.user.findMany({
    where: { department, active: true },
    select: { id: true, name: true, email: true },
  });

  return users;
}
