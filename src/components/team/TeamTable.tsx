"use client";

import { useState } from "react";
import { User, Role } from "@/types/user";
import {
  Search,
  Plus,
  Shield,
  Briefcase,
  UserCheck,
  MoreVertical,
  Edit2,
  Trash2,
  Power,
  Users,
  Building2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Zap,
  Sparkles,
  UserPlus,
  UserMinus,
  ArrowUpDown,
  Check,
} from "lucide-react";
import AddMemberModal from "./AddMemberModal";
import EditMemberModal from "./EditMemberModal";
import {
  toggleTeamMemberStatus,
  deleteTeamMember,
  syncWorkforceStaffAction,
  toggleManagerRole,
} from "@/app/actions/userManagement";
import { toast } from "sonner";

interface TeamTableProps {
  initialUsers: any[];
  stats: {
    totalStaff: number;
    totalAdmins: number;
    totalManagers: number;
    totalEmployees: number;
    activeCount: number;
    departments: string[];
  };
  currentUserRole?: string;
  currentUserId?: string;
}

export default function TeamTable({
  initialUsers,
  stats: initialStats,
  currentUserRole,
  currentUserId,
}: TeamTableProps) {
  const [users, setUsers] = useState(initialUsers);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [togglingRoleId, setTogglingRoleId] = useState<string | null>(null);

  const isAdmin = ["admin", "superadmin"].includes(
    currentUserRole?.trim().toLowerCase() || "",
  );

  // Recompute live stats from current state
  const totalStaff = users.length;
  const totalManagers = users.filter((u) => u.role === "manager").length;
  const totalEmployees = users.filter((u) => u.role === "employee").length;
  const activeCount = users.filter((u) => u.active).length;

  const handleRefresh = async () => {
    window.location.reload();
  };

  const handleWorkforceSync = async () => {
    setIsSyncing(true);
    toast.info("Connecting to Workforce API to sync employees...");
    try {
      const res = await syncWorkforceStaffAction();
      if (res.success) {
        toast.success(res.message || "Synced employees successfully!");
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } else {
        toast.error(res.error || "Failed to sync from Workforce API");
      }
    } catch (err: any) {
      toast.error(err.message || "Error communicating with Workforce API");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleToggleManager = async (user: any) => {
    if (!isAdmin) {
      toast.error("Only administrators can assign or remove managers.");
      return;
    }
    if (user.role === "admin") {
      toast.error("Cannot alter administrator role.");
      return;
    }

    setTogglingRoleId(user.id);
    try {
      const res = await toggleManagerRole(user.id);
      if (res.success && res.newRole) {
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, role: res.newRole } : u))
        );
        if (res.newRole === "manager") {
          toast.success(`⭐ Promoted ${user.name || user.email} to Manager!`);
        } else {
          toast.info(`Demoted ${user.name || user.email} to Employee.`);
        }
      } else {
        toast.error(res.error || "Failed to update role.");
      }
    } catch (err) {
      toast.error("Error updating manager status.");
    } finally {
      setTogglingRoleId(null);
    }
  };

  const handleToggleStatus = async (user: any) => {
    if (!isAdmin) {
      toast.error("Only administrators can toggle user status.");
      return;
    }
    if (user.id === currentUserId) {
      toast.error("You cannot deactivate your own account.");
      return;
    }

    try {
      const res = await toggleTeamMemberStatus(user.id);
      if (res.success) {
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, active: res.active } : u))
        );
        toast.success(
          `${user.name} is now ${res.active ? "active" : "inactive"}.`
        );
      } else {
        toast.error(res.error || "Failed to update status.");
      }
    } catch (err) {
      toast.error("Error updating user status.");
    }
  };

  const handleDelete = async (user: any) => {
    if (!isAdmin) {
      toast.error("Only administrators can delete team members.");
      return;
    }
    if (user.id === currentUserId) {
      toast.error("You cannot delete your own account.");
      return;
    }

    if (
      !confirm(
        `Are you sure you want to remove ${user.name} (${user.email})? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      const res = await deleteTeamMember(user.id);
      if (res.success) {
        setUsers((prev) => prev.filter((u) => u.id !== user.id));
        toast.success(`Removed ${user.name} from the team.`);
      } else {
        toast.error(res.error || "Failed to delete user.");
      }
    } catch (err) {
      toast.error("Error deleting user.");
    }
  };

  // Filtered users
  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.department &&
        user.department.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesRole =
      roleFilter === "all" || user.role.toLowerCase() === roleFilter.toLowerCase();

    const matchesDepartment =
      departmentFilter === "all" ||
      user.department?.toLowerCase() === departmentFilter.toLowerCase();

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && user.active) ||
      (statusFilter === "inactive" && !user.active);

    return matchesSearch && matchesRole && matchesDepartment && matchesStatus;
  });

  const getRoleBadge = (user: any) => {
    switch (user.role?.toLowerCase()) {
      case "admin":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50 px-2.5 py-1 text-xs font-bold text-purple-800">
            <Shield size={12} className="text-purple-600" />
            Admin
          </span>
        );
      case "manager":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-800 shadow-2xs">
            <Briefcase size={12} className="text-blue-600" />
            Manager
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
            <UserCheck size={12} className="text-slate-500" />
            Employee
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total Team Staff
            </p>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
              <Users size={16} />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900">{totalStaff}</p>
          <p className="text-xs text-slate-500 font-medium">
            {activeCount} active member{activeCount === 1 ? "" : "s"}
          </p>
        </div>

        <div className="rounded-3xl border border-blue-200/80 bg-blue-50/40 p-5 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-blue-800">
              Operations Managers
            </p>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 text-blue-700 border border-blue-200">
              <Briefcase size={16} />
            </div>
          </div>
          <p className="text-2xl font-black text-blue-900">{totalManagers}</p>
          <p className="text-xs text-blue-700 font-medium">Authorized team managers</p>
        </div>

        <div className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Employees
            </p>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
              <UserCheck size={16} />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-700">{totalEmployees}</p>
          <p className="text-xs text-slate-500 font-medium">Operational outreach staff</p>
        </div>

        <div className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Departments
            </p>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-50 text-purple-700 border border-purple-200">
              <Building2 size={16} />
            </div>
          </div>
          <p className="text-2xl font-black text-purple-700">
            {initialStats.departments.length}
          </p>
          <p className="text-xs text-slate-500 font-medium">Active functional units</p>
        </div>
      </div>

      {/* Admin Manager Role Control Notice */}
      {isAdmin && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
              <Briefcase size={16} />
            </div>
            <div>
              <p className="font-bold text-blue-950">Manager Assignment & Role Control</p>
              <p className="text-blue-800">
                You can add or remove Manager privileges with 1-click using the <strong>Make Manager</strong> or <strong>Remove Manager</strong> button on any staff member below.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setRoleFilter("manager")}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all shadow-xs cursor-pointer"
            >
              View Managers ({totalManagers})
            </button>
            <button
              onClick={() => setRoleFilter("employee")}
              className="px-3 py-1.5 rounded-lg bg-white border border-blue-200 hover:bg-blue-100/50 text-blue-900 font-semibold transition-all cursor-pointer"
            >
              View Employees ({totalEmployees})
            </button>
          </div>
        </div>
      )}

      {/* Main Table Container */}
      <div className="rounded-3xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
        {/* Table Top Controls */}
        <div className="flex flex-col gap-3.5 border-b border-slate-100 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative min-w-[240px] flex-1 max-w-md">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search staff by name, email, or department..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-xs text-slate-900 placeholder-slate-400 font-medium focus:border-amber-500 focus:bg-white focus:outline-none transition-colors"
              />
            </div>

            {/* Role Filter Tabs */}
            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1 text-xs font-semibold text-slate-600">
              <button
                type="button"
                onClick={() => setRoleFilter("all")}
                className={`rounded-lg px-3 py-1.5 transition-all cursor-pointer ${
                  roleFilter === "all" ? "bg-white text-slate-900 font-bold shadow-xs border border-slate-200" : "hover:text-slate-900"
                }`}
              >
                All ({users.length})
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter("admin")}
                className={`rounded-lg px-3 py-1.5 transition-all cursor-pointer ${
                  roleFilter === "admin" ? "bg-purple-100 text-purple-800 font-bold shadow-xs" : "hover:text-slate-900"
                }`}
              >
                Admins
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter("manager")}
                className={`rounded-lg px-3 py-1.5 transition-all cursor-pointer ${
                  roleFilter === "manager" ? "bg-blue-100 text-blue-800 font-bold shadow-xs" : "hover:text-slate-900"
                }`}
              >
                Managers ({totalManagers})
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter("employee")}
                className={`rounded-lg px-3 py-1.5 transition-all cursor-pointer ${
                  roleFilter === "employee" ? "bg-emerald-100 text-emerald-800 font-bold shadow-xs" : "hover:text-slate-900"
                }`}
              >
                Employees ({totalEmployees})
              </button>
            </div>

            {/* Department Filter */}
            {initialStats.departments.length > 0 && (
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 focus:border-amber-500 focus:bg-white focus:outline-none cursor-pointer"
              >
                <option value="all">All Departments</option>
                {initialStats.departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept.toUpperCase()}
                  </option>
                ))}
              </select>
            )}

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 focus:border-amber-500 focus:bg-white focus:outline-none cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 self-end lg:self-auto">
            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={handleWorkforceSync}
                  disabled={isSyncing}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-200 transition-colors disabled:opacity-50 cursor-pointer"
                  title="Sync staff from Workforce API"
                >
                  <RefreshCw size={14} className={isSyncing ? "animate-spin text-amber-600" : "text-slate-500"} />
                  <span>{isSyncing ? "Syncing..." : "Sync Workforce API"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsAddOpen(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 px-4 py-2 text-xs font-bold text-white shadow-xs transition-all cursor-pointer"
                >
                  <Plus size={15} className="text-amber-400" />
                  <span>Add Staff Member</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
              <tr>
                <th className="px-6 py-3.5">Staff User</th>
                <th className="px-6 py-3.5">Role</th>
                <th className="px-6 py-3.5">Manager Status</th>
                <th className="px-6 py-3.5">Department</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <p className="text-sm font-semibold text-slate-700">No team members found</p>
                    <p className="mt-1 text-xs">
                      Try adjusting your search query or filters.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const isSelf = user.id === currentUserId;
                  const isUserAdmin = user.role === "admin";
                  const isUserManager = user.role === "manager";
                  const initials = user.name
                    ? user.name
                        .split(" ")
                        .map((n: string) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)
                    : "U";

                  return (
                    <tr
                      key={user.id}
                      className="hover:bg-slate-50/70 transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-800 font-black text-xs border border-amber-200">
                            {initials}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900">
                                {user.name}
                              </span>
                              {isSelf && (
                                <span className="rounded-md bg-amber-100 border border-amber-200 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                                  You
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-slate-400 font-mono">{user.email}</span>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">{getRoleBadge(user)}</td>

                      {/* Quick Manager Toggle Column */}
                      <td className="px-6 py-4">
                        {isUserAdmin ? (
                          <span className="text-[11px] text-slate-400 italic">Primary Admin</span>
                        ) : isAdmin ? (
                          <button
                            type="button"
                            disabled={togglingRoleId === user.id}
                            onClick={() => handleToggleManager(user)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                              isUserManager
                                ? "bg-blue-100 text-blue-900 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 border border-blue-200"
                                : "bg-slate-100 text-slate-700 hover:bg-blue-600 hover:text-white border border-slate-200"
                            }`}
                            title={
                              isUserManager
                                ? "Click to remove Manager role (demote to Employee)"
                                : "Click to assign Manager role (promote)"
                            }
                          >
                            {togglingRoleId === user.id ? (
                              <RefreshCw size={13} className="animate-spin" />
                            ) : isUserManager ? (
                              <>
                                <Check size={13} className="text-blue-600 group-hover:text-rose-600" />
                                <span>Manager (Click to Remove)</span>
                              </>
                            ) : (
                              <>
                                <Plus size={13} />
                                <span>+ Make Manager</span>
                              </>
                            )}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-500 font-medium">
                            {isUserManager ? "Active Manager" : "Standard Employee"}
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <span className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-800 uppercase">
                          {user.department || "General"}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        {user.active ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                            <span className="h-2 w-2 rounded-full bg-slate-300"></span>
                            Inactive
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isAdmin && (
                            <>
                              <button
                                type="button"
                                title="Edit user details, department or password"
                                onClick={() => setEditingUser(user)}
                                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-amber-700 transition-colors cursor-pointer"
                              >
                                <Edit2 size={15} />
                              </button>

                              {!isSelf && (
                                <>
                                  <button
                                    type="button"
                                    title={user.active ? "Deactivate" : "Activate"}
                                    onClick={() => handleToggleStatus(user)}
                                    className={`rounded-lg p-2 transition-colors cursor-pointer ${
                                      user.active
                                        ? "text-slate-400 hover:bg-amber-50 hover:text-amber-700"
                                        : "text-emerald-600 hover:bg-emerald-50 hover:text-emerald-800"
                                    }`}
                                  >
                                    <Power size={15} />
                                  </button>

                                  <button
                                    type="button"
                                    title="Delete member"
                                    onClick={() => handleDelete(user)}
                                    className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <AddMemberModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onSuccess={handleRefresh}
        existingDepartments={initialStats.departments}
      />

      <EditMemberModal
        isOpen={!!editingUser}
        onClose={() => setEditingUser(null)}
        onSuccess={handleRefresh}
        user={editingUser}
        existingDepartments={initialStats.departments}
      />
    </div>
  );
}
