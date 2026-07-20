import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const members = [
  {
    name: "John Smith",
    stage: "Research Phase",
    days: 42,
    status: "Delayed",
  },
  {
    name: "Sarah Khan",
    stage: "Sourcing Stage",
    days: 29,
    status: "Review",
  },
  {
    name: "David",
    stage: "Approval Stage",
    days: 18,
    status: "Followup",
  },
];

export default function AttentionTable() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Members Requiring Attention
        </CardTitle>
      </CardHeader>

      <CardContent>
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="py-3 text-left">
                Member
              </th>

              <th className="text-left">
                Stage
              </th>

              <th className="text-left">
                Days
              </th>

              <th className="text-left">
                Status
              </th>
            </tr>
          </thead>

          <tbody>
            {members.map((member) => (
              <tr
                key={member.name}
                className="border-b"
              >
                <td className="py-4">
                  {member.name}
                </td>

                <td>
                  {member.stage}
                </td>

                <td>
                  {member.days}
                </td>

                <td>
                  {member.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}