import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";
import CallsExplorerClient from "@/components/calls/CallsExplorerClient";
import { PhoneCall, Sparkles } from "lucide-react";
import { memberScopeFor } from "@/lib/authorization";

export const dynamic = "force-dynamic";

export default async function CallsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const isSuperAdmin = ["admin", "superadmin"].includes(
    session.user.role?.trim().toLowerCase() || "",
  );

  // Fetch recent call logs and Super Admin attribution options in parallel.
  const [callLogs, contactStaffOptions] = await Promise.all([
    prisma.callLog.findMany({
      where: { member: memberScopeFor(session.user) },
      orderBy: { date: "desc" },
      take: 250,
      include: {
        member: {
          select: {
            id: true,
            fullName: true,
            firstName: true,
            lastName: true,
            memberCode: true,
            phone: true,
            email: true,
            programType: true,
            state: true,
            currentStage: true,
            allotedTo: true,
          },
        },
      },
    }),
    isSuperAdmin
      ? prisma.user.findMany({
          where: { active: true },
          select: { id: true, name: true, email: true, role: true, department: true },
          orderBy: [{ department: "asc" }, { name: "asc" }],
        })
      : Promise.resolve([]),
  ]);

  // Calculate statistics across call logs
  const totalCalls = callLogs.length;
  const whatsappCount = callLogs.filter((c) => (c.medium || "").toLowerCase().includes("whatsapp")).length;
  const phoneCount = callLogs.filter((c) => (c.medium || "phone").toLowerCase().includes("phone")).length;
  const zoomCount = callLogs.filter(
    (c) =>
      (c.medium || "").toLowerCase().includes("zoom") ||
      (c.medium || "").toLowerCase().includes("meet") ||
      (c.outcome || "").toLowerCase().includes("1-on-1")
  ).length;
  const connectedCount = callLogs.filter((c) =>
    (c.outcome || "").toLowerCase().includes("connect") ||
    (c.outcome || "").toLowerCase().includes("conduct") ||
    (c.outcome || "").toLowerCase().includes("resolve")
  ).length;

  const connectedRate = totalCalls > 0 ? Math.round((connectedCount / totalCalls) * 100) : 0;

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-amber-700 font-bold text-xs uppercase tracking-wider mb-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Cross-Channel Member Communications</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <PhoneCall className="w-7 h-7 text-amber-600" />
            Calls & Communications Registry
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Audit history across WhatsApp, Phone calls, Zoom 1-on-1 sessions, and department inquiries
          </p>
        </div>
      </div>

      {/* Interactive Calls Explorer */}
      <CallsExplorerClient
        initialLogs={callLogs}
        stats={{
          totalCalls,
          whatsappCount,
          phoneCount,
          zoomCount,
          connectedCount,
          connectedRate,
        }}
        currentUserRole={session?.user?.role}
        contactStaffOptions={contactStaffOptions}
      />
    </div>
  );
}
