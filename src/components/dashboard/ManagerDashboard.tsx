import { prisma } from "@/lib/db";
import {
  getMembershipStatus,
  PLATINUM_STAGES,
  getContactAttentionStatus,
  getMediumMeta,
} from "@/lib/membershipUtils";
import KpiCard from "@/components/dashboard/KpiCard";
import AttentionTable from "@/components/dashboard/AttentionTable";
import PartnerServicePipelineSummary from "@/components/dashboard/PartnerServicePipelineSummary";
import Link from "next/link";
import {
  Users,
  AlertTriangle,
  PhoneCall,
  Briefcase,
  Layers,
  Sparkles,
  ArrowRight,
  MessageSquare,
  Video,
  Mail,
  Flame,
} from "lucide-react";

export default async function ManagerDashboard() {
  const [members, pendingQueryCount, activeServiceCount, recentServiceReferrals] = await Promise.all([
    prisma.member.findMany({
      where: {
        OR: [
          { approvalStatus: null },
          { approvalStatus: { isSet: false } },
          { approvalStatus: "approved" },
        ],
      },
      include: {
        callLogs: {
          orderBy: { date: "desc" },
        },
      },
    }),
    prisma.queryTransfer.count({
      where: { status: "pending" },
    }),
    prisma.memberServiceReferral.count({
      where: { status: { notIn: ["completed", "cancelled"] } },
    }),
    prisma.memberServiceReferral.findMany({
      where: { status: { notIn: ["completed", "cancelled"] } },
      include: {
        member: { select: { id: true, fullName: true, memberCode: true } },
        partner: { select: { serviceName: true, providerName: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 4,
    }),
  ]);

  const totalMembers = members.length;
  let platinumCount = 0;
  let pnpCount = 0;
  let activeCount = 0;
  let urgentFollowups = 0;

  const stageCounts: Record<string, number> = {
    onboarding: 0,
    research: 0,
    sourcing: 0,
    approval: 0,
    growth: 0,
  };

  const mediumCounts: Record<string, number> = {
    phone: 0,
    whatsapp: 0,
    zoom: 0,
    meet: 0,
    email: 0,
    sms: 0,
    in_person: 0,
  };

  const execCounts: Record<string, number> = {};
  type ManagerLog = (typeof members)[number]["callLogs"][number] & {
    memberId: string;
    memberName: string;
    memberCode: string | null;
  };
  const allLogs: ManagerLog[] = [];

  for (const m of members) {
    const isPnp = (m.programType || "").toLowerCase().includes("pnp") || m.memberCode?.startsWith("PNP");
    if (isPnp) pnpCount++;
    else platinumCount++;

    const status = getMembershipStatus(m.enrollingDate, m.endDate, m.activeStatus);
    const contactStatus = getContactAttentionStatus(m.lastConnectDate, m.nextConnectDate);

    if (status.status === "Active" || status.status === "Expiring Soon") {
      activeCount++;
    }
    if (contactStatus.urgency === "urgent" || contactStatus.urgency === "due_soon") {
      urgentFollowups++;
    }

    if (m.currentStage && stageCounts[m.currentStage] !== undefined) {
      stageCounts[m.currentStage]++;
    }

    if (m.allotedTo) {
      execCounts[m.allotedTo] = (execCounts[m.allotedTo] || 0) + 1;
    }

    if (m.callLogs) {
      for (const l of m.callLogs) {
        allLogs.push({
          ...l,
          memberId: m.id,
          memberName: m.fullName,
          memberCode: m.memberCode,
        });
        const med = (l.medium || "phone").toLowerCase();
        if (mediumCounts[med] !== undefined) {
          mediumCounts[med]++;
        } else {
          mediumCounts.phone++;
        }
      }
    }
  }

  // Sort logs by date descending
  allLogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const recentLogs = allLogs.slice(0, 6);
  const totalInteractions = allLogs.length;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-amber-700 font-bold text-xs uppercase tracking-wider mb-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Operations & Team Command Center</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Manager Operations Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Complete visibility across {totalMembers} ProSync Members ({platinumCount} Platinum • {pnpCount} PNP), outreach channels & executive allocations
          </p>
        </div>

        <Link
          href="/members"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm transition-all self-start sm:self-auto"
        >
          <span>View All Members</span>
          <ArrowRight className="w-4 h-4 text-amber-400" />
        </Link>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Total Active Members"
          value={`${totalMembers}`}
          subtitle={`👑 ${platinumCount} Platinum • ⚡ ${pnpCount} PNP`}
          icon={Users}
        />
        <KpiCard
          title="Active Enrolled"
          value={activeCount}
          icon={Sparkles}
        />
        <KpiCard
          title="Urgent Follow-Ups"
          value={urgentFollowups}
          icon={Flame}
        />
        <KpiCard
          title="Unresolved Queries"
          value={pendingQueryCount}
          icon={AlertTriangle}
        />
      </div>

      <PartnerServicePipelineSummary
        activeCount={activeServiceCount}
        referrals={recentServiceReferrals}
      />

      {/* Communication Mediums Channel Distribution Card */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-emerald-600" />
            Outreach Channels & Communication Breakdown
          </h3>
          <span className="text-xs text-slate-500 font-mono font-medium">
            {totalInteractions} Total Logs
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: "Phone Calls",
              count: mediumCounts.phone,
              icon: PhoneCall,
              color: "text-emerald-700 bg-emerald-50 border-emerald-200",
            },
            {
              label: "WhatsApp Messages",
              count: mediumCounts.whatsapp,
              icon: MessageSquare,
              color: "text-green-700 bg-green-50 border-green-200",
            },
            {
              label: "Zoom / G-Meet 1:1",
              count: mediumCounts.zoom + mediumCounts.meet,
              icon: Video,
              color: "text-blue-700 bg-blue-50 border-blue-200",
            },
            {
              label: "Emails & In-Person",
              count: mediumCounts.email + mediumCounts.in_person + mediumCounts.sms,
              icon: Mail,
              color: "text-indigo-700 bg-indigo-50 border-indigo-200",
            },
          ].map((item) => {
            const Icon = item.icon;
            const pct =
              totalInteractions > 0
                ? Math.round((item.count / totalInteractions) * 100)
                : 0;

            return (
              <div
                key={item.label}
                className={`p-4 rounded-2xl border ${item.color} space-y-2`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">{item.label}</span>
                  <Icon className="w-4 h-4 opacity-80" />
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-black">{item.count}</span>
                  <span className="text-xs font-mono font-bold opacity-75">{pct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5-Stage Journey Breakdown Card */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <Layers className="w-4 h-4 text-amber-600" />
          Platinum 5-Stage Journey Distribution
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {PLATINUM_STAGES.map((s) => {
            const count = stageCounts[s.id] || 0;
            const pct = totalMembers > 0 ? Math.round((count / totalMembers) * 100) : 0;

            return (
              <div
                key={s.id}
                className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                    {s.number}
                  </span>
                  <span className="text-lg font-black text-slate-900">{count}</span>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">{s.name}</h4>
                  <p className="text-[10px] text-slate-500 truncate">{s.milestone}</p>
                </div>
                {/* Progress bar */}
                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Staff Outreach Stream & Allocations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Recent Activity Feed */}
        <div className="lg:col-span-2 p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <PhoneCall className="w-4 h-4 text-amber-600" />
              Live Team Outreach Activity
            </h3>
            <span className="text-xs text-slate-500 font-medium">Real-time Stream</span>
          </div>

          <div className="space-y-2.5">
            {recentLogs.length > 0 ? (
              recentLogs.map((log) => {
                const medMeta = getMediumMeta(log.medium);
                return (
                  <div
                    key={log.id}
                    className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-100/70 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${medMeta.badgeClass}`}
                        >
                          {medMeta.shortLabel}
                        </span>
                        <Link
                          href={`/members/${log.memberId}`}
                          className="font-bold text-xs text-slate-900 hover:text-amber-600 transition-colors"
                        >
                          {log.memberName}
                        </Link>
                        <span className="text-[10px] text-slate-500 font-mono">
                          ({log.memberCode})
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 truncate max-w-md">
                        {log.notes}
                      </p>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between text-[11px] text-slate-500">
                      <span className="text-slate-800 font-bold">
                        {log.staffName || "Staff"}
                      </span>
                      <span className="text-[10px]">{new Date(log.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-6 text-center text-xs text-slate-500">
                No recent activity logged.
              </div>
            )}
          </div>
        </div>

        {/* Right: Staff Executive Workload */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-amber-600" />
            Executive Workloads
          </h3>

          <div className="space-y-2">
            {Object.entries(execCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([execName, count]) => (
                <div
                  key={execName}
                  className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between"
                >
                  <span className="text-xs font-bold text-slate-800">{execName}</span>
                  <span className="text-xs font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-xl border border-amber-200">
                    {count} Members
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Attention Table */}
      <AttentionTable />
    </div>
  );
}
