import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

export interface WorkforceDepartment {
  id?: string;
  _id?: string;
  name: string;
  code?: string;
  description?: string;
}

export interface WorkforceEmployee {
  id?: string;
  _id?: string;
  employeeId?: string;
  name: string;
  email: string;
  role?: string;
  department?: {
    id?: string;
    name: string;
    code?: string;
    description?: string;
    managerName?: string | null;
  } | string | null;
  departmentName?: string;
  phone?: string;
  active?: boolean;
}

function normalizeRole(roleStr?: string): "admin" | "manager" | "employee" {
  if (!roleStr) return "employee";
  const r = roleStr.toUpperCase().trim();
  if (r.includes("ADMIN") || r === "SUPER_ADMIN" || r === "SUPERADMIN") return "admin";
  if (r.includes("MANAGER") || r === "HR" || r.includes("LEAD") || r.includes("HEAD")) return "manager";
  return "employee";
}

function normalizeDepartment(dept?: unknown): string {
  if (!dept) return "operations";
  let name = "";
  if (typeof dept === "string") {
    name = dept;
  } else if (
    typeof dept === "object" &&
    "name" in dept &&
    typeof dept.name === "string"
  ) {
    name = dept.name;
  }

  const clean = name.toLowerCase().trim();
  if (clean.includes("e_com") || clean.includes("ecom") || clean.includes("commerce")) return "ecom";
  if (clean.includes("support") || clean.includes("customer")) return "support";
  if (clean.includes("sales")) return "sales";
  if (clean.includes("brand")) return "brand";
  if (clean.includes("sourcing")) return "sourcing";
  if (clean.includes("research")) return "research";
  if (clean.includes("hr")) return "hr";
  if (clean.includes("marketing")) return "marketing";
  if (clean.includes("onboard")) return "onboarding";

  return name || "operations";
}

function workforceApiBaseUrl() {
  return (process.env.WORKFORCE_API_URL || "https://api.prosyncedu.com/api").replace(/\/+$/, "");
}

function withApiPath(baseUrl: string, path: string) {
  return baseUrl.endsWith("/api") ? `${baseUrl}${path}` : `${baseUrl}/api${path}`;
}

export async function fetchWorkforceDepartments(): Promise<{
  success: boolean;
  departments?: WorkforceDepartment[];
  error?: string;
  status?: number;
}> {
  const baseUrl = workforceApiBaseUrl();
  const apiKey = process.env.WORKFORCE_API_KEY;
  if (!apiKey) {
    return { success: false, error: "WORKFORCE_API_KEY is not configured." };
  }

  try {
    const url = withApiPath(baseUrl, "/crm/departments");

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "X-API-KEY": apiKey,
        "Accept": "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const errorText = await res.text();
      return {
        success: false,
        status: res.status,
        error: `Workforce API error ${res.status}: ${errorText.slice(0, 150)}`,
      };
    }

    const json = await res.json();
    const dataObj = json.data || json;
    const departments: WorkforceDepartment[] = Array.isArray(dataObj)
      ? dataObj
      : dataObj.departments || [];

    return { success: true, departments };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to reach Workforce API",
    };
  }
}

export async function fetchWorkforceEmployees(): Promise<{
  success: boolean;
  employees?: WorkforceEmployee[];
  error?: string;
  status?: number;
}> {
  const baseUrl = workforceApiBaseUrl();
  const apiKey = process.env.WORKFORCE_API_KEY;
  if (!apiKey) {
    return { success: false, error: "WORKFORCE_API_KEY is not configured." };
  }

  try {
    const url = withApiPath(baseUrl, "/crm/employees");

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "X-API-KEY": apiKey,
        "Accept": "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const errorText = await res.text();
      return {
        success: false,
        status: res.status,
        error: `Workforce API error ${res.status}: ${errorText.slice(0, 150)}`,
      };
    }

    const json = await res.json();
    const dataObj = json.data || json;
    const employees: WorkforceEmployee[] = Array.isArray(dataObj)
      ? dataObj
      : dataObj.employees || [];

    return { success: true, employees };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to reach Workforce API",
    };
  }
}

export async function syncWorkforceStaffToCRM(): Promise<{
  success: boolean;
  syncedCount?: number;
  message?: string;
  error?: string;
  details?: { status?: number };
}> {
  const empResult = await fetchWorkforceEmployees();

  if (!empResult.success || !empResult.employees) {
    return {
      success: false,
      error: empResult.error || "Could not fetch employees from Workforce API",
      details: { status: empResult.status },
    };
  }

  let synced = 0;

  for (const emp of empResult.employees) {
    if (!emp.email || !emp.name) continue;

    const email = emp.email.toLowerCase().trim();
    const name = emp.name.trim();
    const role = normalizeRole(emp.role);
    const department = normalizeDepartment(emp.department || emp.departmentName);
    const initialPasswordHash = await bcrypt.hash(
      randomBytes(32).toString("base64url"),
      10,
    );

    await prisma.user.upsert({
      where: { email },
      update: {
        name,
        role,
        department,
        active: emp.active !== false,
      },
      create: {
        name,
        email,
        // New synced accounts stay inaccessible until an administrator sets a password.
        password: initialPasswordHash,
        role,
        department,
        active: emp.active !== false,
      },
    });

    synced++;
  }

  return {
    success: true,
    syncedCount: synced,
    message: `Successfully synchronized ${synced} workforce employees and departments!`,
  };
}

export async function verifyWorkforceCredentials(input: {
  email: string;
  password: string;
}): Promise<{
  success: boolean;
  employee?: {
    name: string;
    email: string;
    role: "admin" | "manager" | "employee";
    department: string;
    active: boolean;
  };
  error?: string;
}> {
  const apiKey = process.env.WORKFORCE_API_KEY;
  if (!apiKey) return { success: false, error: "WORKFORCE_API_KEY is not configured." };

  const email = input.email.trim().toLowerCase();
  const password = input.password;
  if (!email || !password) return { success: false, error: "Missing credentials." };

  const explicitUrl = process.env.WORKFORCE_AUTH_URL?.trim();
  const baseUrl = workforceApiBaseUrl();
  const urls = explicitUrl
    ? [explicitUrl]
    : [
        withApiPath(baseUrl, "/crm/auth/login"),
        withApiPath(baseUrl, "/auth/login"),
      ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "X-API-KEY": apiKey,
        },
        body: JSON.stringify({ email, password }),
        cache: "no-store",
      });
      if (res.status === 404 || res.status === 405) continue;
      if (!res.ok) return { success: false, error: "Invalid Workforce credentials." };

      const json = await res.json();
      const employee = json.employee || json.user || json.data?.employee || json.data?.user || json.data || json;
      if (!employee?.email) return { success: false, error: "Workforce login did not return an employee." };
      return {
        success: true,
        employee: {
          name: employee.name || employee.fullName || employee.email.split("@")[0],
          email: employee.email.toLowerCase().trim(),
          role: normalizeRole(employee.role),
          department: normalizeDepartment(employee.department || employee.departmentName),
          active: employee.active !== false,
        },
      };
    } catch {
      continue;
    }
  }

  return {
    success: false,
    error: "Workforce credential verification endpoint is not configured.",
  };
}
