import Link from "next/link";
import { getServerSession } from "next-auth/next";
import {
  ArrowRight,
  ArrowRightLeft,
  CalendarClock,
  PhoneCall,
  UserRound,
} from "lucide-react";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";
import {
  isElevatedViewer,
  memberScopeFor,
  normalizeDepartment,
} from "@/lib/authorization";
import { getFollowUpPriorityMeta } from "@/lib/followups";
import type { Prisma } from "@prisma/client";

const OPEN_STATUSES = ["pending", "in_progress"];

export default async function FollowUpOverviewPanel() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const viewer = session.user;
  const viewerId = viewer.id || "";
  const elevated = isElevatedViewer(viewer);
  const department = normalizeDepartment(viewer.department);
  const taskWhere: Prisma.FollowUpTaskWhereInput = {
    status: { in: OPEN_STATUSES },
    member: { is: memberScopeFor(viewer) },
    ...(elevated
      ? {}
      : {
          OR: [
            { assignedToUser: viewerId },
            {
              assignedToDepartment: {
                equals: department,
                mode: "insensitive" as const,
              },
            },
          ],
        }),
  };
  const [tasks, selfCount, transferredCount] = await Promise.all([
    prisma.followUpTask.findMany({
    where: taskWhere,
    select: {
      id: true,
      title: true,
      priority: true,
      dueAt: true,
      sourceType: true,
      assignmentType: true,
      assignedToUser: true,
      assignedToName: true,
      assignedToDepartment: true,
      createdByName: true,
      member: {
        select: {
          id: true,
          fullName: true,
          memberCode: true,
          phone: true,
        },
      },
    },
    orderBy: { dueAt: "asc" },
    take: 40,
    }),
    prisma.followUpTask.count({
      where: { AND: [taskWhere, { assignedToUser: viewerId }] },
    }),
    prisma.followUpTask.count({
      where: {
        AND: [
          taskWhere,
          {
            OR: [
              { sourceType: "transfer" },
              { assignmentType: "transferred" },
            ],
          },
        ],
      },
    }),
  ]);

  const visibleTasks = tasks
    .toSorted((left, right) => {
      const leftIsMine = left.assignedToUser === viewerId ? 0 : 1;
      const rightIsMine = right.assignedToUser === viewerId ? 0 : 1;
      return leftIsMine - rightIsMine || left.dueAt.getTime() - right.dueAt.getTime();
    })
    .slice(0, 8);

  if (visibleTasks.length === 0) return null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
            <CalendarClock className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-950">
              Follow-ups requiring action
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {selfCount} assigned to you · {transferredCount} transferred
            </p>
          </div>
        </div>
        <Link
          href="/followups"
          className="inline-flex items-center gap-2 self-start rounded-lg bg-slate-950 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800"
        >
          Open follow-up queue
          <ArrowRight className="h-4 w-4 text-amber-400" />
        </Link>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {visibleTasks.map((task) => {
          const isMine = task.assignedToUser === viewerId;
          const isTransferred =
            task.sourceType === "transfer" ||
            task.assignmentType === "transferred";
          const priority = getFollowUpPriorityMeta(task.priority);

          return (
            <Link
              key={task.id}
              href={`/workspace/${task.member.id}`}
              className="group rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-amber-300 hover:bg-amber-50/40"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold uppercase ${
                      isMine
                        ? "bg-amber-100 text-amber-800"
                        : isTransferred
                          ? "bg-violet-100 text-violet-800"
                          : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {isMine ? (
                      <PhoneCall className="h-3 w-3" />
                    ) : isTransferred ? (
                      <ArrowRightLeft className="h-3 w-3" />
                    ) : (
                      <UserRound className="h-3 w-3" />
                    )}
                    {isMine ? "Call again" : isTransferred ? "Transferred" : "Assigned"}
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${priority.badgeClass}`}
                  >
                    {priority.label}
                  </span>
                </div>
                <time
                  className="text-xs font-bold text-slate-600"
                >
                  {formatDue(task.dueAt)}
                </time>
              </div>
              <div className="mt-3">
                <p className="font-bold text-slate-950 group-hover:text-amber-800">
                  {task.member.fullName}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {task.member.memberCode} · {task.member.phone || "No phone"}
                </p>
                <p className="mt-2 text-sm font-medium text-slate-700">
                  {task.title}
                </p>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 text-xs">
                <span className="font-semibold text-slate-700">
                  To: {task.assignedToName} · {task.assignedToDepartment}
                </span>
                <span className="text-slate-500">
                  By {task.createdByName}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function formatDue(value: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(value);
}
