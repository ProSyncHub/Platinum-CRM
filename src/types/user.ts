export type Department =
  | "manager"
  | "research"
  | "brand"
  | "approval"
  | "growth";

export interface User {
  id: string;

  name: string;

  email: string;

  department: Department;

  role: "admin" | "manager" | "employee";

  active: boolean;
}