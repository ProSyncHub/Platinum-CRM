"use server";

import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { syncWorkforceStaffToCRM } from "@/lib/workforce";

// Helper to check admin access
async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !["admin", "superadmin"].includes(session.user.role)) {
    throw new Error("Forbidden: Admin access required.");
  }
  return session.user;
}

// Helper to check staff access (Admin or Manager)
async function requireStaff() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !["admin", "superadmin", "manager"].includes(session.user.role)) {
    throw new Error("Forbidden: Staff access required.");
  }
  return session.user;
}

export async function getAllTeamMembers() {
  await requireStaff();

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      active: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const totalStaff = users.length;
  const totalAdmins = users.filter((u) => ["admin", "superadmin"].includes(u.role)).length;
  const totalManagers = users.filter((u) => u.role === "manager").length;
  const totalEmployees = users.filter((u) => u.role === "employee").length;
  const activeCount = users.filter((u) => u.active).length;

  const departmentsSet = new Set<string>();
  users.forEach((u) => {
    if (u.department) departmentsSet.add(u.department);
  });
  const departments = Array.from(departmentsSet);

  return {
    users,
    stats: {
      totalStaff,
      totalAdmins,
      totalManagers,
      totalEmployees,
      activeCount,
      departments,
    },
  };
}

export async function createTeamMember(data: {
  name: string;
  email: string;
  password: string;
  role: "admin" | "manager" | "employee";
  department: string;
  active?: boolean;
}) {
  await requireAdmin();

  const { name, email, password, role, department, active = true } = data;

  if (!name?.trim() || !email?.trim() || !password?.trim() || !role || !department?.trim()) {
    return { success: false, error: "All required fields must be provided." };
  }

  const normalizedEmail = email.trim().toLowerCase();

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingUser) {
    return { success: false, error: "A user with this email already exists." };
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = await prisma.user.create({
    data: {
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role,
      department: department.trim(),
      active,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      active: true,
    },
  });

  revalidatePath("/team");
  revalidatePath("/dashboard");

  return { success: true, user: newUser };
}

export async function updateTeamMember(
  id: string,
  data: {
    name: string;
    email: string;
    role: "admin" | "manager" | "employee";
    department: string;
    active: boolean;
    password?: string;
  }
) {
  const admin = await requireAdmin();

  const { name, email, role, department, active, password } = data;

  if (!name?.trim() || !email?.trim() || !role || !department?.trim()) {
    return { success: false, error: "All required fields must be provided." };
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Check email conflict with another user
  const emailConflict = await prisma.user.findFirst({
    where: {
      email: normalizedEmail,
      id: { not: id },
    },
  });

  if (emailConflict) {
    return { success: false, error: "Another user already uses this email address." };
  }

  // Prevent admin from removing their own admin role or deactivating themselves
  if (admin.id === id) {
    if (role !== "admin") {
      return { success: false, error: "You cannot remove your own admin privileges." };
    }
    if (!active) {
      return { success: false, error: "You cannot deactivate your own account." };
    }
  }

  const updatePayload: {
    name: string;
    email: string;
    role: string;
    department: string;
    active: boolean;
    password?: string;
  } = {
    name: name.trim(),
    email: normalizedEmail,
    role,
    department: department.trim(),
    active,
  };

  if (password && password.trim().length > 0) {
    if (password.length < 6) {
      return { success: false, error: "Password must be at least 6 characters long." };
    }
    updatePayload.password = await bcrypt.hash(password, 10);
  }

  const updatedUser = await prisma.user.update({
    where: { id },
    data: updatePayload,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      active: true,
    },
  });

  revalidatePath("/team");
  revalidatePath("/dashboard");

  return { success: true, user: updatedUser };
}

export async function toggleTeamMemberStatus(id: string) {
  const admin = await requireAdmin();

  if (admin.id === id) {
    return { success: false, error: "You cannot deactivate your own account." };
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return { success: false, error: "User not found." };
  }

  const updatedUser = await prisma.user.update({
    where: { id },
    data: { active: !target.active },
    select: { id: true, active: true },
  });

  revalidatePath("/team");
  return { success: true, active: updatedUser.active };
}

export async function deleteTeamMember(id: string) {
  const admin = await requireAdmin();

  if (admin.id === id) {
    return { success: false, error: "You cannot delete your own account." };
  }

  await prisma.user.delete({ where: { id } });

  revalidatePath("/team");
  return { success: true };
}

export async function toggleManagerRole(id: string) {
  const admin = await requireAdmin();

  if (admin.id === id) {
    return { success: false, error: "You cannot change the role of the primary admin account." };
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return { success: false, error: "Staff member not found." };
  }

  if (target.role === "admin") {
    return { success: false, error: "Cannot toggle role for administrator account." };
  }

  const newRole = target.role === "manager" ? "employee" : "manager";

  const updatedUser = await prisma.user.update({
    where: { id },
    data: { role: newRole },
    select: { id: true, name: true, email: true, role: true, department: true },
  });

  revalidatePath("/team");
  revalidatePath("/dashboard");

  return {
    success: true,
    user: updatedUser,
    newRole,
    message: `${updatedUser.name || updatedUser.email} is now assigned as ${newRole === "manager" ? "Manager" : "Employee"}.`,
  };
}

export async function setStaffRole(id: string, role: "manager" | "employee") {
  const admin = await requireAdmin();

  if (admin.id === id) {
    return { success: false, error: "You cannot change the role of the primary admin account." };
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return { success: false, error: "Staff member not found." };
  }

  const updatedUser = await prisma.user.update({
    where: { id },
    data: { role },
    select: { id: true, name: true, email: true, role: true, department: true },
  });

  revalidatePath("/team");
  revalidatePath("/dashboard");

  return {
    success: true,
    user: updatedUser,
    message: `${updatedUser.name || updatedUser.email} updated to ${role === "manager" ? "Manager" : "Employee"}.`,
  };
}

export async function syncWorkforceStaffAction() {
  await requireAdmin();
  const res = await syncWorkforceStaffToCRM();
  if (res.success) {
    revalidatePath("/team");
    revalidatePath("/dashboard");
  }
  return res;
}
