import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export interface Viewer {
  id?: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  department?: string | null;
}

export function normalizeDepartment(department?: string | null) {
  return (department || "operations").trim().toLowerCase();
}

export function isElevatedViewer(user?: Viewer | null) {
  const role = user?.role?.trim().toLowerCase();
  return role === "admin" || role === "superadmin" || role === "manager";
}

/**
 * Row-level member scope. Employees can see members owned by their department
 * and complete journeys for members formally routed to/from their department.
 * Admins and managers retain organization-wide oversight.
 */
export function memberScopeFor(user: Viewer): Prisma.MemberWhereInput {
  if (isElevatedViewer(user)) return {};

  const department = normalizeDepartment(user.department);
  const departmentMatch: Prisma.StringNullableFilter<"Member"> = {
    equals: department,
    mode: "insensitive",
  };

  return {
    OR: [
      { department: departmentMatch },
      ...(department === "operations" ? [{ department: null }] : []),
      {
        queryTransfers: {
          some: {
            OR: [
              { toDepartment: { equals: department, mode: "insensitive" } },
              { fromDepartment: { equals: department, mode: "insensitive" } },
            ],
          },
        },
      },
      ...(user.id
        ? [
            {
              followUpTasks: {
                some: {
                  assignedToUser: user.id,
                  status: { in: ["pending", "in_progress"] },
                },
              },
            },
          ]
        : []),
    ],
  };
}

export async function canAccessMember(user: Viewer, memberId: string) {
  const member = await prisma.member.findFirst({
    where: { AND: [{ id: memberId }, memberScopeFor(user)] },
    select: { id: true },
  });
  return Boolean(member);
}
