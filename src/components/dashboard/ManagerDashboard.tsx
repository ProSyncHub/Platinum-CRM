import KpiCard from "@/components/dashboard/KpiCard";
import AttentionTable from "@/components/dashboard/AttentionTable";
import { Users, AlertTriangle, Phone, CalendarClock } from "lucide-react";

export default function ManagerDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Manager Dashboard</h1>
        <p className="mt-1 text-slate-500">
          Overview of all platinum members and team performance.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Total Members" value={426} icon={Users} />
        <KpiCard title="Needs Attention" value={23} icon={AlertTriangle} />
        <KpiCard title="Calls This Week" value={142} icon={Phone} />
        <KpiCard title="Followups Due" value={18} icon={CalendarClock} />
      </div>
      
      {/* Assuming AttentionTable takes props or fetches its own data */}
      <AttentionTable />
    </div>
  );
}
