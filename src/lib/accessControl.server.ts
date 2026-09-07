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
      id: true,
      role: true,
      permissionRoleId: true,
      permissionRoleIds: true,
      permissionOverrides: true,
      permissionRole: { select: { permissionsJson: true } },
    },
  });
  if (!record) return false;
  const normalizedRole = record.role?.trim().toLowerCase() || sessionRole || "employee";
  if (normalizedRole === "owner") return true;
  const roleIds = Array.from(new Set([...(record.permissionRoleIds || []), record.permissionRoleId].filter(Boolean))) as string[];
  const templates = await prisma.permissionRole.findMany({
    where: {
      OR: [
        ...(roleIds.length ? [{ id: { in: roleIds } }] : []),
        { key: normalizedRole },
      ],
    },
    select: { key: true, permissionsJson: true },
  });
  if (templates.some((template) => template.key === "owner")) return true;
  return resolvePermissions(
    normalizedRole,
    templates.map((template) => template.permissionsJson),
    record.permissionOverrides,
  )[capability] === true;
}
