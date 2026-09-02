import { notFound } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getMemberById } from "@/app/actions/memberActions";
import { getServicePartners } from "@/app/actions/serviceActions";
import MemberDetailClient from "@/components/members/MemberDetailClient";
import { prisma } from "@/lib/db";
import { hasUserCapability } from "@/lib/accessControl.server";

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

  const canManageOneOnOnes = session?.user
    ? await hasUserCapability(session.user, "sessions.manage")
    : false;
  const [{ success, member }, serviceResult, contactStaffOptions, oneOnOneSessions] = await Promise.all([
    getMemberById(id),
    getServicePartners(),
    prisma.user.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
      },
      orderBy: [{ department: "asc" }, { name: "asc" }],
    }),
    prisma.oneOnOneSession.findMany({
      where: { memberId: id },
      orderBy: [{ sessionNumber: "asc" }, { sequence: "desc" }],
      select: {
        id: true,
        sessionNumber: true,
        sequence: true,
        status: true,
        scheduledStart: true,
        plannedDuration: true,
        actualStart: true,
        actualEnd: true,
        verifiedMinutes: true,
        attendanceStatus: true,
        attendanceMatchMethod: true,
        memberQuestions: true,
        preparationNotes: true,
        coordinatorUserId: true,
        coordinatorName: true,
        coordinatorEmail: true,
        zoomMeetingId: true,
        joinUrl: true,
        transcriptStatus: true,
        aiStatus: true,
        aiSummary: true,
        lastError: true,
        cancellationReason: true,
        completedAt: true,
      },
    }),
  ]);

  if (!success || !member) {
    notFound();
  }

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
      ...contactStaffOptions.map((user) => user.department.trim().toLowerCase()),
    ]),
  ).sort();

  return (
    <MemberDetailClient
      member={member}
      userRole={session?.user?.role}
      userDepartment={session?.user?.department}
      currentUserId={session?.user?.id}
      currentUserName={session?.user?.name || "Staff Member"}
      availableServicePartners={serviceResult.partners || []}
      contactStaffOptions={contactStaffOptions}
      oneOnOneSessions={JSON.parse(JSON.stringify(oneOnOneSessions))}
      canManageOneOnOnes={canManageOneOnOnes}
      departments={departments}
    />
  );
}
