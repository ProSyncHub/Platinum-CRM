"use server";

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";
import { isAdminViewer, normalizeDepartment } from "@/lib/authorization";
import type { Prisma } from "@prisma/client";

const OPEN_QUERY_STATUSES = new Set(["pending", "in_progress"]);

type QueryRecord = Awaited<ReturnType<typeof findQueryTransfers>>[number];

async function findQueryTransfers(where: Prisma.QueryTransferWhereInput) {
  return prisma.queryTransfer.findMany({
    where,
    include: {
      member: {
        select: {
          id: true,
          fullName: true,
          memberCode: true,
          phone: true,
          email: true,
          programType: true,
          callLogs: {
            select: {
              id: true,
              date: true,
              medium: true,
              type: true,
              outcome: true,
              notes: true,
              staffName: true,
              staffDepartment: true,
              staffUserId: true,
            },
            orderBy: { date: "desc" },
            take: 20,
          },
        },
      },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 250,
  });
}

function sourceCommunication(ticket: QueryRecord) {
  const exact = ticket.sourceCallLogId
    ? ticket.member.callLogs.find((log) => log.id === ticket.sourceCallLogId)
    : undefined;
  if (exact) return exact;

  // Transfers created before sourceCallLogId existed are matched safely using
  // the same team and timestamp. New transfers always carry the exact ID.
  return ticket.member.callLogs.find((log) => {
    const sameDepartment =
      normalizeDepartment(log.staffDepartment) === normalizeDepartment(ticket.fromDepartment);
    const createdTogether =
      Math.abs(log.date.getTime() - ticket.createdAt.getTime()) < 2 * 60_000;
    return sameDepartment && createdTogether;
  });
}

function serializeTicket(ticket: QueryRecord) {
  const source = sourceCommunication(ticket);
  return {
    id: ticket.id,
    status: ticket.status,
    priority: ticket.priority,
    reason: ticket.reason,
    fromDepartment: ticket.fromDepartment,
    toDepartment: ticket.toDepartment,
    assignedToUser: ticket.assignedToUser,
    assignedToName: ticket.assignedToName,
    assignedToEmail: ticket.assignedToEmail,
    createdByUser: ticket.createdByUser,
    createdByName: ticket.createdByName,
    sourceCallLogId: ticket.sourceCallLogId,
    createdAt: ticket.createdAt.toISOString(),
    resolutionNotes: ticket.resolutionNotes,
    resolutionMedium: ticket.resolutionMedium,
    resolvedByName: ticket.resolvedByName,
    resolvedByEmail: ticket.resolvedByEmail,
    resolvedAt: ticket.resolvedAt?.toISOString() || null,
    member: {
      id: ticket.member.id,
      fullName: ticket.member.fullName,
      memberCode: ticket.member.memberCode,
      phone: ticket.member.phone,
      email: ticket.member.email,
      programType: ticket.member.programType,
    },
    sourceCommunication: source
      ? {
          id: source.id,
          date: source.date.toISOString(),
          medium: source.medium,
          type: source.type,
          outcome: source.outcome,
          notes: source.notes,
          staffName: source.staffName,
          staffDepartment: source.staffDepartment,
          staffUserId: source.staffUserId,
        }
      : null,
  };
}

function canViewTicket(
  ticket: { assignedToUser?: string | null; createdByUser?: string | null; toDepartment: string; member: { callLogs: Array<{ staffUserId?: string | null }> } },
  user: { id?: string; role?: string | null; department?: string | null },
) {
  if (isAdminViewer(user)) return true;
  if (ticket.assignedToUser && ticket.assignedToUser === user.id) return true;
  if (ticket.createdByUser && ticket.createdByUser === user.id) return true;
  if (ticket.member.callLogs.some((log) => log.staffUserId && log.staffUserId === user.id)) return true;
  return (
    user.role?.trim().toLowerCase() === "manager" &&
    normalizeDepartment(ticket.toDepartment) === normalizeDepartment(user.department)
  );
}

export async function getQueryDesk() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { success: false, error: "Unauthorized", tickets: [] };

  const user = session.user;
  const admin = isAdminViewer(user);
  const manager = user.role?.trim().toLowerCase() === "manager";
  const department = normalizeDepartment(user.department);
  const where = admin
    ? {}
    : manager
      ? {
          OR: [
            ...(user.id ? [{ assignedToUser: user.id }] : []),
            ...(user.id ? [{ createdByUser: user.id }] : []),
            { toDepartment: { equals: department, mode: "insensitive" as const } },
          ],
        }
      : user.id
        ? { OR: [{ assignedToUser: user.id }, { createdByUser: user.id }] }
        : { assignedToUser: "__unassigned__" };

  try {
    const [directTransfers, legacyTransfers] = await Promise.all([
      findQueryTransfers(where),
      // Transfers created before creator tracking are identified by their
      // original communication so the sender can still review them.
      admin || !user.id
        ? Promise.resolve([])
        : findQueryTransfers({ createdByUser: { isSet: false } }),
    ]);
    const transfers = [...directTransfers, ...legacyTransfers].filter(
      (transfer, index, list) => list.findIndex((candidate) => candidate.id === transfer.id) === index,
    );
    const tickets = transfers
      .map(serializeTicket)
      .filter((ticket) => {
        if (admin) return true;
        const sentByLegacySource = ticket.sourceCommunication?.staffUserId === user.id;
        const assignedToMe = ticket.assignedToUser === user.id;
        const sentByMe = ticket.createdByUser === user.id || sentByLegacySource;
        const belongsToDepartment = normalizeDepartment(ticket.toDepartment) === department;
        return assignedToMe || sentByMe || (manager && belongsToDepartment);
      });
    return {
      success: true,
      tickets,
      viewer: {
        id: user.id || "",
        name: user.name || "Staff member",
        role: user.role || "employee",
        department,
        scope: admin ? "admin" : manager ? "manager" : "employee",
      },
      counts: {
        open: tickets.filter((ticket) => OPEN_QUERY_STATUSES.has(ticket.status)).length,
        resolved: tickets.filter((ticket) => ticket.status === "resolved").length,
        assignedToMe: tickets.filter((ticket) => ticket.assignedToUser === user.id && OPEN_QUERY_STATUSES.has(ticket.status)).length,
        sentByMe: tickets.filter((ticket) => (ticket.createdByUser === user.id || ticket.sourceCommunication?.staffUserId === user.id) && OPEN_QUERY_STATUSES.has(ticket.status)).length,
        department: manager
          ? tickets.filter((ticket) => normalizeDepartment(ticket.toDepartment) === department && OPEN_QUERY_STATUSES.has(ticket.status)).length
          : 0,
      },
    };
  } catch (error) {
    console.error("Query desk load failed:", error);
    return { success: false, error: "Could not load transferred queries.", tickets: [] };
  }
}

export async function getQueryTicket(queryId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { success: false, error: "Unauthorized", ticket: null };

  try {
    const transfers = await findQueryTransfers({ id: queryId });
    const ticket = transfers[0];
    if (!ticket || !canViewTicket(ticket, session.user)) {
      return { success: false, error: "You do not have access to this transferred query.", ticket: null };
    }
    return {
      success: true,
      ticket: serializeTicket(ticket),
      viewer: {
        id: session.user.id || "",
        role: session.user.role || "employee",
        department: normalizeDepartment(session.user.department),
      },
    };
  } catch (error) {
    console.error("Query ticket load failed:", error);
    return { success: false, error: "Could not load this transferred query.", ticket: null };
  }
}
