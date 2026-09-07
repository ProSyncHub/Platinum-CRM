export const CAPABILITIES = [
  ["members.view", "View member journeys"],
  ["members.edit", "Edit member details"],
  ["communications.log", "Log communications"],
  ["communications.edit_department", "Edit department communication logs"],
  ["transfers.create", "Transfer work to another team"],
  ["tasks.assign", "Assign and reassign work"],
  ["calls.view_department", "View department call activity"],
  ["reports.view", "View reports"],
  ["leads.manage", "Manage leads"],
  ["leads.wati", "Access WATI leads"],
  ["leads.assign", "Assign WATI leads"],
  ["programs.manage", "Manage programs and partner services"],
  ["team.manage", "Manage team members"],
  ["sessions.manage", "Schedule and manage 1-on-1 sessions"],
] as const;

export type Capability = (typeof CAPABILITIES)[number][0];
export type PermissionMap = Partial<Record<Capability, boolean>>;
export type AccessRole = "owner" | "admin" | "manager" | "employee";

const all = Object.fromEntries(CAPABILITIES.map(([key]) => [key, true])) as PermissionMap;

export const ROLE_DEFAULTS: Record<AccessRole, PermissionMap> = {
  owner: all,
  admin: { ...all, "team.manage": false },
  manager: {
    "members.view": true,
    "members.edit": true,
    "communications.log": true,
    "communications.edit_department": true,
    "transfers.create": true,
    "tasks.assign": true,
    "calls.view_department": true,
    "reports.view": true,
    "sessions.manage": true,
  },
  employee: {
    "members.view": true,
    "communications.log": true,
    "transfers.create": true,
  },
};

export function parsePermissionOverrides(value?: string | null): PermissionMap {
  if (!value) return {};
  try {
    const raw = JSON.parse(value) as Record<string, unknown>;
    return Object.fromEntries(
      CAPABILITIES.filter(([key]) => typeof raw[key] === "boolean").map(([key]) => [key, raw[key]]),
    ) as PermissionMap;
  } catch {
    return {};
  }
}

export function effectivePermissions(role: string | null | undefined, overrides?: string | null): PermissionMap {
  const normalized = (role || "employee").toLowerCase() as AccessRole;
  return { ...(ROLE_DEFAULTS[normalized] || ROLE_DEFAULTS.employee), ...parsePermissionOverrides(overrides) };
}

export function resolvePermissions(
  role: string | null | undefined,
  rolePermissions?: string | string[] | null,
  individualOverrides?: string | null,
): PermissionMap {
  const normalized = (role || "employee").toLowerCase() as AccessRole;
  const rolePermissionList = Array.isArray(rolePermissions) ? rolePermissions : rolePermissions ? [rolePermissions] : [];
  return {
    ...(ROLE_DEFAULTS[normalized] || ROLE_DEFAULTS.employee),
    ...Object.assign({}, ...rolePermissionList.map((permissions) => parsePermissionOverrides(permissions))),
    ...parsePermissionOverrides(individualOverrides),
  };
}
