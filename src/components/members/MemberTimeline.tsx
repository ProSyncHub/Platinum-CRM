import { callLogs } from "@/lib/mock-data/callLogs";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Props {
  memberId: string;
}

export default function MemberTimeline({
  memberId,
}: Props) {
  const memberLogs = callLogs.filter(
    (log) => log.memberId === memberId
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Member Timeline
        </CardTitle>
      </CardHeader>

      <CardContent>
        {memberLogs.length === 0 ? (
          <div className="py-10 text-center text-slate-500">
            No activity found.
          </div>
        ) : (
          <div className="space-y-6">
            {memberLogs.map((log, index) => (
              <div
                key={log.id}
                className="relative flex gap-4"
              >
                {index !== memberLogs.length - 1 && (
                  <div className="absolute top-4 left-[5px] h-full w-[2px] bg-slate-200" />
                )}

                <div className="relative z-10 mt-1 h-3 w-3 rounded-full bg-slate-900" />

                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">
                      {log.outcome}
                    </p>

                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                      {log.type}
                    </span>
                  </div>

                  <p className="mt-1 text-sm text-slate-600">
                    {log.notes}
                  </p>

                  <p className="mt-2 text-xs text-slate-400">
                    {log.date}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}