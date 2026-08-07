"use server";

import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { isElevatedViewer, normalizeDepartment } from "@/lib/authorization";

export async function getUsersByDepartment(department: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");
  const requestedDepartment = normalizeDepartment(department);
  if (
    !isElevatedViewer(session.user) &&
    requestedDepartment !== normalizeDepartment(session.user.department)
  ) throw new Error("You can only view staff in your own department");

  const users = await prisma.user.findMany({
    where: {
      department: { equals: requestedDepartment, mode: "insensitive" },
      active: true,
    },
    select: { id: true, name: true, email: true },
  });

  return users;
}
