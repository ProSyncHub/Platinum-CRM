import KpiCard from "@/components/dashboard/KpiCard";
import { Users, Phone, CalendarClock, Target } from "lucide-react";

interface EmployeeDashboardProps {
  department: string;
}

export default function EmployeeDashboard({ department }: EmployeeDashboardProps) {
  // We can fetch department specific stats here in the future
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold capitalize">{department} Dashboard</h1>
        <p className="mt-1 text-slate-500">
          Overview of your assigned members and tasks.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="My Assigned Members" value={42} icon={Users} />
        <KpiCard title="My Active Tasks" value={5} icon={Target} />
        <KpiCard title="My Calls Today" value={12} icon={Phone} />
        <KpiCard title="My Followups Due" value={3} icon={CalendarClock} />
      </div>

      <div className="bg-white rounded-lg border shadow-sm p-6">
        <h2 className="text-xl font-semibold mb-4">My Recent Assignments</h2>
        <div className="text-slate-500 text-sm">
          Table showing members recently assigned to {department} will go here.
        </div>
      </div>
    </div>
  );
}
