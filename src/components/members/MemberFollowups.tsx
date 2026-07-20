import { followups } from "@/lib/mock-data/followups";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Props {
  memberId: string;
}

export default function MemberFollowups({
  memberId,
}: Props) {
  const data = followups.filter(
    (item) => item.memberId === memberId
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Upcoming Followups
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div className="space-y-3">
          {data.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border p-3"
            >
              <p className="font-medium">
                {item.title}
              </p>

              <p className="text-sm text-slate-500">
                Due: {item.dueDate}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}