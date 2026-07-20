import Link from "next/link";

import { members } from "@/lib/mock-data/members";
import StatusBadge from "./StatusBadge";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function MembersTable() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Platinum Members</CardTitle>
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-sm text-slate-500">
                <th className="py-3 text-left font-medium">
                  Member
                </th>

                <th className="text-left font-medium">
                  Stage
                </th>

                <th className="text-left font-medium">
                  Milestone
                </th>

                <th className="text-left font-medium">
                  Executive
                </th>

                <th className="text-left font-medium">
                  Followup
                </th>

                <th className="text-left font-medium">
                  Status
                </th>
              </tr>
            </thead>

            <tbody>
              {members.map((member) => (
                <tr
                  key={member.id}
                  className="border-b transition-colors hover:bg-slate-50"
                >
                  <td className="py-4">
                    <Link href={`/members/${member.id}`}>
                      <div className="cursor-pointer">
                        <p className="font-medium transition-colors hover:text-blue-600">
                          {member.fullName}
                        </p>

                        <p className="text-sm text-slate-500">
                          {member.memberCode}
                        </p>
                      </div>
                    </Link>
                  </td>

                  <td>
                    <span className="font-medium">
                      {member.currentStage}
                    </span>
                  </td>

                  <td>
                    {member.currentMilestone}
                  </td>

                  <td>
                    {member.assignedResearchExecutive}
                  </td>

                  <td>
                    {member.nextFollowupDate}
                  </td>

                  <td>
                    <StatusBadge
                      status={member.status}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}