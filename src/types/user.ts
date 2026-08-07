export type Role = "superadmin" | "admin" | "manager" | "employee";

export type Department = string;

export interface User {
  id: string;
  name: string;
  email: string;
  department: Department;
  role: Role;
  active: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
