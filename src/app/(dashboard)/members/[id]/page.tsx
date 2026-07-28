import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";

import MemberOverview from "@/components/members/MemberOverview";
import MemberTimeline from "@/components/members/MemberTimeline";
import LogCallButton from "@/components/members/LogCallButton";

import { Button } from "@/components/ui/button";
import { getStageLabel } from "@/lib/utils/stage";

interface Props {
  params: Promise<{
    id: string;
  }>;
}

export default async function MemberDetailsPage({
  params,
}: Props) {
  const { id } = await params;

  // We should handle invalid ObjectID format, but for now we let it throw or handle it
  if (!id.match(/^[0-9a-fA-F]{24}$/)) {
    notFound();
  }

  const member = await prisma.member.findUnique({
    where: { id },
    include: {
      callLogs: {
        orderBy: { date: 'desc' }
      },
      queryTransfers: {
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  if (!member) {
    notFound();
  }

  const events = [
    ...member.callLogs.map(log => ({
      id: log.id,
      type: "call" as const,
      date: log.date,
      title: `Call: ${log.outcome}`,
      description: log.notes
    })),
    ...member.queryTransfers.map(transfer => ({
      id: transfer.id,
      type: "transfer" as const,
      date: transfer.createdAt,
      title: `Transferred to ${transfer.toDepartment}`,
      description: transfer.reason
    }))
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">
            {member.fullName}
          </h1>

          <p className="mt-2 text-slate-500">
            {member.memberCode}
          </p>
        </div>

        <div className="flex gap-3">
          <LogCallButton memberId={member.id} />

          <Button variant="outline">
            Schedule Followup
          </Button>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Timeline */}
        <div className="space-y-6 lg:col-span-2">
            <MemberTimeline events={events} />
        </div>

        {/* Quick Stats */}
        <div className="space-y-6">
          <div className="rounded-xl border bg-white p-5">
            <h3 className="font-semibold">
              Quick Stats
            </h3>

            <div className="mt-4 space-y-4">
              <div>
                <p className="text-sm text-slate-500">
                  Current Stage
                </p>

                <p className="font-medium capitalize">
                  {member.currentStage.replace("_", " ")}
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-500">
                  Milestone
                </p>

                <p className="font-medium">
                  {member.currentMilestone}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}