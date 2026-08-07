import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";
import { getAllMembers } from "@/app/actions/memberActions";
import { getAllPrograms } from "@/app/actions/programActions";
import ReportsOverviewClient from "@/components/reports/ReportsOverviewClient";
import { BarChart3, Sparkles } from "lucide-react";
import { memberScopeFor } from "@/lib/authorization";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const { members, stats } = await getAllMembers();
  const { programs } = await getAllPrograms();

  // Aggregate call logs for channel metrics
  const totalCallLogs = await prisma.callLog.count({
    where: { member: memberScopeFor(session.user) },
  });
  const queryTransfers = await prisma.queryTransfer.findMany({
    where: { member: memberScopeFor(session.user) },
    take: 100,
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-amber-700 font-bold text-xs uppercase tracking-wider mb-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Executive Intelligence & Analytics</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <BarChart3 className="w-7 h-7 text-amber-600" />
            Program Reports & Operations Analytics
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Cohort health, 6-month expiration timelines, cross-channel engagement, and staff execution velocity
          </p>
        </div>
      </div>

      {/* Interactive Reports View */}
      <ReportsOverviewClient
        members={members}
        stats={stats}
        totalCallLogs={totalCallLogs}
        queryTransfers={queryTransfers}
        currentUserRole={session?.user?.role}
        availablePrograms={programs || []}
      />
    </div>
  );
}
