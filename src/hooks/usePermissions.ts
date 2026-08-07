import { useSession } from "next-auth/react";

export function usePermissions() {
  const { data: session, status } = useSession();

  const role = session?.user?.role?.trim().toLowerCase();
  const department = session?.user?.department?.trim().toLowerCase();

  const isAdmin = role === "admin" || role === "superadmin";
  const isManager = role === "manager" || isAdmin;

  const canEditDepartment = (targetDepartment: string) => {
    if (isAdmin || isManager) return true;
    return department?.toLowerCase() === targetDepartment.toLowerCase();
  };

  return {
    isAdmin,
    isManager,
    role,
    department,
    canEditDepartment,
    canManageTeam: isAdmin,
    isLoading: status === "loading",
    user: session?.user,
  };
}
