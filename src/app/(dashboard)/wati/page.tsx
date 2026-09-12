import { getServerSession } from "next-auth/next";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import LeadsWorkspace from "@/components/leads/LeadsWorkspace";
import { prisma } from "@/lib/db";
import { ensureDefaultLeadSources } from "@/lib/leads";
import { hasUserCapability } from "@/lib/accessControl.server";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 40;
const VALID_STATUSES = new Set(["new", "contacted", "qualified", "converted", "closed"]);

export default async function WatiPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession(authOptions);
  await ensureDefaultLeadSources();
  if (!session?.user) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-700">Please sign in to open WATI.</div>;
  }

  const [canManageLeads, canAccessWatiLeads, canAssignLeads] = await Promise.all([
    hasUserCapability(session.user, "leads.manage"),
    hasUserCapability(session.user, "leads.wati"),
    hasUserCapability(session.user, "leads.assign"),
  ]);
  const canOpenWatiQueue = canManageLeads || canAccessWatiLeads || canAssignLeads;
  if (!canOpenWatiQueue) {
    return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950">You do not have access to WATI. Ask the Owner to enable “Access WATI leads” for your role.</div>;
  }

  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const status =
    typeof params.status === "string" && VALID_STATUSES.has(params.status) ? params.status : "";
  const requestedPage = typeof params.page === "string" ? Number(params.page) : 1;
  const page = Number.isFinite(requestedPage) ? Math.max(1, Math.trunc(requestedPage)) : 1;
  const viewerDepartment = session.user.department?.trim() || "";

  const where: Prisma.LeadWhereInput = {
    source: { slug: "wati" },
    ...(status ? { status } : {}),
    ...(query
      ? {
          OR: [
            { fullName: { contains: query, mode: "insensitive" } },
            { phone: { contains: query } },
            { email: { contains: query, mode: "insensitive" } },
            { campaign: { contains: query, mode: "insensitive" } },
            { responseText: { contains: query, mode: "insensitive" } },
            { notes: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  if (!canManageLeads && !canAssignLeads) {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      {
        OR: [
          ...(session.user.id ? [{ assignedToUser: session.user.id }] : []),
          ...(session.user.email
            ? [{ assignedToEmail: { equals: session.user.email, mode: "insensitive" as const } }]
            : []),
          ...(viewerDepartment
            ? [{ assignedToDepartment: { equals: viewerDepartment, mode: "insensitive" as const } }]
            : []),
        ],
      },
    ];
  }

  const [sources, totalFiltered, leads, totalLeads, newLeads, questionLeads, watiLeads, staff] =
    await Promise.all([
      prisma.leadSource.findMany({
        where: { slug: "wati" },
        select: {
          id: true,
          name: true,
          slug: true,
          sourceType: true,
          description: true,
          active: true,
          webhookEnabled: true,
          webhookSecretHint: true,
          defaultCampaign: true,
          defaultDepartment: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.lead.count({ where }),
      prisma.lead.findMany({
        where,
        include: {
          source: { select: { name: true, slug: true } },
          member: { select: { id: true, fullName: true, memberCode: true } },
        },
        orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.lead.count({ where: { source: { slug: "wati" } } }),
      prisma.lead.count({ where: { source: { slug: "wati" }, status: "new" } }),
      prisma.lead.count({
        where: {
          source: { slug: "wati" },
          responseCode: "has_question",
          status: { not: "closed" },
        },
      }),
      prisma.lead.count({ where: { source: { slug: "wati" } } }),
      prisma.user.findMany({
        where: { active: true },
        select: { id: true, name: true, email: true, department: true },
        orderBy: [{ department: "asc" }, { name: "asc" }],
      }),
    ]);

  const role = session.user.role?.toLowerCase() || "employee";
  const isAdmin = canManageLeads || role === "admin" || role === "superadmin" || role === "owner";

  return (
    <LeadsWorkspace
      leads={leads.map((lead) => ({
        ...lead,
        receivedAt: lead.receivedAt.toISOString(),
        createdAt: lead.createdAt.toISOString(),
        updatedAt: lead.updatedAt.toISOString(),
      }))}
      sources={sources.map((source) => ({
        ...source,
        createdAt: source.createdAt.toISOString(),
        updatedAt: source.updatedAt.toISOString(),
      }))}
      imports={[]}
      stats={{ totalLeads, newLeads, questionLeads, watiLeads }}
      filters={{ query, source: "wati", status }}
      pagination={{ page, pageSize: PAGE_SIZE, total: totalFiltered }}
      isAdmin={isAdmin}
      canAssignLeads={canManageLeads || canAssignLeads}
      staff={staff}
      mode="wati"
    />
  );
}
