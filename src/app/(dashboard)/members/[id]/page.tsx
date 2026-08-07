import { notFound } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getMemberById } from "@/app/actions/memberActions";
import { getServicePartners } from "@/app/actions/serviceActions";
import MemberDetailClient from "@/components/members/MemberDetailClient";
import { prisma } from "@/lib/db";

interface Props {
  params: Promise<{
    id: string;
  }>;
}

export default async function MemberDetailsPage({ params }: Props) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  if (!id || id.length !== 24) {
    notFound();
  }

  const isSuperAdmin = ["admin", "superadmin"].includes(
    session?.user?.role?.trim().toLowerCase() || "",
  );
  const [{ success, member }, serviceResult, contactStaffOptions] = await Promise.all([
    getMemberById(id),
    getServicePartners(),
    isSuperAdmin
      ? prisma.user.findMany({
          where: { active: true },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            department: true,
          },
          orderBy: [{ department: "asc" }, { name: "asc" }],
        })
      : Promise.resolve([]),
  ]);

  if (!success || !member) {
    notFound();
  }

  return (
    <MemberDetailClient
      member={member}
      userRole={session?.user?.role}
      userDepartment={session?.user?.department}
      currentUserId={session?.user?.id}
      availableServicePartners={serviceResult.partners || []}
      contactStaffOptions={contactStaffOptions}
    />
  );
}
