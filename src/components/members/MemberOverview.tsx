import { Member } from "@/types/member";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Props {
  member: Member;
}

export default function MemberOverview({
  member,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Member Overview
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-sm text-slate-500">
              Current Stage
            </p>

            <p className="font-medium">
              {member.currentStage}
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
                Research Executive
            </p>

            <p className="font-medium">
                {member.assignedResearchExecutive}
            </p>
          </div>

          <div>
            <p className="text-sm text-slate-500">
              Last Contact
            </p>

            <p className="font-medium">
              {member.lastContactDate}
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

          <div>
            <p className="text-sm text-slate-500">
              Status
            </p>

            <p className="font-medium">
              {member.status}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}