import "server-only";

import { prisma } from "@/lib/db";
import { resolvePermissions, type Capability } from "@/lib/accessControl";

export async function hasUserCapability(
  user: { id?: string; role?: string | null },
  capability: Capability,
) {
  if (!user.id) return false;
  const sessionRole = user.role?.trim().toLowerCase();
  if (sessionRole === "owner") return true;
  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      role: true,
      permissionOverrides: true,
      permissionRole: { select: { permissionsJson: true } },
    },
  });
  if (!record) return false;
  const normalizedRole = record.role?.trim().toLowerCase() || sessionRole || "employee";
  if (normalizedRole === "owner") return true;
  const template = record.permissionRole
    ? null
    : await prisma.permissionRole.findUnique({
        where: { key: normalizedRole },
        select: { permissionsJson: true },
      });
  return resolvePermissions(
    normalizedRole,
    record.permissionRole?.permissionsJson || template?.permissionsJson,
    record.permissionOverrides,
  )[capability] === true;
}
