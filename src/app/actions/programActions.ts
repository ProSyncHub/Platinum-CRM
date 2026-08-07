"use server";

import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { revalidatePath } from "next/cache";

export interface ProgramInput {
  name: string;
  codePrefix: string;
  description?: string;
  icon?: string;
  color?: string;
  badgeColor?: string;
}

// Initial fallback programs
const DEFAULT_PROGRAMS = [
  {
    name: "Platinum",
    codePrefix: "PLT",
    description: "Exclusive high-touch 5-stage VIP mentorship program",
    icon: "👑",
    color: "#b45309",
    badgeColor: "amber",
    order: 1,
  },
  {
    name: "PNP",
    codePrefix: "PNP",
    description: "Accelerated Plug & Play fast-track store launch program",
    icon: "⚡",
    color: "#0e7490",
    badgeColor: "cyan",
    order: 2,
  },
  {
    name: "Amazon Wealth Shortcut",
    codePrefix: "AWS",
    description: "Fast-paced Amazon e-commerce scaling & wealth creation blueprint",
    icon: "🚀",
    color: "#7e22ce",
    badgeColor: "purple",
    order: 3,
  },
];

/**
 * Fetch all programs, auto-seeding default initial programs if database is empty
 */
export async function getAllPrograms() {
  try {
    let programs = await (prisma as any).program.findMany({
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });

    // Seed defaults if empty
    if (!programs || programs.length === 0) {
      for (const def of DEFAULT_PROGRAMS) {
        await (prisma as any).program.upsert({
          where: { name: def.name },
          update: {},
          create: def,
        });
      }
      programs = await (prisma as any).program.findMany({
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      });
    }

    return { success: true, programs };
  } catch (error: any) {
    console.error("Error fetching programs:", error);
    return { success: false, error: error.message, programs: DEFAULT_PROGRAMS };
  }
}

/**
 * Create a new program (Admin only)
 */
export async function createProgram(input: ProgramInput) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !["admin", "superadmin"].includes(session.user.role?.trim().toLowerCase() || "")) {
    return { success: false, error: "Only Administrators can create new programs." };
  }

  try {
    const trimmedName = input.name.trim();
    const trimmedPrefix = input.codePrefix.trim().toUpperCase();

    if (!trimmedName) {
      return { success: false, error: "Program name is required." };
    }
    if (!trimmedPrefix) {
      return { success: false, error: "Program code prefix is required (e.g. AWS, PLT, PNP)." };
    }

    // Check if name or prefix exists
    const existing = await (prisma as any).program.findFirst({
      where: {
        OR: [
          { name: { equals: trimmedName, mode: "insensitive" } },
          { codePrefix: { equals: trimmedPrefix, mode: "insensitive" } },
        ],
      },
    });

    if (existing) {
      return {
        success: false,
        error: `A program with the name "${trimmedName}" or code prefix "${trimmedPrefix}" already exists.`,
      };
    }

    const program = await (prisma as any).program.create({
      data: {
        name: trimmedName,
        codePrefix: trimmedPrefix,
        description: input.description?.trim() || "",
        icon: input.icon || "🚀",
        color: input.color || "#7e22ce",
        badgeColor: input.badgeColor || "purple",
        active: true,
      },
    });

    revalidatePath("/members");
    revalidatePath("/reports");
    revalidatePath("/followups");
    revalidatePath("/calls");
    revalidatePath("/dashboard");

    return { success: true, program };
  } catch (error: any) {
    console.error("Error creating program:", error);
    return { success: false, error: error.message || "Failed to create program" };
  }
}

/**
 * Update an existing program (Admin only)
 */
export async function updateProgram(
  id: string,
  input: Partial<ProgramInput> & { active?: boolean }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !["admin", "superadmin"].includes(session.user.role?.trim().toLowerCase() || "")) {
    return { success: false, error: "Only Administrators can update programs." };
  }

  try {
    const data: any = {};
    if (input.name) data.name = input.name.trim();
    if (input.codePrefix) data.codePrefix = input.codePrefix.trim().toUpperCase();
    if (input.description !== undefined) data.description = input.description.trim();
    if (input.icon) data.icon = input.icon;
    if (input.color) data.color = input.color;
    if (input.badgeColor) data.badgeColor = input.badgeColor;
    if (input.active !== undefined) data.active = input.active;

    const updated = await (prisma as any).program.update({
      where: { id },
      data,
    });

    revalidatePath("/members");
    revalidatePath("/reports");
    revalidatePath("/followups");
    revalidatePath("/calls");
    revalidatePath("/dashboard");

    return { success: true, program: updated };
  } catch (error: any) {
    console.error("Error updating program:", error);
    return { success: false, error: error.message || "Failed to update program" };
  }
}

/**
 * Delete a program (Admin only)
 */
export async function deleteProgram(id: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !["admin", "superadmin"].includes(session.user.role?.trim().toLowerCase() || "")) {
    return { success: false, error: "Only Administrators can delete programs." };
  }

  try {
    // Find the program
    const program = await (prisma as any).program.findUnique({
      where: { id },
    });

    if (!program) {
      return { success: false, error: "Program not found" };
    }

    // Check if any members are enrolled
    const enrolledMembers = await prisma.member.count({
      where: {
        programType: {
          contains: program.name,
          mode: "insensitive",
        },
      },
    });

    if (enrolledMembers > 0) {
      return {
        success: false,
        error: `Cannot delete "${program.name}" because ${enrolledMembers} members are currently enrolled. Reassign members before deleting.`,
      };
    }

    await (prisma as any).program.delete({
      where: { id },
    });

    revalidatePath("/members");
    revalidatePath("/reports");
    revalidatePath("/followups");
    revalidatePath("/calls");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error: any) {
    console.error("Error deleting program:", error);
    return { success: false, error: error.message || "Failed to delete program" };
  }
}
