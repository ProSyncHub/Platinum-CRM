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

export default function CallHistory({
  memberId,
}: Props) {
  const logs = callLogs.filter(
    (log) => log.memberId === memberId
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Call History
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left">
                <th className="py-3">
                  Date
                </th>

                <th>
                  Type
                </th>

                <th>
                  Outcome
                </th>

                <th>
                  Notes
                </th>
              </tr>
            </thead>

            <tbody>
              {logs.map((log) => (
                <tr
                  key={log.id}
                  className="border-b"
                >
                  <td className="py-4">
                    {log.date}
                  </td>

                  <td>
                    {log.type}
                  </td>

                  <td>
                    {log.outcome}
                  </td>

                  <td>
                    {log.notes}
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