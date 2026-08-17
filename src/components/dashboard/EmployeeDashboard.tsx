import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  getMembershipStatus,
  PLATINUM_STAGES,
  getContactAttentionStatus,
  getMediumMeta,
  getProgramMeta,
} from "@/lib/membershipUtils";
import { memberScopeFor, normalizeDepartment } from "@/lib/authorization";
import KpiCard from "@/components/dashboard/KpiCard";
import Link from "next/link";
import FollowUpOverviewPanel from "@/components/dashboard/FollowUpOverviewPanel";
import {
  Users,
  PhoneCall,
  Clock,
  SendHorizontal,
  Briefcase,
  Sparkles,
  ArrowRight,
  MessageSquare,
  Phone,
  Flame,
  CheckCircle2,
} from "lucide-react";

interface EmployeeDashboardProps {
  department: string;
}

export default async function EmployeeDashboard({ department }: EmployeeDashboardProps) {
  const session = await getServerSession(authOptions);
  const userName = session?.user?.name || "";

  // Fetch all members assigned to this employee or general pool
  const allMembers = await prisma.member.findMany({
    where: {
      AND: [
        memberScopeFor(session?.user || { department }),
        {
          OR: [
            { approvalStatus: null },
            { approvalStatus: { isSet: false } },
            { approvalStatus: "approved" },
          ],
        },
      ],
    },
    include: {
      callLogs: {
        orderBy: { date: "desc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Transferred queries for this department
  const pendingQueries = await prisma.queryTransfer.findMany({
    where: {
      toDepartment: normalizeDepartment(department),
      status: "pending",
    },
    include: {
      member: true,
    },
    orderBy: { createdAt: "desc" },
    take: 6,
  });

  // Filter assigned members
  const assignedMembers = allMembers.filter(
    (m) =>
      (userName && m.allotedTo?.toLowerCase().includes(userName.toLowerCase().split(" ")[0])) ||
      (normalizeDepartment(department) === "operations")
  );

  const displayList = assignedMembers.length > 0 ? assignedMembers : allMembers.slice(0, 15);

  let activeCount = 0;
  let expiringSoonCount = 0;
  let urgentAttentionCount = 0;

  displayList.forEach((m) => {
    const status = getMembershipStatus(m.enrollingDate, m.endDate, m.activeStatus);
    const contactStatus = getContactAttentionStatus(m.callLogs[0]?.date || null, m.nextConnectDate);
    if (status.status === "Active" || status.status === "Expiring Soon") activeCount++;
    if (status.isExpiringSoon) expiringSoonCount++;
    if (contactStatus.urgency === "urgent" || contactStatus.urgency === "due_soon") {
      urgentAttentionCount++;
    }
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-amber-700 font-bold text-xs uppercase tracking-wider mb-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span className="capitalize">{department} Department Hub</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Welcome back, {userName || "Executive"}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage your allocated Platinum Members, log calls & WhatsApp outreach, and handle transferred queries
          </p>
        </div>

        <Link
          href="/members"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm transition-all self-start sm:self-auto"
        >
          <span>All Members Directory</span>
          <ArrowRight className="w-4 h-4 text-amber-400" />
        </Link>
      </div>

      {/* KPI Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Assigned Members"
          value={displayList.length}
          icon={Users}
        />
        <KpiCard
          title="Active Enrolled"
          value={activeCount}
          icon={Sparkles}
        />
        <KpiCard
          title="Attention Required"
          value={urgentAttentionCount}
          icon={Flame}
        />
        <KpiCard
          title="Pending Department Queries"
          value={pendingQueries.length}
          icon={SendHorizontal}
        />
      </div>

      <FollowUpOverviewPanel />

      {/* Transferred Queries to this Department */}
      {pendingQueries.length > 0 && (
        <div className="p-6 rounded-3xl bg-purple-50 border border-purple-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-purple-100 text-purple-700 border border-purple-200">
                <SendHorizontal className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Incoming Queries for {department.toUpperCase()} ({pendingQueries.length})
                </h3>
                <p className="text-xs text-slate-600">
                  Issues routed from other teams requiring your department's resolution
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendingQueries.map((q) => (
              <div
                key={q.id}
                className="p-4 rounded-2xl bg-white border border-purple-200 shadow-xs space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">
                      {q.member.fullName}
                    </span>
                    <span className="font-mono text-amber-700 text-[10px] font-bold">
                      {q.member.memberCode}
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      q.priority === "urgent"
                        ? "bg-red-100 text-red-700 border border-red-200"
                        : q.priority === "high"
                        ? "bg-amber-100 text-amber-800 border border-amber-200"
                        : "bg-purple-100 text-purple-800 border border-purple-200"
                    }`}
                  >
                    {q.priority || "Medium"} Priority
                  </span>
                </div>

                <p className="text-slate-700 text-xs leading-relaxed">{q.reason}</p>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 font-medium">
                    From {q.fromDepartment.toUpperCase()}
                  </span>
                  <Link
                    href={`/members/${q.memberId}`}
                    className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition-colors"
                  >
                    Open & Resolve
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assigned Members Table */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Your Allocated Platinum Members
              </h3>
              <p className="text-xs text-slate-500">
                Members assigned to you with communication status & instant channels
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50/50">
                <th className="py-3 px-3">Member</th>
                <th className="py-3 px-3">Follow-up Urgency</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Stage</th>
                <th className="py-3 px-3">Last Reached Via</th>
                <th className="py-3 px-3 text-right">Quick Contact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {displayList.map((m) => {
                const status = getMembershipStatus(m.enrollingDate, m.endDate, m.activeStatus);
                const latestInteraction = m.callLogs[0] || null;
                const contactStatus = getContactAttentionStatus(latestInteraction?.date || null, m.nextConnectDate);
                const stageObj =
                  PLATINUM_STAGES.find((s) => s.id === m.currentStage) ||
                  PLATINUM_STAGES[0];
                const medMeta = getMediumMeta(latestInteraction?.medium);
                const progMeta = getProgramMeta(
                  m.programType || (m.memberCode?.startsWith("PNP") ? "PNP" : "Platinum")
                );

                const cleanPhone = (m.phone || "").replace(/[^0-9+]/g, "");
                const whatsappUrl = `https://wa.me/${cleanPhone.replace(
                  "+",
                  ""
                )}?text=${encodeURIComponent(
                  `Hello ${m.fullName}, this is from ProSync ${progMeta.name} Support regarding your account ${m.memberCode}.`
                )}`;

                return (
                  <tr
                    key={m.id}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/members/${m.id}`}
                          className="font-bold text-slate-900 hover:text-amber-600 transition-colors"
                        >
                          {m.fullName}
                        </Link>
                        <span
                          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase border ${progMeta.badgeClass}`}
                        >
                          <span>{progMeta.icon}</span>
                          <span>{progMeta.shortLabel}</span>
                        </span>
                      </div>
                      <div className="font-mono text-[10px] text-slate-500 mt-0.5 font-medium">
                        {m.memberCode}
                      </div>
                    </td>

                    {/* Followup urgency */}
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[10px] border ${contactStatus.badgeClass}`}
                      >
                        {contactStatus.urgency === "urgent" && <Flame className="w-3 h-3 text-red-600" />}
                        {contactStatus.label}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          status.status === "Active"
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            : status.isExpiringSoon
                            ? "bg-amber-100 text-amber-800 border border-amber-200"
                            : "bg-red-100 text-red-800 border border-red-200"
                        }`}
                      >
                        {status.status} ({status.daysLeft !== null ? `${status.daysLeft}d` : ""})
                      </span>
                    </td>

                    {/* Stage */}
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-semibold">
                        {stageObj.number}: {stageObj.name}
                      </span>
                    </td>

                    {/* Last Reached Via */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${medMeta.badgeClass}`}>
                          {medMeta.shortLabel}
                        </span>
                        <span className="text-[10px] text-slate-600 font-medium">
                          {latestInteraction?.staffName || "No verified contact"}
                        </span>
                      </div>
                    </td>

                    {/* Quick actions */}
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <a
                          href={`tel:${cleanPhone}`}
                          title={`Call ${m.phone}`}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                        <a
                          href={whatsappUrl}
                          target="_blank"
                          rel="noreferrer"
                          title="Instant WhatsApp"
                          className="p-1.5 rounded-lg bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 transition-colors"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </a>
                        <Link
                          href={`/members/${m.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors shadow-xs"
                        >
                          Open
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
