import KpiCard from "@/components/dashboard/KpiCard";
import AttentionTable from "@/components/dashboard/AttentionTable";

import {
  Users,
  AlertTriangle,
  Phone,
  CalendarClock,
} from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">
          Dashboard
        </h1>

        <p className="mt-1 text-slate-500">
          Overview of your platinum members.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Total Members"
          value={426}
          icon={Users}
        />

        <KpiCard
          title="Delayed Members"
          value={23}
          icon={AlertTriangle}
        />

        <KpiCard
          title="Calls This Week"
          value={142}
          icon={Phone}
        />

        <KpiCard
          title="Followups Due"
          value={18}
          icon={CalendarClock}
        />
      </div>
      <AttentionTable />
    </div>
  );
}