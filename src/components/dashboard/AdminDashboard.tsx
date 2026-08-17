import Link from "next/link";
import { prisma } from "@/lib/db";
import KpiCard from "@/components/dashboard/KpiCard";
import AttentionTable from "@/components/dashboard/AttentionTable";
import {
  Shield,
  Users,
  UserPlus,
  Briefcase,
  PhoneCall,
  ArrowRight,
  AlertTriangle,
  Building,
  Sparkles,
  Handshake,
} from "lucide-react";
import { getAllPrograms } from "@/app/actions/programActions";
import AdminProgramManager from "@/components/programs/AdminProgramManager";
import PartnerServicePipelineSummary from "@/components/dashboard/PartnerServicePipelineSummary";
import FollowUpOverviewPanel from "@/components/dashboard/FollowUpOverviewPanel";

export default async function AdminDashboard() {
  const { programs } = await getAllPrograms();
  // Fetch high-level statistics for Admin
  const [members, totalCallLogs, pendingQueryCount, activeServiceCount, recentServiceReferrals, pendingRegistrations] =
    await Promise.all([
      prisma.member.findMany({
        where: {
          OR: [
            { approvalStatus: null },
            { approvalStatus: { isSet: false } },
            { approvalStatus: "approved" },
          ],
        },
        select: { programType: true, memberCode: true },
      }),
      prisma.callLog.count(),
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
      prisma.member.count({ where: { approvalStatus: "pending" } }),
    ]);

  const activeUsers = await prisma.user.count({ where: { active: true } });

  const totalMembers = members.length;
  let platinumCount = 0;
  let pnpCount = 0;
  let awsCount = 0;
  let customCount = 0;

  members.forEach((m) => {
    const raw = (m.programType || "").toLowerCase();
    if (raw.includes("pnp") || m.memberCode?.startsWith("PNP")) {
      pnpCount++;
    } else if (raw.includes("amazon") || raw.includes("wealth") || raw.includes("aws")) {
      awsCount++;
    } else if (raw.includes("plat") || !raw) {
      platinumCount++;
    } else {
      customCount++;
    }
  });

  const breakdownSummary = [
    platinumCount > 0 ? `👑 ${platinumCount} Plat` : null,
    pnpCount > 0 ? `⚡ ${pnpCount} PNP` : null,
    awsCount > 0 ? `🚀 ${awsCount} AWS` : null,
    customCount > 0 ? `🎯 ${customCount} Other` : null,
  ].filter(Boolean).join(" • ") || "0 enrolled";

  return (
    <div className="space-y-6 pb-12">
      {/* Top Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700 border border-amber-200">
            <Shield size={13} className="text-amber-600" />
            Administrator Executive Control Center
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            ProSync Operations & Executive Control
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Monitor organizational performance, Workforce sync, staff roles, and multi-program client cohorts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <AdminProgramManager initialPrograms={programs || []} />
          <Link
            href="/services"
            className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-xs font-bold text-indigo-800 transition-colors hover:bg-indigo-100"
          >
            <Handshake size={15} />
            Partner Services
          </Link>
          <Link
            href="/team"
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-all"
          >
            <UserPlus size={15} className="text-amber-400" />
            Manage Staff & Team
          </Link>
          <Link
            href="/members"
            className="inline-flex items-center gap-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 transition-colors"
          >
            <Users size={15} />
            Members Registry
          </Link>
        </div>
      </div>

      {pendingRegistrations > 0 && (
        <Link
          href="/approvals"
          className="flex items-center justify-between gap-4 rounded-2xl border border-violet-200 bg-violet-50 px-5 py-4 text-sm text-violet-950 transition hover:bg-violet-100"
        >
          <span><strong>{pendingRegistrations} new registration{pendingRegistrations === 1 ? "" : "s"}</strong> waiting for Super Admin approval.</span>
          <span className="inline-flex items-center gap-1 font-bold">Review <ArrowRight className="h-4 w-4" /></span>
        </Link>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Total Active Members"
          value={`${totalMembers}`}
          subtitle={breakdownSummary}
          icon={Users}
        />
        <KpiCard
          title="Synced Team Staff"
          value={activeUsers}
          icon={Briefcase}
        />
        <KpiCard
          title="Total Communications"
          value={totalCallLogs}
          icon={PhoneCall}
        />
        <KpiCard
          title="Unresolved Queries"
          value={pendingQueryCount}
          icon={AlertTriangle}
        />
      </div>

      <FollowUpOverviewPanel />

      <PartnerServicePipelineSummary
        activeCount={activeServiceCount}
        referrals={recentServiceReferrals}
      />

      {/* Quick Access Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left 2 Cols: Attention Table */}
        <div className="space-y-6 lg:col-span-2">
          <AttentionTable />
        </div>

        {/* Right 1 Col: Admin Shortcuts & System Info */}
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600" />
              Administrative Quick Actions
            </h3>

            <div className="space-y-3">
              <AdminProgramManager initialPrograms={programs || []} compact />
              <Link
                href="/team"
                className="group flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200 hover:border-slate-300 hover:bg-slate-100 transition-all text-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
                    <UserPlus size={16} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 group-hover:text-amber-700 transition-colors">
                      Manage Staff & Roles
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Configure roles, managers & departments
                    </p>
                  </div>
                </div>
                <ArrowRight
                  size={15}
                  className="text-slate-400 group-hover:translate-x-0.5 group-hover:text-amber-700 transition"
                />
              </Link>

              <Link
                href="/members"
                className="group flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200 hover:border-slate-300 hover:bg-slate-100 transition-all text-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-700 border border-purple-200">
                    <Building size={16} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 group-hover:text-purple-700 transition-colors">
                      Platinum Members Directory
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Full roster, stages & expiration tracker
                    </p>
                  </div>
                </div>
                <ArrowRight
                  size={15}
                  className="text-slate-400 group-hover:translate-x-0.5 group-hover:text-purple-700 transition"
                />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
