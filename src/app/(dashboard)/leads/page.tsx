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

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession(authOptions);
  await ensureDefaultLeadSources();
  if (!session?.user) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-700">Please sign in to open leads.</div>;
  }
  const [canManageLeads, canAccessWatiLeads, canAssignLeads] = await Promise.all([
    hasUserCapability(session.user, "leads.manage"),
    hasUserCapability(session.user, "leads.wati"),
    hasUserCapability(session.user, "leads.assign"),
  ]);
  const canOpenWatiQueue = canAccessWatiLeads || canAssignLeads;
  if (!canManageLeads && !canOpenWatiQueue) {
    return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950">You do not have access to leads. Ask the Owner to enable “Access WATI leads” for your role.</div>;
  }

  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const requestedSourceSlug = typeof params.source === "string" ? params.source : "";
  const sourceSlug = canManageLeads ? requestedSourceSlug : "wati";
  const status =
    typeof params.status === "string" && VALID_STATUSES.has(params.status) ? params.status : "";
  const requestedPage = typeof params.page === "string" ? Number(params.page) : 1;
  const page = Number.isFinite(requestedPage) ? Math.max(1, Math.trunc(requestedPage)) : 1;

  const where: Prisma.LeadWhereInput = {
    ...(sourceSlug ? { source: { slug: sourceSlug } } : {}),
    ...(status ? { status } : {}),
    ...(query
      ? {
          OR: [
            { fullName: { contains: query, mode: "insensitive" } },
            { phone: { contains: query } },
            { email: { contains: query, mode: "insensitive" } },
            { campaign: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [sources, totalFiltered, leads, totalLeads, newLeads, questionLeads, watiLeads, imports, staff] =
    await Promise.all([
      prisma.leadSource.findMany({
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
        orderBy: [{ active: "desc" }, { name: "asc" }],
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
      prisma.lead.count(),
      prisma.lead.count({ where: { status: "new" } }),
      prisma.lead.count({ where: { responseCode: "has_question", status: { not: "closed" } } }),
      prisma.lead.count({ where: { source: { slug: "wati" } } }),
      prisma.leadImportBatch.findMany({
        include: { source: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.user.findMany({
        where: { active: true },
        select: { id: true, name: true, email: true, department: true },
        orderBy: [{ department: "asc" }, { name: "asc" }],
      }),
    ]);

  const role = session?.user?.role?.toLowerCase() || "employee";
  const isAdmin = canManageLeads || role === "admin" || role === "superadmin";

  return (
    <LeadsWorkspace
      leads={leads.map((lead) => ({
        ...lead,
        receivedAt: lead.receivedAt.toISOString(),
        createdAt: lead.createdAt.toISOString(),
        updatedAt: lead.updatedAt.toISOString(),
      }))}
      sources={(canManageLeads ? sources : sources.filter((source) => source.slug === "wati")).map((source) => ({
        ...source,
        createdAt: source.createdAt.toISOString(),
        updatedAt: source.updatedAt.toISOString(),
      }))}
      imports={imports.map((batch) => ({
        id: batch.id,
        fileName: batch.fileName,
        status: batch.status,
        totalRows: batch.totalRows,
        imported: batch.imported,
        skipped: batch.skipped,
        failed: batch.failed,
        createdAt: batch.createdAt.toISOString(),
        source: batch.source,
      }))}
      stats={{ totalLeads, newLeads, questionLeads, watiLeads }}
      filters={{ query, source: sourceSlug, status }}
      pagination={{ page, pageSize: PAGE_SIZE, total: totalFiltered }}
      isAdmin={isAdmin}
      canAssignLeads={canManageLeads || canAssignLeads}
      staff={staff}
    />
  );
}
