"use server";

import { getServerSession } from "next-auth/next";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";
import {
  canAccessMember,
  isElevatedViewer,
  memberScopeFor,
} from "@/lib/authorization";
import {
  SERVICE_REFERRAL_STATUSES,
  type ServiceReferralStatus,
} from "@/lib/servicePartners";

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;
const VALID_STATUSES = new Set<ServiceReferralStatus>(
  Object.keys(SERVICE_REFERRAL_STATUSES) as ServiceReferralStatus[]
);

export interface ServiceReferralInput {
  memberId: string;
  partnerId: string;
  status: ServiceReferralStatus;
  ownerName?: string;
  scheduledAt?: string;
  notes?: string;
}

function cleanOptional(value: string | undefined, maxLength: number) {
  const cleaned = value?.trim();
  return cleaned ? cleaned.slice(0, maxLength) : null;
}

export async function getServicePartners() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { success: false, partners: [], error: "Unauthorized" };
  }

  try {
    const partners = await prisma.servicePartner.findMany({
      where: { active: true },
      orderBy: [{ order: "asc" }, { serviceName: "asc" }],
      select: {
        id: true,
        serviceCode: true,
        serviceName: true,
        providerName: true,
        category: true,
        description: true,
        benefitLabel: true,
        includedConsultations: true,
        contactPerson: true,
        contactEmail: true,
        contactPhone: true,
      },
    });

    return { success: true, partners };
  } catch (error: unknown) {
    return {
      success: false,
      partners: [],
      error: error instanceof Error ? error.message : "Unable to load service partners",
    };
  }
}

export async function getServiceOverview() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { success: false, partners: [], referrals: [], error: "Unauthorized" };
  }

  try {
    let accessibleMemberIds: string[] | null = null;
    if (!isElevatedViewer(session.user)) {
      accessibleMemberIds = (
        await prisma.member.findMany({
          where: memberScopeFor(session.user),
          select: { id: true },
        })
      ).map((member) => member.id);
    }

    const [partners, referrals] = await Promise.all([
      prisma.servicePartner.findMany({
        where: { active: true },
        orderBy: [{ order: "asc" }, { serviceName: "asc" }],
        select: {
          id: true,
          serviceCode: true,
          serviceName: true,
          providerName: true,
          category: true,
          description: true,
          benefitLabel: true,
          includedConsultations: true,
          contactPerson: true,
        },
      }),
      prisma.memberServiceReferral.findMany({
        where:
          accessibleMemberIds === null
            ? {}
            : { memberId: { in: accessibleMemberIds } },
        orderBy: { updatedAt: "desc" },
        take: 500,
        select: {
          id: true,
          memberId: true,
          partnerId: true,
          status: true,
          ownerName: true,
          scheduledAt: true,
          completedAt: true,
          notes: true,
          assignedByName: true,
          updatedByName: true,
          createdAt: true,
          updatedAt: true,
          member: {
            select: {
              id: true,
              memberCode: true,
              fullName: true,
              phone: true,
              email: true,
              department: true,
              programType: true,
            },
          },
          partner: {
            select: {
              id: true,
              serviceCode: true,
              serviceName: true,
              providerName: true,
              category: true,
              description: true,
              benefitLabel: true,
              includedConsultations: true,
              contactPerson: true,
              contactEmail: true,
              contactPhone: true,
            },
          },
        },
      }),
    ]);

    return {
      success: true,
      partners,
      referrals: referrals.map((referral) => ({
        ...referral,
        scheduledAt: referral.scheduledAt?.toISOString() || null,
        completedAt: referral.completedAt?.toISOString() || null,
        createdAt: referral.createdAt.toISOString(),
        updatedAt: referral.updatedAt.toISOString(),
      })),
    };
  } catch (error: unknown) {
    return {
      success: false,
      partners: [],
      referrals: [],
      error: error instanceof Error ? error.message : "Unable to load partner services",
    };
  }
}

export async function saveMemberServiceReferral(input: ServiceReferralInput) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  if (
    !OBJECT_ID_PATTERN.test(input.memberId) ||
    !OBJECT_ID_PATTERN.test(input.partnerId) ||
    !VALID_STATUSES.has(input.status)
  ) {
    return { success: false, error: "Invalid service referral details." };
  }

  try {
    if (!(await canAccessMember(session.user, input.memberId))) {
      return { success: false, error: "You do not have access to this member." };
    }

    const partner = await prisma.servicePartner.findFirst({
      where: { id: input.partnerId, active: true },
      select: { providerName: true, contactPerson: true },
    });
    if (!partner) {
      return { success: false, error: "This service partner is not available." };
    }

    let scheduledAt: Date | null = null;
    if (input.scheduledAt) {
      const parsed = new Date(input.scheduledAt);
      if (Number.isNaN(parsed.getTime())) {
        return { success: false, error: "Invalid consultation date." };
      }
      scheduledAt = parsed;
    }

    const existing = await prisma.memberServiceReferral.findUnique({
      where: {
        memberId_partnerId: {
          memberId: input.memberId,
          partnerId: input.partnerId,
        },
      },
      select: { id: true },
    });

    const ownerName =
      cleanOptional(input.ownerName, 120) || partner.contactPerson || partner.providerName;
    const notes = cleanOptional(input.notes, 2000);
    const completedAt = input.status === "completed" ? new Date() : null;

    if (existing) {
      await prisma.memberServiceReferral.update({
        where: { id: existing.id },
        data: {
          status: input.status,
          ownerName,
          scheduledAt,
          completedAt,
          notes,
          updatedByName: session.user.name || undefined,
          updatedByEmail: session.user.email || undefined,
        },
      });
    } else {
      await prisma.memberServiceReferral.create({
        data: {
          memberId: input.memberId,
          partnerId: input.partnerId,
          status: input.status,
          ownerName,
          scheduledAt,
          completedAt,
          notes,
          assignedByName: session.user.name || undefined,
          assignedByEmail: session.user.email || undefined,
          updatedByName: session.user.name || undefined,
          updatedByEmail: session.user.email || undefined,
        },
      });
    }

    revalidatePath(`/members/${input.memberId}`);
    revalidatePath("/services");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unable to save service referral",
    };
  }
}
