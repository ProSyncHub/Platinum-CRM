import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getAllMembers } from "@/app/actions/memberActions";
import { getAllPrograms } from "@/app/actions/programActions";
import MembersTable from "@/components/members/MembersTable";
import { Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const session = await getServerSession(authOptions);
  const { members, stats } = await getAllMembers();
  const { programs } = await getAllPrograms();

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-amber-700 font-bold text-xs uppercase tracking-wider mb-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>ProSync Membership & Client Registry</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Members & Clients Registry
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Unified directory for Platinum, PNP, Amazon Wealth Shortcut & Custom Programs — automated 6-month expirations, journey pipelines, and cross-channel contact tracking
          </p>
        </div>
      </div>

      {/* Interactive Table with full Members */}
      <MembersTable
        initialMembers={members}
        stats={stats}
        userRole={session?.user?.role}
        userDepartment={session?.user?.department}
        initialPrograms={programs || []}
      />
    </div>
  );
}