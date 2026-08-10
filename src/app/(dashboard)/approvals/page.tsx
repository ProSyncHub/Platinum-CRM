import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getAllPrograms } from "@/app/actions/programActions";
import { prisma } from "@/lib/db";
import MemberApprovalQueue from "@/components/workspace/MemberApprovalQueue";

export default async function ApprovalsPage() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role?.trim().toLowerCase();
  if (role !== "admin" && role !== "superadmin") redirect("/workspace");

  const [{ programs }, pendingMembers] = await Promise.all([
    getAllPrograms(),
    prisma.member.findMany({
      where: { approvalStatus: "pending" },
      include: { callLogs: { orderBy: { date: "desc" }, take: 1 } },
      orderBy: { submittedAt: "asc" },
    }),
  ]);

  return (
    <MemberApprovalQueue
      members={JSON.parse(JSON.stringify(pendingMembers))}
      programs={(programs || []).filter((program: { active?: boolean }) => program.active !== false)}
    />
  );
}
