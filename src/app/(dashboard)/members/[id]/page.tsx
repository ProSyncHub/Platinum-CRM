import { notFound } from "next/navigation";

import { members } from "@/lib/mock-data/members";

import MemberOverview from "@/components/members/MemberOverview";
import MemberTimeline from "@/components/members/MemberTimeline";
import AddCallDialog from "@/components/members/AddCallDialog";
import CallHistory from "@/components/members/CallHistory";

import { Button } from "@/components/ui/button";
import MemberFollowups from "@/components/members/MemberFollowups";
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

  const member = members.find(
    (member) => member.id === id
  );

  if (!member) {
    notFound();
  }

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
          <AddCallDialog />

          <Button variant="outline">
            Schedule Followup
          </Button>
        </div>
      </div>

      {/* Overview */}
      <MemberOverview member={member} />

      {/* Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Timeline */}
        <div className="space-y-6 lg:col-span-2">
            <MemberTimeline memberId={member.id} />

            <CallHistory memberId={member.id} />
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

                <p className="font-medium">
                  {getStageLabel(member.currentStage)}
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

              <div>
                <p className="text-sm text-slate-500">
                  Executive
                </p>

                <p className="font-medium">
                  {member.assignedResearchExecutive}
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-500">
                  Next Followup
                </p>

                <p className="font-medium">
                  {member.nextFollowupDate}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-white p-5">
            <h3 className="font-semibold">
              <MemberFollowups
                memberId={member.id}
              />
            </h3>

            <div className="mt-4 space-y-3">
              <div className="rounded-lg border p-3">
                <p className="font-medium">
                  Follow-up Call
                </p>

                <p className="text-sm text-slate-500">
                  Due: 8 Jul 2026
                </p>
              </div>

              <div className="rounded-lg border p-3">
                <p className="font-medium">
                  Research Review
                </p>

                <p className="text-sm text-slate-500">
                  Pending
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}