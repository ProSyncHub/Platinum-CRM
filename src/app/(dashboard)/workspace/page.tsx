import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getAllPrograms } from "@/app/actions/programActions";
import { prisma } from "@/lib/db";
import MemberWorkspaceClient from "@/components/workspace/MemberWorkspaceClient";
import FollowUpOverviewPanel from "@/components/dashboard/FollowUpOverviewPanel";

export default async function MemberWorkspacePage() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role?.trim().toLowerCase() || "employee";
  const isAdmin = role === "admin" || role === "superadmin";
  const [{ programs }, pendingApprovals] = await Promise.all([
    getAllPrograms(),
    isAdmin
      ? prisma.member.count({ where: { approvalStatus: "pending" } })
      : Promise.resolve(0),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      <FollowUpOverviewPanel />
      <MemberWorkspaceClient
        programs={(programs || [])
          .filter((program: { active?: boolean }) => program.active !== false)
          .map((program: { id?: string; name: string }) => ({
            id: program.id || program.name,
            name: program.name,
          }))}
        userName={session?.user?.name || "Staff Member"}
        department={session?.user?.department || "operations"}
        isAdmin={isAdmin}
        pendingApprovals={pendingApprovals}
      />
    </div>
  );
}
