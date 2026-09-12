import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";
import { hasUserCapability } from "@/lib/accessControl.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalized(value?: string | null) {
  return value?.trim().toLowerCase() || "";
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ queries: 0, wati: 0 });
  }

  const role = normalized(session.user.role);
  const department = normalized(session.user.department);
  const isAdmin = role === "owner" || role === "admin" || role === "superadmin";
  const isManager = role === "manager";
  const [canManageLeads, canAccessWati, canAssignLeads] = await Promise.all([
    hasUserCapability(session.user, "leads.manage"),
    hasUserCapability(session.user, "leads.wati"),
    hasUserCapability(session.user, "leads.assign"),
  ]);
  const showLeads = canManageLeads;
  const showWati = canManageLeads || canAccessWati || canAssignLeads;

  const queryWhere: Prisma.QueryTransferWhereInput = {
    status: "pending",
    ...(isAdmin
      ? {}
      : isManager
        ? {
            OR: [
              ...(department ? [{ toDepartment: { equals: department, mode: "insensitive" as const } }] : []),
              ...(session.user.id ? [{ assignedToUser: session.user.id }] : []),
            ],
          }
        : session.user.id
          ? { assignedToUser: session.user.id }
          : { id: "__none__" }),
  };

  const watiWhere: Prisma.LeadWhereInput = {
    source: { slug: "wati" },
    status: { not: "closed" },
    ...(isAdmin
      ? {}
      : isManager
        ? {
            OR: [
              ...(department ? [{ assignedToDepartment: { equals: department, mode: "insensitive" as const } }] : []),
              ...(session.user.id ? [{ assignedToUser: session.user.id }] : []),
            ],
          }
        : session.user.id
          ? { assignedToUser: session.user.id }
          : { id: "__none__" }),
  };

  const [queries, wati] = await Promise.all([
    prisma.queryTransfer.count({ where: queryWhere }),
    showWati ? prisma.lead.count({ where: watiWhere }) : Promise.resolve(0),
  ]);

  return NextResponse.json({
    queries,
    wati,
    access: {
      leads: showLeads,
      wati: showWati,
    },
  });
}
