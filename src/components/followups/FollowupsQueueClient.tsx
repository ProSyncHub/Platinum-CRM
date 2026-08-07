"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Flame,
  Clock,
  CheckCircle2,
  MessageSquare,
  Search,
  PhoneCall,
  ChevronRight,
  Filter,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  Edit3,
  ClipboardCheck,
  PlayCircle,
  UserRoundPlus,
} from "lucide-react";
import {
  getMediumMeta,
  getProgramMeta,
} from "@/lib/membershipUtils";
import LogCallModal from "@/components/members/LogCallModal";
import AssignFollowUpModal from "@/components/followups/AssignFollowUpModal";
import FollowUpEligibilityManagerModal from "@/components/followups/FollowUpEligibilityManagerModal";
import { updateFollowUpTaskStatus } from "@/app/actions/followupActions";
import { toast } from "sonner";
import {
  getFollowUpPriorityMeta,
  getFollowUpStatusMeta,
  type AssignableStaffView,
  type FollowUpTaskView,
} from "@/lib/followups";

interface FollowupMember {
  id: string;
  fullName: string;
  memberCode: string;
  phone?: string | null;
  programType?: string | null;
  healthStatus?: string | null;
  activeStatus?: string | null;
  endDate?: string | Date | null;
  followUpPreference?: string | null;
  followUpPreferenceReason?: string | null;
  followUpPreferenceUpdatedBy?: string | null;
  contactStatus: {
    urgency: string;
    label: string;
    badgeClass: string;
  };
  queryTransfers?: Array<{ status: string; priority?: string | null }>;
  latestInteraction?: {
    date: string | Date;
    medium?: string | null;
    outcome?: string | null;
    notes?: string | null;
    staffName?: string | null;
  } | null;
}

interface FollowupsQueueClientProps {
  initialMembers: FollowupMember[];
  allMembers: FollowupMember[];
  initialTasks: FollowUpTaskView[];
  assignableStaff: AssignableStaffView[];
  currentUser: {
    id: string;
    name: string;
    email: string;
    role: string;
    department: string;
    elevated: boolean;
    superAdmin: boolean;
  };
  generatedAt: string;
}

export default function FollowupsQueueClient({
  initialMembers,
  allMembers,
  initialTasks,
  assignableStaff,
  currentUser,
  generatedAt,
}: FollowupsQueueClientProps) {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"overdue" | "due_soon" | "critical" | "completed" | "all">("overdue");
  const [selectedProgram, setSelectedProgram] = useState("all");
  const [selectedContactOwner, setSelectedContactOwner] = useState("all");
  const [activeLogMember, setActiveLogMember] = useState<FollowupMember | null>(null);
  const [activeFollowupTaskId, setActiveFollowupTaskId] = useState<string | undefined>();
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isEligibilityManagerOpen, setIsEligibilityManagerOpen] = useState(false);
  const [assignmentMemberId, setAssignmentMemberId] = useState<string | undefined>();
  const [editingTask, setEditingTask] = useState<FollowUpTaskView | null>(null);
  const [taskStatusFilter, setTaskStatusFilter] = useState("open");
  const [taskOwnerFilter, setTaskOwnerFilter] = useState("all");
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  // Calculate real tab counts
  const counts = useMemo(() => {
    let overdue = 0;
    let dueSoon = 0;
    let critical = 0;
    let completed = 0;

    for (const m of initialMembers) {
      const isCritical = m.healthStatus === "critical" || m.queryTransfers?.some((q) => q.status === "pending" && (q.priority === "urgent" || q.priority === "high"));
      if (isCritical) critical++;

      if (m.contactStatus?.urgency === "urgent") overdue++;
      else if (m.contactStatus?.urgency === "due_soon") dueSoon++;
      else completed++;
    }

    return { overdue, dueSoon, critical, completed, total: initialMembers.length };
  }, [initialMembers]);

  const filteredMembers = useMemo(() => {
    return initialMembers.filter((m) => {
      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const name = (m.fullName || "").toLowerCase();
        const code = (m.memberCode || "").toLowerCase();
        const phone = (m.phone || "").toLowerCase();
        const contactOwner = (m.latestInteraction?.staffName || "").toLowerCase();
        if (!name.includes(q) && !code.includes(q) && !phone.includes(q) && !contactOwner.includes(q)) {
          return false;
        }
      }

      // Tab Filtering
      if (activeTab === "overdue") {
        if (m.contactStatus?.urgency !== "urgent") return false;
      } else if (activeTab === "due_soon") {
        if (m.contactStatus?.urgency !== "due_soon") return false;
      } else if (activeTab === "critical") {
        const isCritical = m.healthStatus === "critical" || m.queryTransfers?.some((q) => q.status === "pending");
        if (!isCritical) return false;
      } else if (activeTab === "completed") {
        if (m.contactStatus?.urgency === "urgent" || m.contactStatus?.urgency === "due_soon") return false;
      }

      // Program filter
      if (selectedProgram !== "all") {
        const prog = (m.programType || "Platinum").toLowerCase();
        if (selectedProgram === "pnp" && !prog.includes("pnp")) return false;
        if (selectedProgram === "platinum" && !prog.includes("plat")) return false;
      }

      // Verified contact owner filter
      if (selectedContactOwner !== "all") {
        if ((m.latestInteraction?.staffName || "").toLowerCase() !== selectedContactOwner.toLowerCase()) {
          return false;
        }
      }

      return true;
    });
  }, [initialMembers, search, activeTab, selectedProgram, selectedContactOwner]);

  const contactOwners = useMemo(
    () => Array.from(new Set(
      initialMembers
        .map((member) => member.latestInteraction?.staffName)
        .filter((name): name is string => Boolean(name))
    )).sort(),
    [initialMembers]
  );

  const pageCount = Math.max(1, Math.ceil(filteredMembers.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const visibleMembers = filteredMembers.slice((safePage - 1) * pageSize, safePage * pageSize);
  const referenceTime = new Date(generatedAt).getTime();
  const openTasks = initialTasks.filter((task) =>
    ["pending", "in_progress"].includes(task.status),
  );
  const myOpenTasks = openTasks.filter(
    (task) => task.assignedToUser === currentUser.id,
  );
  const overdueTasks = openTasks.filter(
    (task) => new Date(task.dueAt).getTime() < referenceTime,
  );
  const completedTasks = initialTasks.filter((task) => task.status === "completed");

  const filteredTasks = initialTasks.filter((task) => {
    if (
      taskStatusFilter === "open" &&
      !["pending", "in_progress"].includes(task.status)
    ) return false;
    if (taskStatusFilter !== "all" && taskStatusFilter !== "open" && task.status !== taskStatusFilter) {
      return false;
    }
    if (taskOwnerFilter === "mine" && task.assignedToUser !== currentUser.id) return false;
    if (taskOwnerFilter !== "all" && taskOwnerFilter !== "mine" && task.assignedToUser !== taskOwnerFilter) {
      return false;
    }
    return true;
  });

  const openAssignmentModal = (memberId?: string, task?: FollowUpTaskView) => {
    setAssignmentMemberId(memberId);
    setEditingTask(task || null);
    setIsAssignModalOpen(true);
  };

  const openCheckInModal = (member: FollowupMember, taskId?: string) => {
    setActiveFollowupTaskId(taskId);
    setActiveLogMember(member);
  };

  const startTask = async (taskId: string) => {
    setUpdatingTaskId(taskId);
    try {
      const result = await updateFollowUpTaskStatus(taskId, "in_progress");
      if (!result.success) {
        toast.error(result.error || "Unable to start follow-up");
        return;
      }
      toast.success("Follow-up marked in progress");
      window.location.reload();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Unable to update follow-up");
    } finally {
      setUpdatingTaskId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-amber-700 font-bold text-xs uppercase tracking-wider mb-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Weekly Platinum Mentorship & Accountability Pipeline</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Weekly Follow-Ups & Team Escalations
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Enforcing strict 7-day weekly touchpoints for Platinum & PNP members. Log outcomes & escalate blockers directly to responsible teams.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 self-start">
          {currentUser.superAdmin && (
            <button
              type="button"
              onClick={() => setIsEligibilityManagerOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-xs font-bold text-violet-700 hover:bg-violet-100"
            >
              <ShieldCheck className="h-4 w-4" />
              Manage Eligibility
            </button>
          )}
          <button
            type="button"
            onClick={() => openAssignmentModal()}
            disabled={assignableStaff.length === 0 || initialMembers.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <UserRoundPlus className="h-4 w-4 text-amber-400" />
            Assign Follow-Up
          </button>
        </div>
      </div>

      <section className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "My Open Tasks", value: myOpenTasks.length, tone: "border-indigo-200 bg-indigo-50 text-indigo-800" },
            { label: "Team Open Tasks", value: openTasks.length, tone: "border-blue-200 bg-blue-50 text-blue-800" },
            { label: "Overdue Assignments", value: overdueTasks.length, tone: "border-red-200 bg-red-50 text-red-800" },
            { label: "Completed", value: completedTasks.length, tone: "border-emerald-200 bg-emerald-50 text-emerald-800" },
          ].map((item) => (
            <div key={item.label} className={`rounded-2xl border p-4 ${item.tone}`}>
              <p className="text-[10px] font-bold uppercase tracking-wider">{item.label}</p>
              <p className="mt-1 text-2xl font-black">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
                <ClipboardCheck className="h-5 w-5 text-indigo-600" />
                Assigned Follow-Up Tasks
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {currentUser.elevated
                  ? "Organization-wide assignment queue"
                  : `${currentUser.department} department queue and your personal assignments`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                aria-label="Filter assigned follow-ups by owner"
                value={taskOwnerFilter}
                onChange={(event) => setTaskOwnerFilter(event.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium focus:border-indigo-500 focus:outline-none"
              >
                <option value="all">All owners</option>
                <option value="mine">Assigned to me</option>
                {assignableStaff.map((person) => (
                  <option key={person.id} value={person.id}>{person.name}</option>
                ))}
              </select>
              <select
                aria-label="Filter assigned follow-ups by status"
                value={taskStatusFilter}
                onChange={(event) => setTaskStatusFilter(event.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium focus:border-indigo-500 focus:outline-none"
              >
                <option value="open">Open tasks</option>
                <option value="pending">Pending</option>
                <option value="in_progress">In progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="all">All statuses</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-3">Member & Task</th>
                  <th className="px-3 py-3">Assigned To</th>
                  <th className="px-3 py-3">Due</th>
                  <th className="px-3 py-3">Priority</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Assigned By</th>
                  <th className="px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-10 text-center text-sm text-slate-500">
                      No assigned follow-ups match this view. Use “Assign Follow-Up” to create one.
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((task) => {
                    const priorityMeta = getFollowUpPriorityMeta(task.priority);
                    const statusMeta = getFollowUpStatusMeta(task.status);
                    const isOpen = ["pending", "in_progress"].includes(task.status);
                    const isOverdue = isOpen && new Date(task.dueAt).getTime() < referenceTime;
                    const canManage =
                      currentUser.elevated ||
                      task.assignedToUser === currentUser.id ||
                      task.createdByUser === currentUser.id;
                    const canEditAssignment =
                      currentUser.elevated || task.createdByUser === currentUser.id;
                    const memberForLog = initialMembers.find((member) => member.id === task.memberId);

                    return (
                      <tr key={task.id} className="hover:bg-slate-50/80">
                        <td className="px-3 py-3.5">
                          <Link href={`/members/${task.member.id}`} className="font-bold text-slate-900 hover:text-indigo-700">
                            {task.member.fullName}
                          </Link>
                          <p className="mt-0.5 font-mono text-[10px] text-slate-500">{task.member.memberCode}</p>
                          <p className="mt-1 font-semibold text-slate-700">{task.title}</p>
                          {task.instructions && <p className="mt-0.5 max-w-[280px] truncate text-[10px] text-slate-500">{task.instructions}</p>}
                        </td>
                        <td className="px-3 py-3.5">
                          <p className="font-bold text-slate-800">{task.assignedToName}</p>
                          <p className="mt-0.5 text-[10px] text-slate-500">{task.assignedToDepartment}</p>
                        </td>
                        <td className="px-3 py-3.5">
                          <p className={isOverdue ? "font-bold text-red-700" : "font-medium text-slate-700"}>
                            {new Date(task.dueAt).toLocaleString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                              timeZone: "Asia/Kolkata",
                            })}
                          </p>
                          {isOverdue && <p className="mt-0.5 text-[10px] font-bold uppercase text-red-600">Overdue</p>}
                        </td>
                        <td className="px-3 py-3.5">
                          <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${priorityMeta.badgeClass}`}>
                            {priorityMeta.label}
                          </span>
                        </td>
                        <td className="px-3 py-3.5">
                          <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${statusMeta.badgeClass}`}>
                            {statusMeta.label}
                          </span>
                        </td>
                        <td className="px-3 py-3.5">
                          <p className="font-medium text-slate-700">{task.createdByName}</p>
                          <p className="mt-0.5 text-[10px] text-slate-500">{task.createdByDepartment}</p>
                        </td>
                        <td className="px-3 py-3.5 text-right">
                          <div className="flex justify-end gap-2">
                            {canEditAssignment && isOpen && (
                              <button
                                type="button"
                                onClick={() => openAssignmentModal(task.memberId, task)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-bold text-slate-700 hover:bg-slate-100"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                                Edit
                              </button>
                            )}
                            {canManage && task.status === "pending" && (
                              <button
                                type="button"
                                disabled={updatingTaskId === task.id}
                                onClick={() => startTask(task.id)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 font-bold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                              >
                                <PlayCircle className="h-3.5 w-3.5" />
                                Start
                              </button>
                            )}
                            {canManage && isOpen && memberForLog && (
                              <button
                                type="button"
                                onClick={() => openCheckInModal(memberForLog, task.id)}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 font-bold text-white hover:bg-slate-800"
                              >
                                <PhoneCall className="h-3.5 w-3.5 text-amber-400" />
                                Log & Complete
                              </button>
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
      </section>

      {/* 4 Dedicated Cadence Tabs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Overdue */}
        <button
          type="button"
          onClick={() => setActiveTab("overdue")}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
            activeTab === "overdue"
              ? "bg-red-50 border-red-300 ring-2 ring-red-400/40 text-red-900 shadow-xs"
              : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider">Weekly Overdue</span>
            <Flame className="w-4 h-4 text-red-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{counts.overdue}</span>
            <span className="text-[11px] text-red-700 font-bold">&gt;7 Days Inactive</span>
          </div>
        </button>

        {/* Due This Week */}
        <button
          type="button"
          onClick={() => setActiveTab("due_soon")}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
            activeTab === "due_soon"
              ? "bg-amber-50 border-amber-300 ring-2 ring-amber-400/40 text-amber-900 shadow-xs"
              : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider">Due This Week</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{counts.dueSoon}</span>
            <span className="text-[11px] text-amber-700 font-bold">Scheduled &lt;48h</span>
          </div>
        </button>

        {/* Critical Escalations */}
        <button
          type="button"
          onClick={() => setActiveTab("critical")}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
            activeTab === "critical"
              ? "bg-purple-50 border-purple-300 ring-2 ring-purple-400/40 text-purple-900 shadow-xs"
              : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider">Team Escalations</span>
            <ShieldAlert className="w-4 h-4 text-purple-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{counts.critical}</span>
            <span className="text-[11px] text-purple-700 font-bold">Active Blockers</span>
          </div>
        </button>

        {/* Completed This Week */}
        <button
          type="button"
          onClick={() => setActiveTab("completed")}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
            activeTab === "completed"
              ? "bg-emerald-50 border-emerald-300 ring-2 ring-emerald-400/40 text-emerald-900 shadow-xs"
              : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider">Completed This Week</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{counts.completed}</span>
            <span className="text-[11px] text-emerald-700 font-bold">Checked In</span>
          </div>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-3xl bg-white border border-slate-200/90 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search member, code, phone, or last contact person..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-xs focus:outline-none focus:border-amber-500 focus:bg-white transition-colors"
          />
        </div>

        {/* Dropdowns */}
        <div className="flex items-center gap-2">
          <select
            value={selectedProgram}
            onChange={(e) => setSelectedProgram(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs focus:outline-none focus:border-amber-500 focus:bg-white font-medium"
          >
            <option value="all">All Programs</option>
            <option value="platinum">👑 Platinum Elite</option>
            <option value="pnp">⚡ PNP Plug & Play</option>
          </select>

          {contactOwners.length > 0 && (
            <select
              value={selectedContactOwner}
              onChange={(e) => setSelectedContactOwner(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs focus:outline-none focus:border-amber-500 focus:bg-white font-medium"
            >
              <option value="all">All contact owners</option>
              {contactOwners.map((ex) => (
                <option key={ex} value={ex}>
                  {ex}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Queue Table */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Filter className="w-4 h-4 text-amber-600" />
            Showing {filteredMembers.length} Members in Follow-Up Queue
          </h3>
          <span className="text-xs text-slate-500 font-mono font-medium">
            Cadence: 7-Day Cycle
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50/50">
                <th className="py-3 px-3">Member</th>
                <th className="py-3 px-3">Latest verified update</th>
                <th className="py-3 px-3">Last contacted by</th>
                <th className="py-3 px-3">Follow-up status</th>
                <th className="py-3 px-3 text-right">Outreach Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-500">
                    🎉 No members found in this follow-up filter. All caught up!
                  </td>
                </tr>
              ) : (
                visibleMembers.map((m) => {
                  const progMeta = getProgramMeta(m.programType || (m.memberCode?.startsWith("PNP") ? "PNP" : "Platinum"));
                  const latestInteraction = m.latestInteraction;
                  const medMeta = getMediumMeta(latestInteraction?.medium);
                  const cleanPhone = (m.phone || "").replace(/[^0-9+]/g, "");
                  const whatsappUrl = `https://wa.me/${cleanPhone.replace(
                    "+",
                    ""
                  )}?text=${encodeURIComponent(
                    `Hello ${m.fullName}, checking in from ProSync ${progMeta.name} for your weekly mentorship follow-up (Account ${m.memberCode}). How is your progress this week?`
                  )}`;

                  return (
                    <tr
                      key={m.id}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* Member Info */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <Link
                            href={`/members/${m.id}`}
                            className="font-bold text-slate-900 hover:text-amber-600 transition-colors"
                          >
                            {m.fullName}
                          </Link>
                          <span
                            className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase border ${progMeta.badgeClass}`}
                          >
                            <span>{progMeta.icon}</span>
                            <span>{progMeta.shortLabel}</span>
                          </span>
                        </div>
                        <div className="font-mono text-[10px] text-slate-500 mt-0.5 flex items-center gap-2">
                          <span className="font-medium">{m.memberCode}</span>
                          {m.phone && <span>• {m.phone}</span>}
                        </div>
                      </td>

                      {/* Latest verified CRM activity */}
                      <td className="py-3 px-3">
                        {latestInteraction ? (
                          <div className="max-w-[280px]">
                            <div className="font-semibold text-slate-800">
                              {latestInteraction.outcome || "Interaction logged"}
                            </div>
                            <div className="mt-0.5 truncate text-[10px] text-slate-500">
                              {latestInteraction.notes || "No update note added"}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">No CRM activity yet</span>
                        )}
                      </td>

                      {/* Verified contact owner */}
                      <td className="py-3 px-3">
                        {latestInteraction ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1">
                              <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase border ${medMeta.badgeClass}`}>
                                {medMeta.shortLabel}
                              </span>
                              <span className="text-[10px] text-slate-700 font-medium">
                                {new Date(latestInteraction.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {latestInteraction.staffName || "Unattributed activity"}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[11px] text-red-600 font-bold">
                            Never contacted
                          </span>
                        )}
                      </td>

                      {/* Weekly Urgency */}
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold text-[10px] border ${m.contactStatus.badgeClass}`}
                        >
                          {m.contactStatus.urgency === "urgent" && <Flame className="w-3.5 h-3.5 text-red-600" />}
                          {m.contactStatus.label}
                        </span>
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {cleanPhone && (
                            <a
                              href={whatsappUrl}
                              target="_blank"
                              rel="noreferrer"
                              title="Send Weekly WhatsApp"
                              className="p-1.5 rounded-xl bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 transition-colors"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </a>
                          )}

                          <button
                            type="button"
                            onClick={() => openCheckInModal(m)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
                          >
                            <PhoneCall className="w-3.5 h-3.5 text-amber-400" />
                            <span>Log Weekly Check-In</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => openAssignmentModal(m.id)}
                            title="Assign this follow-up"
                            className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 transition-colors hover:bg-indigo-100"
                          >
                            <UserRoundPlus className="h-3.5 w-3.5" />
                            Assign
                          </button>

                          <Link
                            href={`/members/${m.id}`}
                            className="p-1.5 rounded-xl bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors"
                            title="Full Dossier"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {filteredMembers.length > pageSize && (
          <div className="flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-500">
            <span>
              Showing {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filteredMembers.length)} of {filteredMembers.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safePage === 1}
                onClick={() => setPage(Math.max(1, safePage - 1))}
                className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <span className="font-medium text-slate-700">Page {safePage} of {pageCount}</span>
              <button
                type="button"
                disabled={safePage === pageCount}
                onClick={() => setPage(Math.min(pageCount, safePage + 1))}
                className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Log Call & Weekly Check-In Modal */}
      {activeLogMember && (
        <LogCallModal
          isOpen={!!activeLogMember}
          onClose={() => {
            setActiveLogMember(null);
            setActiveFollowupTaskId(undefined);
          }}
          memberId={activeLogMember.id}
          memberName={activeLogMember.fullName}
          memberPhone={activeLogMember.phone || undefined}
          followupTaskId={activeFollowupTaskId}
          currentUserRole={currentUser.role}
          currentUserId={currentUser.id}
          contactStaffOptions={currentUser.superAdmin ? assignableStaff : []}
          onSuccess={() => window.location.reload()}
        />
      )}

      {isAssignModalOpen && (
        <AssignFollowUpModal
          key={editingTask?.id || assignmentMemberId || "all-members"}
          members={initialMembers}
          staff={assignableStaff}
          currentUserId={currentUser.id}
          initialMemberId={assignmentMemberId}
          task={editingTask}
          onClose={() => {
            setIsAssignModalOpen(false);
            setAssignmentMemberId(undefined);
            setEditingTask(null);
          }}
          onSuccess={() => window.location.reload()}
        />
      )}

      {isEligibilityManagerOpen && currentUser.superAdmin && (
        <FollowUpEligibilityManagerModal
          members={allMembers}
          generatedAt={generatedAt}
          onClose={() => {
            setIsEligibilityManagerOpen(false);
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
