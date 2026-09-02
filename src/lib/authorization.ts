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
  return role === "owner" || role === "admin" || role === "superadmin" || role === "manager";
}

export function isAdminViewer(user?: Viewer | null) {
  const role = user?.role?.trim().toLowerCase();
  return role === "owner" || role === "admin" || role === "superadmin";
}

export function isManagerViewer(user?: Viewer | null) {
  return user?.role?.trim().toLowerCase() === "manager";
}

export function canManageDepartment(user: Viewer, department?: string | null) {
  if (isAdminViewer(user)) return true;
  if (!isManagerViewer(user)) return false;
  return normalizeDepartment(user.department) === normalizeDepartment(department);
}

/**
 * Every authenticated CRM employee can find members and read their complete
 * journey. Mutation permissions remain enforced separately at each server
 * action so visibility never grants another department's edit rights.
 */
export function memberScopeFor(user: Viewer): Prisma.MemberWhereInput {
  void user;
  return {};
}

export async function canAccessMember(user: Viewer, memberId: string) {
  const member = await prisma.member.findFirst({
    where: { AND: [{ id: memberId }, memberScopeFor(user)] },
    select: { id: true },
  });
  return Boolean(member);
}
