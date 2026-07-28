import { useSession } from "next-auth/react";

export function usePermissions() {
  const { data: session } = useSession();

  const isManager = session?.user?.role === "manager";
  const department = session?.user?.department;

  return {
    isManager,
    canEditEcom: isManager || department === "ecom",
    canEditBrand: isManager || department === "brand",
    canEditFollowUp: isManager || department === "follow_up",
    department,
  };
}
