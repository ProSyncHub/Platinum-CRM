"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";
import {
  CAPABILITIES,
  ROLE_DEFAULTS,
  resolvePermissions,
  type AccessRole,
  type Capability,
  type PermissionMap,
} from "@/lib/accessControl";
import { hasUserCapability } from "@/lib/accessControl.server";

const ROLES: AccessRole[] = ["owner", "admin", "manager", "employee"];
const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

const ROLE_DETAILS: Record<AccessRole, { name: string; description: string; scope: string }> = {
  owner: { name: "Owner", description: "Full organization control. This role cannot be limited.", scope: "organization" },
  admin: { name: "Admin", description: "Organization-wide CRM operations, configurable by the Owner.", scope: "organization" },
  manager: { name: "Manager", description: "Department leadership and assigned-work coordination.", scope: "department" },
  employee: { name: "Employee", description: "Member journey work and items assigned to them.", scope: "assigned_work" },
};

async function viewer() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user;
}

function isOwner(user: { role?: string | null }) {
  return user.role?.trim().toLowerCase() === "owner";
}

function safePermissions(permissions: PermissionMap) {
  return Object.fromEntries(
    CAPABILITIES.filter(([key]) => typeof permissions[key] === "boolean").map(([key]) => [key, permissions[key]]),
  ) as PermissionMap;
}

async function ensureRoleTemplates() {
  await Promise.all(
    ROLES.map((key) => {
      const detail = ROLE_DETAILS[key];
      return prisma.permissionRole.upsert({
        where: { key },
        update: {},
        create: {
          key,
          name: detail.name,
          description: detail.description,
          scope: detail.scope,
          permissionsJson: JSON.stringify(ROLE_DEFAULTS[key]),
          system: true,
        },
      });
    }),
  );
}

function refreshAccessViews() {
  revalidatePath("/team");
  revalidatePath("/workspace");
  revalidatePath("/dashboard");
  revalidatePath("/members");
}

export async function getAccessControlSettings() {
  const current = await viewer();
  const currentRole = current.role?.toLowerCase();
  if (!["owner", "admin", "superadmin"].includes(currentRole || "")) throw new Error("Forbidden");
  await ensureRoleTemplates();
  const [roles, users] = await Promise.all([
    prisma.permissionRole.findMany({ orderBy: { key: "asc" } }),
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        active: true,
        permissionRoleId: true,
        permissionRoleIds: true,
        permissionOverrides: true,
      },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    }),
  ]);
  return { currentUserId: current.id, hasOwner: users.some((user) => user.role === "owner"), users, roles };
}

export async function claimInitialOwner() {
  const current = await viewer();
  if (!["owner", "admin", "superadmin"].includes(current.role?.toLowerCase() || "")) {
    return { success: false, error: "Only an existing administrator can complete first-time Owner setup." };
  }
  const owner = await prisma.user.findFirst({ where: { role: "owner" }, select: { id: true } });
  if (owner) return { success: false, error: "An Owner account already exists." };
  await ensureRoleTemplates();
  const ownerRole = await prisma.permissionRole.findUniqueOrThrow({ where: { key: "owner" }, select: { id: true } });
  await prisma.user.update({ where: { id: current.id }, data: { role: "owner", permissionRoleId: ownerRole.id, permissionRoleIds: [ownerRole.id], permissionOverrides: null } });
  refreshAccessViews();
  return { success: true };
}

export async function saveRoleTemplate(
  roleId: string,
  input: { name: string; description: string; permissions: PermissionMap },
) {
  const current = await viewer();
  if (!isOwner(current)) return { success: false, error: "Only the Owner can edit role templates." };
  const role = await prisma.permissionRole.findUnique({ where: { id: roleId }, select: { key: true } });
  if (!role || !ROLES.includes(role.key as AccessRole)) return { success: false, error: "Role template not found." };
  if (role.key === "owner") return { success: false, error: "Owner access is always unrestricted." };
  const name = input.name.trim();
  if (!name) return { success: false, error: "Role name is required." };
  await prisma.permissionRole.update({
    where: { id: roleId },
    data: {
      name,
      description: input.description.trim() || null,
      permissionsJson: JSON.stringify(safePermissions(input.permissions)),
    },
  });
  refreshAccessViews();
  return { success: true };
}

export async function assignRolesToUser(userId: string, roleIds: string[]) {
  const current = await viewer();
  if (!isOwner(current)) return { success: false, error: "Only the Owner can assign CRM roles." };
  const cleanRoleIds = Array.from(new Set(roleIds.filter((id) => OBJECT_ID_PATTERN.test(id))));
  if (!cleanRoleIds.length) return { success: false, error: "Choose at least one role." };
  const roles = await prisma.permissionRole.findMany({
    where: { id: { in: cleanRoleIds } },
    select: { id: true, key: true, name: true },
  });
  if (roles.length !== cleanRoleIds.length || roles.some((role) => !ROLES.includes(role.key as AccessRole))) {
    return { success: false, error: "Choose valid CRM roles." };
  }
  if (roles.some((role) => role.key === "owner")) {
    return { success: false, error: "Owner can only be set through first-time Owner setup." };
  }
  if (userId === current.id) return { success: false, error: "The active Owner cannot edit their own Owner access." };
  const primaryRole = roles.find((role) => role.key === "admin") || roles.find((role) => role.key === "manager") || roles[0];
  await prisma.user.update({
    where: { id: userId },
    data: {
      role: primaryRole.key,
      permissionRoleId: primaryRole.id,
      permissionRoleIds: roles.map((role) => role.id),
      permissionOverrides: null,
    },
  });
  refreshAccessViews();
  return { success: true, message: `Roles assigned: ${roles.map((role) => role.name).join(", ")}` };
}

export async function assignRoleToUser(userId: string, roleId: string) {
  return assignRolesToUser(userId, [roleId]);
}

export async function saveIndividualPermissionOverrides(userId: string, overrides: PermissionMap) {
  const current = await viewer();
  if (!isOwner(current)) return { success: false, error: "Only the Owner can create individual exceptions." };
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      permissionRoleId: true,
      permissionRoleIds: true,
      permissionRole: { select: { permissionsJson: true } },
    },
  });
  if (!target) return { success: false, error: "Staff member not found." };
  if (target.role === "owner") return { success: false, error: "Owner access is always unrestricted." };
  const roleIds = Array.from(new Set([...(target.permissionRoleIds || []), target.permissionRoleId].filter(Boolean))) as string[];
  const inheritedRoles = await prisma.permissionRole.findMany({
    where: {
      OR: [
        ...(roleIds.length ? [{ id: { in: roleIds } }] : []),
        { key: target.role.trim().toLowerCase() },
      ],
    },
    select: { permissionsJson: true },
  });
  const inherited = resolvePermissions(target.role, inheritedRoles.map((role) => role.permissionsJson));
  const exceptionOnly = Object.fromEntries(
    CAPABILITIES.flatMap(([key]) => {
      const value = overrides[key];
      if (typeof value !== "boolean" || value === inherited[key]) return [];
      return [[key, value]];
    }),
  ) as PermissionMap;
  await prisma.user.update({
    where: { id: userId },
    data: {
      permissionOverrides: Object.keys(exceptionOnly).length
        ? JSON.stringify(exceptionOnly)
        : null,
    },
  });
  refreshAccessViews();
  return { success: true };
}

export async function hasCapabilityForCurrentUser(capability: Capability) {
  const current = await viewer();
  return hasUserCapability(current, capability);
}
