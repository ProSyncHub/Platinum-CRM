"use client";

import { useMemo, useState } from "react";
import { BadgeCheck, Crown, ShieldCheck, UsersRound } from "lucide-react";
import { toast } from "sonner";
import {
  CAPABILITIES,
  parsePermissionOverrides,
  resolvePermissions,
  type PermissionMap,
} from "@/lib/accessControl";
import {
  assignRolesToUser,
  claimInitialOwner,
  saveIndividualPermissionOverrides,
  saveRoleTemplate,
} from "@/app/actions/accessControlActions";

type RoleTemplate = {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  scope: string;
  permissionsJson: string;
};

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  active: boolean;
  permissionRoleId?: string | null;
  permissionRoleIds?: string[];
  permissionOverrides?: string | null;
};

function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function AccessControlPanel({
  users: initialUsers,
  roles: initialRoles,
  currentUserId,
  hasOwner,
}: {
  users: User[];
  roles: RoleTemplate[];
  currentUserId: string;
  hasOwner: boolean;
}) {
  const [users, setUsers] = useState(initialUsers);
  const [roles, setRoles] = useState(initialRoles);
  const [roleId, setRoleId] = useState(initialRoles.find((role) => role.key === "admin")?.id || initialRoles[0]?.id || "");
  const [userId, setUserId] = useState(initialUsers[0]?.id || "");
  const [savingRole, setSavingRole] = useState(false);
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [savingException, setSavingException] = useState(false);

  const selectedRole = roles.find((role) => role.id === roleId);
  const selectedUser = users.find((user) => user.id === userId);
  const owner = users.find((user) => user.id === currentUserId);
  const canConfigure = hasOwner && owner?.role?.trim().toLowerCase() === "owner";
  const assignableRoles = roles.filter((role) => role.key !== "owner");
  const visibleAssignmentRoles = selectedUser?.role === "owner" ? roles : assignableRoles;
  const [roleName, setRoleName] = useState(selectedRole?.name || "");
  const [roleDescription, setRoleDescription] = useState(selectedRole?.description || "");
  const [rolePermissions, setRolePermissions] = useState<PermissionMap>(parsePermissionOverrides(selectedRole?.permissionsJson));
  const [assignmentRoleIds, setAssignmentRoleIds] = useState<string[]>(() => selectedUser ? roleIdsForUser(selectedUser, roles) : []);
  const [overrides, setOverrides] = useState<PermissionMap>(parsePermissionOverrides(selectedUser?.permissionOverrides));

  const inheritedPermissions = useMemo(() => {
    const selectedRoles = roles.filter((item) => assignmentRoleIds.includes(item.id));
    return resolvePermissions(
      selectedRoles[0]?.key || selectedUser?.role,
      selectedRoles.map((role) => role.permissionsJson),
    );
  }, [assignmentRoleIds, roles, selectedUser?.role]);

  if (!selectedRole || !selectedUser) return null;

  function roleIdsForUser(user: User, roleTemplates: RoleTemplate[]) {
    const ids = user.permissionRoleIds?.length
      ? user.permissionRoleIds
      : [user.permissionRoleId || roleTemplates.find((role) => role.key === user.role)?.id || ""];
    return ids.filter(Boolean);
  }

  function chooseRole(id: string) {
    const role = roles.find((item) => item.id === id)!;
    setRoleId(id);
    setRoleName(role.name);
    setRoleDescription(role.description || "");
    setRolePermissions(parsePermissionOverrides(role.permissionsJson));
  }

  function chooseUser(id: string) {
    const user = users.find((item) => item.id === id)!;
    setUserId(id);
    setAssignmentRoleIds(roleIdsForUser(user, roles));
    setOverrides(parsePermissionOverrides(user.permissionOverrides));
  }

  async function saveTemplate() {
    const activeRole = roles.find((role) => role.id === roleId);
    if (!activeRole || activeRole.key === "owner") return;
    setSavingRole(true);
    const result = await saveRoleTemplate(activeRole.id, { name: roleName, description: roleDescription, permissions: rolePermissions });
    setSavingRole(false);
    if (!result.success) return toast.error(result.error || "Could not save role.");
    setRoles((items) => items.map((role) => role.id === activeRole.id ? { ...role, name: roleName, description: roleDescription, permissionsJson: JSON.stringify(rolePermissions) } : role));
    toast.success(`${roleName} role updated. Everyone assigned to it now inherits these permissions.`);
  }

  function setPermissionException(key: keyof PermissionMap, value: boolean) {
    setOverrides((current) => {
      const next = { ...current };
      if (inheritedPermissions[key] === value) delete next[key];
      else next[key] = value;
      return next;
    });
  }

  function toggleAssignmentRole(id: string, checked: boolean) {
    setAssignmentRoleIds((current) => {
      const next = checked ? Array.from(new Set([...current, id])) : current.filter((roleId) => roleId !== id);
      return next.length ? next : current;
    });
  }

  async function assignRoles() {
    const activeUser = users.find((user) => user.id === userId);
    if (!activeUser) return;
    setSavingAssignment(true);
    const result = await assignRolesToUser(activeUser.id, assignmentRoleIds);
    setSavingAssignment(false);
    if (!result.success) return toast.error(result.error || "Could not assign role.");
    const selectedRoles = roles.filter((role) => assignmentRoleIds.includes(role.id));
    const primaryRole = selectedRoles.find((role) => role.key === "admin") || selectedRoles.find((role) => role.key === "manager") || selectedRoles[0];
    setUsers((items) => items.map((user) => user.id === activeUser.id ? { ...user, role: primaryRole?.key || user.role, permissionRoleId: primaryRole?.id || user.permissionRoleId, permissionRoleIds: selectedRoles.map((role) => role.id), permissionOverrides: null } : user));
    setOverrides({});
    toast.success(result.message || "Role assigned.");
  }

  async function saveException() {
    const activeUser = users.find((user) => user.id === userId);
    if (!activeUser) return;
    setSavingException(true);
    const result = await saveIndividualPermissionOverrides(activeUser.id, overrides);
    setSavingException(false);
    if (!result.success) return toast.error(result.error || "Could not save individual access.");
    setUsers((items) => items.map((user) => user.id === activeUser.id ? { ...user, permissionOverrides: Object.keys(overrides).length ? JSON.stringify(overrides) : null } : user));
    toast.success("Individual exception saved.");
  }

  return (
    <section className="rounded-3xl border border-violet-200 bg-violet-50/60 p-5 shadow-sm sm:p-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-violet-600 p-2 text-white"><ShieldCheck className="h-5 w-5" /></div>
        <div>
          <h2 className="text-lg font-bold text-slate-950">Roles & permissions</h2>
          <p className="mt-1 text-sm text-slate-600">Set a role once, assign it to staff, and everyone in that role receives the same access automatically.</p>
        </div>
      </div>

      {!hasOwner ? (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <b>First-time setup:</b> claim this administrator as CRM Owner before creating roles.
          <button onClick={async () => { const result = await claimInitialOwner(); result.success ? toast.success("You are now Owner. Sign out and sign in once, then refresh this page.") : toast.error(result.error || "Could not set Owner."); }} className="ml-3 rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white">Make me Owner</button>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 xl:grid-cols-[250px_minmax(0,1fr)]">
          <aside className="space-y-2">
            <p className="px-1 text-xs font-bold uppercase tracking-wide text-slate-500">Role library</p>
            {roles.map((role) => (
              <button key={role.id} type="button" onClick={() => chooseRole(role.id)} className={`w-full rounded-xl border p-3 text-left transition ${role.id === selectedRole.id ? "border-violet-500 bg-white shadow-xs" : "border-transparent bg-white/60 hover:border-violet-200"}`}>
                <span className="flex items-center gap-2 text-sm font-bold text-slate-950">{role.key === "owner" ? <Crown className="h-4 w-4 text-amber-500" /> : <BadgeCheck className="h-4 w-4 text-violet-600" />}{role.name}</span>
                <span className="mt-1 block text-xs text-slate-500">{titleCase(role.scope)}</span>
              </button>
            ))}
          </aside>

          <div className="space-y-6">
            <div className="rounded-2xl bg-white p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div><h3 className="font-bold text-slate-950">Edit {selectedRole.name} role</h3><p className="mt-1 text-sm text-slate-500">Changes apply automatically to every staff member assigned to this role.</p></div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{users.filter((user) => roleIdsForUser(user, roles).includes(selectedRole.id) || (!roleIdsForUser(user, roles).length && user.role === selectedRole.key)).length} assigned</span>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold text-slate-700">Role name<input disabled={!canConfigure || selectedRole.key === "owner"} value={roleName} onChange={(event) => setRoleName(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 disabled:bg-slate-100" /></label>
                <label className="text-sm font-semibold text-slate-700">Scope<input value={titleCase(selectedRole.scope)} disabled className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 text-slate-500" /></label>
                <label className="sm:col-span-2 text-sm font-semibold text-slate-700">What this role is for<textarea disabled={!canConfigure || selectedRole.key === "owner"} value={roleDescription} onChange={(event) => setRoleDescription(event.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 p-3 disabled:bg-slate-100" /></label>
              </div>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {CAPABILITIES.map(([key, label]) => <label key={key} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2.5 text-sm"><input disabled={!canConfigure || selectedRole.key === "owner"} type="checkbox" checked={selectedRole.key === "owner" || rolePermissions[key] === true} onChange={(event) => setRolePermissions((current) => ({ ...current, [key]: event.target.checked }))} />{label}</label>)}
              </div>
              {canConfigure && selectedRole.key !== "owner" && <button disabled={savingRole} onClick={saveTemplate} className="mt-5 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{savingRole ? "Saving…" : "Save role"}</button>}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-start gap-3"><div className="rounded-xl bg-blue-50 p-2 text-blue-700"><UsersRound className="h-5 w-5" /></div><div><h3 className="font-bold text-slate-950">Assign roles to a person</h3><p className="mt-1 text-sm text-slate-500">One person can hold multiple CRM roles. Permissions are combined automatically, like Discord roles.</p></div></div>
              <div className="mt-5 grid gap-4">
                <label className="text-sm font-semibold text-slate-700">Team member<select disabled={!canConfigure} value={selectedUser.id} onChange={(event) => chooseUser(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3">{users.map((user) => <option key={user.id} value={user.id}>{user.name} · {user.department}</option>)}</select></label>
                <div>
                  <p className="text-sm font-semibold text-slate-700">CRM roles</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {visibleAssignmentRoles.map((role) => (
                      <label key={role.id} className={`flex items-center gap-2 rounded-lg border p-3 text-sm font-semibold ${assignmentRoleIds.includes(role.id) ? "border-violet-300 bg-violet-50 text-violet-900" : "border-slate-200 bg-white text-slate-700"}`}>
                        <input
                          disabled={!canConfigure || selectedUser.id === currentUserId || selectedUser.role === "owner" || role.key === "owner"}
                          type="checkbox"
                          checked={assignmentRoleIds.includes(role.id)}
                          onChange={(event) => toggleAssignmentRole(role.id, event.target.checked)}
                        />
                        {role.name}
                        <span className="ml-auto text-[10px] uppercase text-slate-400">{titleCase(role.scope)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              {canConfigure && selectedUser.id !== currentUserId && selectedUser.role !== "owner" && <button disabled={savingAssignment} onClick={assignRoles} className="mt-4 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-bold text-violet-800 disabled:opacity-50">{savingAssignment ? "Assigning..." : "Save roles"}</button>}
            </div>

            <details className="rounded-2xl border border-slate-200 bg-white p-5">
              <summary className="cursor-pointer font-bold text-slate-950">Individual exception for {selectedUser.name}</summary>
              <p className="mt-2 text-sm text-slate-500">Use this only when one person needs different access from everyone else in their role.</p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {CAPABILITIES.map(([key, label]) => {
                  const hasException = typeof overrides[key] === "boolean";
                  return (
                    <label key={key} className={`flex items-center gap-2 rounded-lg border p-2.5 text-sm ${hasException ? "border-amber-300 bg-amber-50" : "border-slate-200"}`}>
                      <input disabled={!canConfigure || selectedUser.role === "owner"} type="checkbox" checked={overrides[key] ?? inheritedPermissions[key] === true} onChange={(event) => setPermissionException(key, event.target.checked)} />
                      <span>{label}</span>
                      {hasException && <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">Exception</span>}
                    </label>
                  );
                })}
              </div>
              {canConfigure && selectedUser.role !== "owner" && <button disabled={savingException} onClick={saveException} className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-50">{savingException ? "Saving..." : "Save individual exception"}</button>}
            </details>
          </div>
        </div>
      )}
    </section>
  );
}
