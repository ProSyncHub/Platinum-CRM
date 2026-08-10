import { notFound } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getMemberById } from "@/app/actions/memberActions";
import { prisma } from "@/lib/db";
import MemberJourneyWorkspace from "@/components/workspace/MemberJourneyWorkspace";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function MemberJourneyPage({ params }: Props) {
  const { id } = await params;
  if (!/^[a-f\d]{24}$/i.test(id)) notFound();

  const session = await getServerSession(authOptions);
  if (!session?.user) notFound();
  const role = session.user.role?.trim().toLowerCase() || "employee";
  const isAdmin = role === "admin" || role === "superadmin";

  const [memberResult, activeUsers] = await Promise.all([
    getMemberById(id),
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true, email: true, department: true },
      orderBy: [{ department: "asc" }, { name: "asc" }],
    }),
  ]);

  if (!memberResult.success || !memberResult.member) notFound();

  const departments = Array.from(
    new Set([
      "brand",
      "ecom",
      "operations",
      "support",
      "sourcing",
      "research",
      "sales",
      "accounts",
      "gst",
      "management",
      ...activeUsers.map((user) => user.department.trim().toLowerCase()),
    ]),
  ).sort();

  return (
    <MemberJourneyWorkspace
      member={JSON.parse(JSON.stringify(memberResult.member))}
      user={{
        id: session.user.id || "",
        name: session.user.name || "Staff Member",
        role,
        department: session.user.department || "operations",
      }}
      departments={departments}
      contactStaffOptions={isAdmin ? activeUsers : []}
    />
  );
}
