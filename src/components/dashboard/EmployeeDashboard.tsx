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
import {
  Users,
  Briefcase,
  Sparkles,
  ArrowRight,
  MessageSquare,
  Phone,
  Flame,
  CheckCircle2,
  Inbox,
  MessageCircle,
} from "lucide-react";

interface EmployeeDashboardProps {
  department: string;
}

export default async function EmployeeDashboard({ department }: EmployeeDashboardProps) {
  const session = await getServerSession(authOptions);
  const userName = session?.user?.name || "";
  const userId = session?.user?.id || "";
  const userEmail = session?.user?.email || "";
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

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

  const [callsToday, logsToday, assignedWatiLeads] = await Promise.all([
    prisma.callLog.count({
      where: {
        date: { gte: todayStart, lt: tomorrowStart },
        OR: [
          ...(userId ? [{ staffUserId: userId }] : []),
          ...(userEmail ? [{ staffEmail: { equals: userEmail, mode: "insensitive" as const } }] : []),
        ],
      },
    }),
    prisma.callLog.findMany({
      where: {
        date: { gte: todayStart, lt: tomorrowStart },
        OR: [
          ...(userId ? [{ staffUserId: userId }] : []),
          ...(userEmail ? [{ staffEmail: { equals: userEmail, mode: "insensitive" as const } }] : []),
        ],
      },
      select: {
        id: true,
        date: true,
        medium: true,
        outcome: true,
        member: { select: { id: true, fullName: true, memberCode: true } },
      },
      orderBy: { date: "desc" },
      take: 5,
    }),
    prisma.lead.findMany({
      where: {
        source: { slug: "wati" },
        status: { not: "closed" },
        OR: [
          ...(userId ? [{ assignedToUser: userId }] : []),
          ...(userEmail ? [{ assignedToEmail: { equals: userEmail, mode: "insensitive" as const } }] : []),
        ],
      },
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        responseCode: true,
        responseText: true,
        campaign: true,
        receivedAt: true,
        assignedAt: true,
      },
      orderBy: [{ assignedAt: "desc" }, { receivedAt: "desc" }],
      take: 6,
    }),
  ]);

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
        <Link
          href="/queries"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-violet-200 bg-violet-50 hover:bg-violet-100 text-violet-800 font-bold text-xs transition-all self-start sm:self-auto"
        >
          <Inbox className="w-4 h-4" />
          My Queries
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
          title="Calls Logged Today"
          value={callsToday}
          icon={Flame}
        />
        <KpiCard
          title="Assigned WATI Leads"
          value={assignedWatiLeads.length}
          icon={MessageCircle}
        />
      </div>

      {assignedWatiLeads.length > 0 && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 shadow-xs">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-black text-emerald-950">
                <MessageCircle className="h-4 w-4" />
                Your assigned WATI leads
              </h3>
              <p className="mt-1 text-xs text-emerald-800">
                Leads assigned from the WATI reply queue. Open Leads to call, update status, or reassign if permitted.
              </p>
            </div>
            <Link href="/leads?source=wati" className="rounded-xl bg-emerald-700 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-800">
              Open WATI leads
            </Link>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {assignedWatiLeads.map((lead) => (
              <Link key={lead.id} href={`/leads?source=wati&q=${encodeURIComponent(lead.phone || lead.email || lead.fullName)}`} className="rounded-xl border border-emerald-200 bg-white p-4 hover:border-emerald-400">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-950">{lead.fullName}</p>
                    <p className="mt-1 text-xs text-slate-500">{lead.phone || lead.email || "No contact detail"}</p>
                  </div>
                  <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold uppercase text-amber-700">
                    {lead.responseCode === "has_question" ? "Question" : lead.responseCode === "will_pay_shortly" ? "Will pay" : lead.responseCode === "already_paid" ? "Paid" : "Other"}
                  </span>
                </div>
                <p className="mt-3 line-clamp-2 text-xs text-slate-600">{lead.responseText || lead.campaign || "WATI lead assigned for follow-up."}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {logsToday.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Your logs today</h3>
            <Link href="/calls" className="text-xs font-bold text-amber-700 hover:underline">
              Open calls page
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {logsToday.map((log) => (
              <Link
                key={log.id}
                href={`/members/${log.member.id}`}
                className="flex items-center justify-between gap-4 py-2.5 text-xs hover:bg-slate-50"
              >
                <span>
                  <span className="font-bold text-slate-900">{log.member.fullName}</span>
                  <span className="ml-2 font-mono text-slate-500">{log.member.memberCode}</span>
                </span>
                <span className="text-right text-slate-500">
                  {log.medium} · {log.outcome} ·{" "}
                  {new Intl.DateTimeFormat("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Asia/Kolkata",
                  }).format(log.date)}
                </span>
              </Link>
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
