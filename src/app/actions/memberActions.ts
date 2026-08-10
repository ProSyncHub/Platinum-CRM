"use server";

import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { revalidatePath } from "next/cache";
import {
  getMembershipStatus,
  PLATINUM_STAGES,
  parseSalesValue,
  getContactAttentionStatus,
  generateMemberCode,
  getProgramMeta,
  MediumId,
} from "@/lib/membershipUtils";
import {
  canAccessMember,
  isElevatedViewer,
  memberScopeFor,
  normalizeDepartment,
} from "@/lib/authorization";
import {
  composeMemberBackground,
  syncMemberBackground,
} from "@/lib/memberBackground";
import { buildMemberAiSource } from "@/lib/memberAi";

export interface MemberFilterOptions {
  search?: string;
  stage?: string;
  status?: string; // "all", "active", "expiring_soon", "expired", "on_hold"
  programType?: string; // "all", "Platinum", "PNP", etc.
  allotedTo?: string;
  businessType?: string;
  state?: string;
  medium?: string; // "all", "phone", "whatsapp", "zoom", "meet", "email"
  urgency?: string; // "all", "urgent", "due_soon", "healthy"
}

export async function getAllMembers(filters: MemberFilterOptions = {}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { success: false, error: "Unauthorized", members: [], stats: null };
  }

  try {
    const rawMembers = await prisma.member.findMany({
      where: {
        AND: [
          memberScopeFor(session.user),
          {
            OR: [
              { approvalStatus: null },
              { approvalStatus: { isSet: false } },
              { approvalStatus: "approved" },
            ],
          },
        ],
      },
      include: {
        callLogs: {
          orderBy: { date: "desc" },
          take: 5,
        },
        queryTransfers: {
          orderBy: { createdAt: "desc" },
          take: 3,
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    // Process each member with real-time expiration & journey metrics
    let totalRevenue = 0;
    let activeCount = 0;
    let expiringSoonCount = 0;
    let expiredCount = 0;
    let onHoldCount = 0;
    let urgentFollowups = 0;
    let platinumCount = 0;
    let pnpCount = 0;

    // Dynamic program breakdown
    const programBreakdown: Record<string, number> = {
      Platinum: 0,
      PNP: 0,
      "Amazon Wealth Shortcut": 0,
    };

    const mediumCounts: Record<string, number> = {
      phone: 0,
      whatsapp: 0,
      zoom: 0,
      meet: 0,
      email: 0,
      sms: 0,
      telegram: 0,
      in_person: 0,
    };

    const stageBreakdown: Record<string, number> = {
      onboarding: 0,
      research: 0,
      sourcing: 0,
      approval: 0,
      growth: 0,
    };

    const executiveBreakdown: Record<string, number> = {};
    const statesSet = new Set<string>();

    const processedMembers = rawMembers.map((m) => {
      const statusInfo = getMembershipStatus(
        m.enrollingDate,
        m.endDate,
        m.activeStatus
      );

      const latestInteraction = m.callLogs[0] || null;
      const verifiedLastConnectDate = latestInteraction?.date || null;
      const contactStatus = getContactAttentionStatus(
        verifiedLastConnectDate,
        m.nextConnectDate
      );

      if (contactStatus.urgency === "urgent" || contactStatus.urgency === "due_soon") {
        urgentFollowups++;
      }

      const medium = (m.lastContactMedium || "phone").toLowerCase();
      if (mediumCounts[medium] !== undefined) {
        mediumCounts[medium]++;
      }

      // Track Program Types Dynamically
      const rawProg = m.programType || "Platinum";
      let progName = rawProg;
      if (rawProg.toLowerCase().includes("pnp") || rawProg.toLowerCase().includes("plug")) {
        progName = "PNP";
      } else if (rawProg.toLowerCase().includes("plat")) {
        progName = "Platinum";
      } else if (rawProg.toLowerCase().includes("amazon") || rawProg.toLowerCase().includes("wealth") || rawProg.toLowerCase().includes("aws") || rawProg.toLowerCase().includes("shortcut")) {
        progName = "Amazon Wealth Shortcut";
      }

      programBreakdown[progName] = (programBreakdown[progName] || 0) + 1;
      if (progName === "Platinum") platinumCount++;
      else if (progName === "PNP") pnpCount++;

      // Track KPIs
      if (statusInfo.status === "Active") activeCount++;
      else if (statusInfo.status === "Expiring Soon") {
        expiringSoonCount++;
        activeCount++; // Expiring soon is still active
      } else if (statusInfo.status === "Expired" || statusInfo.status === "Not Active") {
        expiredCount++;
      } else if (statusInfo.status === "On Hold") {
        onHoldCount++;
      }

      if (m.currentStage && stageBreakdown[m.currentStage] !== undefined) {
        stageBreakdown[m.currentStage]++;
      }

      if (m.allotedTo) {
        executiveBreakdown[m.allotedTo] =
          (executiveBreakdown[m.allotedTo] || 0) + 1;
      }

      if (m.state) statesSet.add(m.state);

      const revenue = m.salesAmount || parseSalesValue(m.salesData);
      totalRevenue += revenue;

      return {
        ...m,
        programType: m.programType || "Platinum",
        lastConnectDate: verifiedLastConnectDate,
        lastContactMedium: latestInteraction?.medium || null,
        lastContactStaff: latestInteraction?.staffName || null,
        latestInteraction,
        statusInfo,
        contactStatus,
        revenue,
      };
    });

    // Apply Filters
    let filtered = processedMembers;

    if (filters.search) {
      const q = filters.search.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m.fullName.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q) ||
          m.phone.includes(q) ||
          m.memberCode.toLowerCase().includes(q) ||
          (m.programType && m.programType.toLowerCase().includes(q)) ||
          (m.allotedTo && m.allotedTo.toLowerCase().includes(q)) ||
          (m.brandCollaborations && m.brandCollaborations.toLowerCase().includes(q)) ||
          (m.state && m.state.toLowerCase().includes(q)) ||
          (m.notes && m.notes.toLowerCase().includes(q))
      );
    }

    if (filters.programType && filters.programType !== "all") {
      const targetProg = filters.programType.toLowerCase();
      filtered = filtered.filter((m) => {
        const prog = (m.programType || "Platinum").toLowerCase();
        if (targetProg === "pnp") return prog.includes("pnp");
        if (targetProg === "platinum" || targetProg === "plat") return prog.includes("plat");
        return prog === targetProg;
      });
    }

    if (filters.stage && filters.stage !== "all") {
      filtered = filtered.filter((m) => m.currentStage === filters.stage);
    }

    if (filters.status && filters.status !== "all") {
      if (filters.status === "active") {
        filtered = filtered.filter(
          (m) => m.statusInfo.status === "Active" || m.statusInfo.status === "Expiring Soon"
        );
      } else if (filters.status === "expiring_soon") {
        filtered = filtered.filter((m) => m.statusInfo.isExpiringSoon);
      } else if (filters.status === "expired") {
        filtered = filtered.filter((m) => m.statusInfo.isExpired);
      } else if (filters.status === "on_hold") {
        filtered = filtered.filter((m) => m.statusInfo.status === "On Hold");
      }
    }

    if (filters.allotedTo && filters.allotedTo !== "all") {
      filtered = filtered.filter(
        (m) => m.allotedTo?.toLowerCase() === filters.allotedTo?.toLowerCase()
      );
    }

    if (filters.businessType && filters.businessType !== "all") {
      filtered = filtered.filter(
        (m) => m.businessType?.toLowerCase() === filters.businessType?.toLowerCase()
      );
    }

    if (filters.state && filters.state !== "all") {
      filtered = filtered.filter((m) => m.state === filters.state);
    }

    if (filters.medium && filters.medium !== "all") {
      filtered = filtered.filter(
        (m) => (m.lastContactMedium || "phone").toLowerCase() === filters.medium?.toLowerCase()
      );
    }

    if (filters.urgency && filters.urgency !== "all") {
      filtered = filtered.filter(
        (m) => m.contactStatus.urgency === filters.urgency
      );
    }

    return {
      success: true,
      members: filtered,
      stats: {
        totalMembers: rawMembers.length,
        platinumCount,
        pnpCount,
        programBreakdown,
        activeCount,
        expiringSoonCount,
        expiredCount,
        onHoldCount,
        urgentFollowups,
        totalRevenue,
        stageBreakdown,
        mediumCounts,
        executives: Object.keys(executiveBreakdown).sort(),
        states: Array.from(statesSet).sort(),
      },
    };
  } catch (err: any) {
    console.error("Error in getAllMembers:", err);
    return { success: false, error: err.message, members: [], stats: null };
  }
}

export async function getMemberById(id: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { success: false, error: "Unauthorized", member: null };
  }

  try {
    const member = await prisma.member.findFirst({
      where: { AND: [{ id }, memberScopeFor(session.user)] },
      include: {
        callLogs: {
          orderBy: { date: "desc" },
        },
        queryTransfers: {
          orderBy: { createdAt: "desc" },
        },
        departmentUpdates: {
          orderBy: { createdAt: "desc" },
        },
        aiAnalysis: true,
        serviceReferrals: {
          include: { partner: true },
          orderBy: { updatedAt: "desc" },
        },
      },
    });

    if (!member) {
      return { success: false, error: "Member not found", member: null };
    }

    const statusInfo = getMembershipStatus(
      member.enrollingDate,
      member.endDate,
      member.activeStatus
    );

    const latestInteraction = member.callLogs[0] || null;
    const verifiedLastConnectDate = latestInteraction?.date || null;
    const contactStatus = getContactAttentionStatus(
      verifiedLastConnectDate,
      member.nextConnectDate
    );
    const generatedBackground = composeMemberBackground({
      existingNotes: member.notes,
      manualBackground: member.detailedNotes,
      communications: member.callLogs,
      departmentUpdates: member.departmentUpdates,
    });
    const aiSource = buildMemberAiSource({
      ...member,
      notes: generatedBackground,
    });
    const aiAnalysisNeedsRefresh =
      !member.aiAnalysis ||
      member.aiAnalysis.status !== "ready" ||
      !member.aiAnalysis.analysisJson ||
      member.aiAnalysis.sourceHash !== aiSource.sourceHash;

    return {
      success: true,
      member: {
        ...member,
        notes: generatedBackground,
        lastConnectDate: verifiedLastConnectDate,
        lastContactMedium: latestInteraction?.medium || null,
        lastContactStaff: latestInteraction?.staffName || null,
        latestInteraction,
        statusInfo,
        contactStatus,
        revenue: member.salesAmount || parseSalesValue(member.salesData),
        aiAnalysisNeedsRefresh,
        aiAnalysisSourceHash: aiSource.sourceHash,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message, member: null };
  }
}

export async function createMember(data: {
  firstName: string;
  lastName?: string;
  email: string;
  phone: string;
  programType?: string;
  state?: string;
  enrollingDate?: string;
  plan?: string;
  allotedTo?: string;
  businessType?: string;
  brandCollaborations?: string;
  plBrand?: string;
  resellingBrand?: string;
  salesData?: string;
  currentStage?: "onboarding" | "research" | "sourcing" | "approval" | "growth";
  budgetAvailable?: string;
  notes?: string;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const duplicate = await prisma.member.findFirst({
      where: {
        OR: [
          { email: { equals: data.email.trim(), mode: "insensitive" } },
          { phone: data.phone.trim() },
        ],
      },
      select: { id: true, memberCode: true },
    });
    if (duplicate) {
      return {
        success: false,
        error: `This contact already exists as ${duplicate.memberCode}.`,
        memberId: duplicate.id,
      };
    }

    const administrator = ["admin", "superadmin"].includes(
      session.user.role?.trim().toLowerCase() || "",
    );
    const year = new Date().getFullYear();
    const programType = data.programType || "Platinum";
    const count = await prisma.member.count({
      where: {
        programType: {
          equals: programType,
          mode: "insensitive",
        },
      },
    });
    const memberCode = generateMemberCode(programType, count + 1, year);

    const enrolling = data.enrollingDate ? new Date(data.enrollingDate) : new Date();
    const plan = data.plan || "6 Months";

    // Auto-calculate End Date based on Plan
    const endDate = new Date(enrolling);
    if (plan === "Yearly") {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 6);
    }

    const fullName = `${data.firstName} ${data.lastName || ""}`.trim();
    const stage = data.currentStage || "onboarding";
    const stageObj = PLATINUM_STAGES.find((s) => s.id === stage);

    const salesAmount = parseSalesValue(data.salesData);

    const member = await prisma.member.create({
      data: {
        memberCode,
        programType,
        department: normalizeDepartment(session.user.department),
        firstName: data.firstName,
        lastName: data.lastName,
        fullName,
        email: data.email,
        phone: data.phone,
        state: data.state,
        enrollingDate: enrolling,
        endDate: endDate,
        plan,
        activeStatus: administrator ? "Active" : "Pending Approval",
        approvalStatus: administrator ? "approved" : "pending",
        requestedProgram: programType,
        submittedByUser: session.user.id || null,
        submittedByName: session.user.name || "Staff Member",
        submittedByEmail: session.user.email || "",
        submittedByDepartment: normalizeDepartment(session.user.department),
        submittedAt: new Date(),
        allotedTo: data.allotedTo || session.user.name || null,
        businessType: data.businessType || "Reseller",
        brandCollaborations: data.brandCollaborations,
        plBrand: data.plBrand,
        resellingBrand: data.resellingBrand,
        salesData: data.salesData,
        salesAmount,
        currentStage: stage,
        currentMilestone: stageObj?.milestone || "Decision Stage",
        healthStatus: "healthy",
        budgetAvailable: data.budgetAvailable,
        notes: data.notes,
        lastContactMedium: "phone",
        lastContactStaff: session.user.name || undefined,
      },
    });

    if (data.notes) {
      await prisma.callLog.create({
        data: {
          memberId: member.id,
          date: new Date(),
          type: "outbound",
          medium: "phone",
          outcome: "Connected",
          notes: `${programType} Member Onboarded into CRM. Initial Brief: ${data.notes}`,
          staffName: session.user.name || undefined,
          staffEmail: session.user.email || undefined,
          staffDepartment: session.user.department || undefined,
        },
      });
    }

    await syncMemberBackground(member.id);

    revalidatePath("/members");
    revalidatePath("/dashboard");
    revalidatePath("/workspace");
    revalidatePath("/approvals");

    return { success: true, memberId: member.id, pendingApproval: !administrator };
  } catch (err: any) {
    console.error("Error creating member:", err);
    return { success: false, error: err.message || "Failed to create member" };
  }
}

export async function updateMember(
  id: string,
  data: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    programType?: string;
    state?: string;
    enrollingDate?: string;
    endDate?: string;
    plan?: string;
    activeStatus?: "Active" | "Not Active" | "On Hold";
    holdReason?: string;
    allotedTo?: string;
    oneOnOneSessions?: number;
    businessType?: string;
    brandCollaborations?: string;
    plBrand?: string;
    resellingBrand?: string;
    salesData?: string;
    healthStatus?: "healthy" | "warning" | "critical" | "needs_attention";
    paymentStatus?: "paid" | "partial" | "unpaid" | "unknown";
    paymentNotes?: string;
    notes?: string;
    detailedNotes?: string;
    budgetAvailable?: string;
    gstStatus?: string;
    countryInterest?: string;
  }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    if (!(await canAccessMember(session.user, id))) {
      return { success: false, error: "You do not have access to this member." };
    }
    if (!isElevatedViewer(session.user)) {
      return {
        success: false,
        error:
          "Only managers and administrators can edit the master member profile. Use a department update to record your team's work.",
      };
    }
    if (
      (data.paymentStatus !== undefined || data.paymentNotes !== undefined) &&
      !isElevatedViewer(session.user)
    ) {
      return { success: false, error: "Only managers and administrators can update payment status." };
    }
    if (
      data.paymentStatus !== undefined &&
      !["paid", "partial", "unpaid", "unknown"].includes(data.paymentStatus)
    ) {
      return { success: false, error: "Invalid payment status." };
    }
    const updatePayload: any = { ...data };
    // This field is generated from verified CRM activity and must not be
    // overwritten from the master-data editor.
    delete updatePayload.notes;

    if (data.firstName || data.lastName !== undefined) {
      const existing = await prisma.member.findUnique({ where: { id } });
      const first = data.firstName ?? existing?.firstName ?? "";
      const last = data.lastName !== undefined ? data.lastName : (existing?.lastName ?? "");
      updatePayload.fullName = `${first} ${last}`.trim();
    }

    if (data.enrollingDate) updatePayload.enrollingDate = new Date(data.enrollingDate);
    if (data.endDate) updatePayload.endDate = new Date(data.endDate);
    if (data.salesData !== undefined) {
      updatePayload.salesAmount = parseSalesValue(data.salesData);
    }

    await prisma.member.update({
      where: { id },
      data: updatePayload,
    });

    revalidatePath("/members");
    revalidatePath(`/members/${id}`);
    revalidatePath("/dashboard");

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update member" };
  }
}

export async function advanceMemberStage(
  id: string,
  targetStage: "onboarding" | "research" | "sourcing" | "approval" | "growth",
  transitionNotes?: string
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    if (!(await canAccessMember(session.user, id))) {
      return { success: false, error: "You do not have access to this member." };
    }
    if (!isElevatedViewer(session.user)) {
      return {
        success: false,
        error: "Only managers and administrators can update the member's master stage.",
      };
    }
    const stageObj = PLATINUM_STAGES.find((s) => s.id === targetStage);
    if (!stageObj) {
      return { success: false, error: "Invalid stage specified" };
    }

    await prisma.member.update({
      where: { id },
      data: {
        currentStage: targetStage,
        currentMilestone: stageObj.milestone,
      },
    });

    // Record stage advancement log
    await prisma.callLog.create({
      data: {
        memberId: id,
        date: new Date(),
        type: "outbound",
        medium: "phone",
        outcome: "Connected",
        notes: `Advanced to ${stageObj.name} (${stageObj.number}). ${
          transitionNotes ? `Notes: ${transitionNotes}` : ""
        }`,
        staffName: session.user.name || undefined,
        staffEmail: session.user.email || undefined,
        staffDepartment: session.user.department || undefined,
      },
    });

    revalidatePath("/members");
    revalidatePath(`/members/${id}`);
    revalidatePath("/dashboard");

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update stage" };
  }
}

export async function toggleMemberHold(id: string, reason?: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    if (!(await canAccessMember(session.user, id))) {
      return { success: false, error: "You do not have access to this member." };
    }
    if (!isElevatedViewer(session.user)) {
      return {
        success: false,
        error: "Only managers and administrators can place a member on hold.",
      };
    }
    const existing = await prisma.member.findUnique({ where: { id } });
    if (!existing) return { success: false, error: "Member not found" };

    const isCurrentlyHold = existing.activeStatus === "On Hold";
    const nextStatus = isCurrentlyHold ? "Active" : "On Hold";

    await prisma.member.update({
      where: { id },
      data: {
        activeStatus: nextStatus,
        holdReason: isCurrentlyHold ? null : (reason || "Put on hold by staff"),
      },
    });

    revalidatePath("/members");
    revalidatePath(`/members/${id}`);
    return { success: true, activeStatus: nextStatus };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteOrArchiveMember(
  id: string,
  action: "delete" | "archive" | "quit"
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  if (!isElevatedViewer(session.user)) {
    return {
      success: false,
      error: "Only managers and administrators can archive or change a member's active status.",
    };
  }

  if (!["admin", "superadmin"].includes(session.user.role) && action === "delete") {
    return { success: false, error: "Only administrators can delete members permanently." };
  }

  try {
    if (!(await canAccessMember(session.user, id))) {
      return { success: false, error: "You do not have access to this member." };
    }
    if (action === "delete") {
      await prisma.member.delete({ where: { id } });
    } else if (action === "quit") {
      await prisma.member.update({
        where: { id },
        data: {
          activeStatus: "Not Active",
          healthStatus: "critical",
          notes: "Student dropped out / quit.",
        },
      });
    } else {
      await prisma.member.update({
        where: { id },
        data: {
          activeStatus: "Not Active",
        },
      });
    }

    revalidatePath("/members");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to process request" };
  }
}

export async function logCallForMember(
  memberId: string,
  type: "inbound" | "outbound",
  outcome: string,
  notes: string,
  nextConnectDate?: string,
  medium: MediumId = "phone",
  duration: number = 0,
  healthStatus?: "healthy" | "warning" | "critical",
  escalateDepartment?: string,
  escalationReason?: string,
  followupTaskId?: string,
  contactedByUserId?: string,
  contactedAt?: string
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    if (!(await canAccessMember(session.user, memberId))) {
      return { success: false, error: "You do not have access to this member." };
    }

    let followupTask: {
      id: string;
      assignedToUser: string;
      createdByUser: string;
      status: string;
    } | null = null;

    if (followupTaskId) {
      if (!/^[a-f\d]{24}$/i.test(followupTaskId)) {
        return { success: false, error: "Invalid follow-up task." };
      }

      followupTask = await prisma.followUpTask.findFirst({
        where: { id: followupTaskId, memberId },
        select: {
          id: true,
          assignedToUser: true,
          createdByUser: true,
          status: true,
        },
      });

      if (!followupTask) {
        return { success: false, error: "Follow-up task not found for this member." };
      }

      const canCompleteTask =
        isElevatedViewer(session.user) ||
        followupTask.assignedToUser === session.user.id ||
        followupTask.createdByUser === session.user.id;
      if (!canCompleteTask) {
        return {
          success: false,
          error: "Only the assignee, creator, or a manager can complete this follow-up.",
        };
      }

      if (["completed", "cancelled"].includes(followupTask.status)) {
        return { success: false, error: "This follow-up task is already closed." };
      }
    }

    let staffUserId = session.user.id || "";
    let staffName = session.user.name || "Staff Member";
    let staffEmail = session.user.email || "";
    let staffDepartment = session.user.department || "operations";
    let interactionDate = new Date();

    if (contactedByUserId || contactedAt) {
      if (
        !["admin", "superadmin"].includes(
          session.user.role?.trim().toLowerCase() || "",
        )
      ) {
        return {
          success: false,
          error: "Only administrators can override contact attribution or time.",
        };
      }

      if (contactedByUserId) {
        if (!/^[a-f\d]{24}$/i.test(contactedByUserId)) {
          return { success: false, error: "Invalid contacted-by staff member." };
        }
        const attributedStaff = await prisma.user.findFirst({
          where: { id: contactedByUserId, active: true },
          select: { id: true, name: true, email: true, department: true },
        });
        if (!attributedStaff) {
          return { success: false, error: "Active contacted-by staff member not found." };
        }
        staffUserId = attributedStaff.id;
        staffName = attributedStaff.name;
        staffEmail = attributedStaff.email;
        staffDepartment = attributedStaff.department;
      }

      if (contactedAt) {
        const parsedContactedAt = new Date(contactedAt);
        if (
          Number.isNaN(parsedContactedAt.getTime()) ||
          parsedContactedAt.getTime() > Date.now() + 5 * 60_000
        ) {
          return { success: false, error: "Invalid communication date and time." };
        }
        interactionDate = parsedContactedAt;
      }
    }

    const previousLatestLog = await prisma.callLog.findFirst({
      where: { memberId },
      orderBy: { date: "desc" },
      select: { date: true },
    });

    await prisma.callLog.create({
      data: {
        memberId,
        date: interactionDate,
        type,
        medium,
        outcome,
        duration,
        notes: escalateDepartment
          ? `[ESCALATED TO ${escalateDepartment.toUpperCase()}]: ${notes}`
          : notes,
        staffName,
        staffEmail,
        staffDepartment,
        staffUserId: staffUserId || null,
      },
    });

    const updateData: any = {};
    if (!previousLatestLog || interactionDate >= previousLatestLog.date) {
      updateData.lastConnectDate = interactionDate;
      updateData.lastContactMedium = medium;
      updateData.lastContactStaff = staffName;
    }

    if (healthStatus) {
      updateData.healthStatus = healthStatus;
    }

    if (nextConnectDate) {
      updateData.nextConnectDate = new Date(nextConnectDate);
    }

    // If medium was a Zoom 1-on-1 session and outcome was conducted/connected, increment session count
    if (medium === "zoom" || medium === "meet" || outcome.toLowerCase().includes("1-on-1")) {
      const currentMember = await prisma.member.findUnique({
        where: { id: memberId },
        select: { oneOnOneSessions: true },
      });
      updateData.oneOnOneSessions = (currentMember?.oneOnOneSessions || 0) + 1;
    }

    await prisma.member.update({
      where: { id: memberId },
      data: updateData,
    });

    // If critical/warning escalation to a department was requested, automatically create a QueryTransfer ticket
    if (escalateDepartment && escalateDepartment !== "none") {
      await prisma.queryTransfer.create({
        data: {
          memberId,
          fromDepartment: staffDepartment,
          toDepartment: escalateDepartment.toLowerCase(),
          reason: escalationReason || notes || "Urgent weekly follow-up escalation",
          priority: healthStatus === "critical" ? "urgent" : "high",
          status: "pending",
        },
      });
    }

    if (followupTask) {
      await prisma.followUpTask.update({
        where: { id: followupTask.id },
        data: {
          status: "completed",
          completedAt: new Date(),
          completedByUser: staffUserId || null,
          completedByName: staffName,
          completionNotes: notes,
        },
      });
    }

    await syncMemberBackground(memberId);

    revalidatePath(`/members/${memberId}`);
    revalidatePath(`/workspace/${memberId}`);
    revalidatePath("/workspace");
    revalidatePath("/members");
    revalidatePath("/followups");
    revalidatePath("/calls");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (err: any) {
    console.error("Error logging call:", err);
    return { success: false, error: err.message || "Failed to log interaction" };
  }
}

export async function transferQuery(
  memberId: string,
  fromDepartment: string,
  toDepartment: string,
  assignedToUser: string | undefined,
  reason: string,
  priority: "low" | "medium" | "high" | "urgent" = "medium",
  assignedToName?: string,
  assignedToEmail?: string
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    if (!(await canAccessMember(session.user, memberId))) {
      return { success: false, error: "You do not have access to this member." };
    }
    await prisma.queryTransfer.create({
      data: {
        memberId,
        fromDepartment,
        toDepartment,
        assignedToUser: assignedToUser || null,
        assignedToName: assignedToName || null,
        assignedToEmail: assignedToEmail || null,
        priority,
        reason,
        status: "pending",
      },
    });

    // Also record an entry in callLog so it appears on timeline
    await prisma.callLog.create({
      data: {
        memberId,
        date: new Date(),
        type: "outbound",
        medium: "internal",
        outcome: `Transferred to ${toDepartment.toUpperCase()}`,
        notes: `[Priority: ${priority.toUpperCase()}] Transferred query to ${toDepartment.toUpperCase()}${
          assignedToName ? ` (Assigned: ${assignedToName})` : ""
        }. Reason: ${reason}`,
        staffName: session.user.name || undefined,
        staffEmail: session.user.email || undefined,
        staffDepartment: fromDepartment,
      },
    });

    revalidatePath(`/members/${memberId}`);
    revalidatePath("/members");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to transfer query" };
  }
}

export async function resolveQueryTransfer(
  transferId: string,
  resolutionNotes: string,
  resolutionMedium: MediumId
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const transfer = await prisma.queryTransfer.findUnique({
      where: { id: transferId },
      select: { memberId: true, toDepartment: true },
    });
    if (!transfer || !(await canAccessMember(session.user, transfer.memberId))) {
      return { success: false, error: "You do not have access to this transferred query." };
    }
    if (
      !isElevatedViewer(session.user) &&
      normalizeDepartment(transfer.toDepartment) !== normalizeDepartment(session.user.department)
    ) {
      return { success: false, error: "Only the receiving department can resolve this query." };
    }

    const updated = await prisma.queryTransfer.update({
      where: { id: transferId },
      data: {
        status: "resolved",
        resolutionNotes,
        resolutionMedium,
        resolvedByName: session.user.name || undefined,
        resolvedByEmail: session.user.email || undefined,
        resolvedAt: new Date(),
      },
      include: {
        member: true,
      },
    });

    // Add log
    if (updated.memberId) {
      await prisma.callLog.create({
        data: {
          memberId: updated.memberId,
          date: new Date(),
          type: "outbound",
          medium: resolutionMedium,
          outcome: "Query Resolved",
          notes: `[${updated.toDepartment.toUpperCase()}] Resolved query: "${updated.reason}". Resolution: ${resolutionNotes}`,
          staffName: session.user.name || undefined,
          staffEmail: session.user.email || undefined,
          staffDepartment: session.user.department || updated.toDepartment,
        },
      });
      await syncMemberBackground(updated.memberId);
    }

    revalidatePath(`/members/${updated.memberId}`);
    revalidatePath("/members");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to resolve query" };
  }
}

export async function getStaffDirectory() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { success: false, users: [], error: "Unauthorized" };

  try {
    const users = await prisma.user.findMany({
      where: {
        active: true,
        ...(isElevatedViewer(session.user)
          ? {}
          : { department: { equals: normalizeDepartment(session.user.department), mode: "insensitive" } }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        department: true,
        role: true,
      },
      orderBy: { name: "asc" },
    });
    return { success: true, users };
  } catch (err: any) {
    return { success: false, users: [], error: err.message };
  }
}
