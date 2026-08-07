import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import AdminDashboard from "@/components/dashboard/AdminDashboard";
import ManagerDashboard from "@/components/dashboard/ManagerDashboard";
import EmployeeDashboard from "@/components/dashboard/EmployeeDashboard";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return <div>Not authenticated</div>;
  }

  const { role, department } = session.user;

  if (role === "admin" || role === "superadmin") {
    return <AdminDashboard />;
  }

  if (role === "manager") {
    return <ManagerDashboard />;
  }

  return <EmployeeDashboard department={department} />;
}
