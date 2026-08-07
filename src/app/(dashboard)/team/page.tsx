import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getAllTeamMembers } from "@/app/actions/userManagement";
import TeamTable from "@/components/team/TeamTable";
import { ShieldAlert, Sparkles } from "lucide-react";

export default async function TeamPage() {
  const session = await getServerSession(authOptions);

  const role = session?.user?.role?.trim().toLowerCase();
  if (!session?.user || (!["admin", "superadmin", "manager"].includes(role || ""))) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/20 text-rose-400 mb-3 border border-rose-500/30">
          <ShieldAlert size={24} />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Access Denied</h2>
        <p className="mt-1 text-sm text-slate-500">
          Only administrators and managers can view team management.
        </p>
      </div>
    );
  }

  const { users, stats } = await getAllTeamMembers();

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-amber-700 font-bold text-xs uppercase tracking-wider mb-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Workforce & Access Control</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            Team & Staff Management
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage your administrators, managers, employees, and real-time Workforce API synchronization.
          </p>
        </div>
      </div>

      {/* Team Table & Controls */}
      <TeamTable
        initialUsers={users}
        stats={stats}
        currentUserRole={session.user.role}
        currentUserId={session.user.id}
      />
    </div>
  );
}
