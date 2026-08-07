export const DEFAULT_SERVICE_PARTNERS = [
  {
    serviceCode: "AMAZON_ACCOUNT_OPENING",
    serviceName: "Amazon Account Opening",
    providerName: "Wissen Glanz",
    category: "marketplace_onboarding",
    description:
      "Amazon seller account opening and onboarding support coordinated through the Wissen Glanz team.",
    benefitLabel: "Specialist partner support",
    includedConsultations: 0,
    contactPerson: "Wissen Glanz Team",
    order: 10,
  },
  {
    serviceCode: "GST_CONSULTATION",
    serviceName: "GST Consultation",
    providerName: "Gaurav Batra",
    category: "tax_and_compliance",
    description:
      "GST guidance and compliance consultation coordinated with Gaurav Batra.",
    benefitLabel: "First consultation included at no cost",
    includedConsultations: 1,
    contactPerson: "Gaurav Batra",
    order: 20,
  },
] as const;

export const SERVICE_REFERRAL_STATUSES = {
  referred: {
    label: "Referred",
    badgeClass: "border-blue-200 bg-blue-50 text-blue-800",
  },
  contacted: {
    label: "Partner Contacted",
    badgeClass: "border-cyan-200 bg-cyan-50 text-cyan-800",
  },
  consultation_scheduled: {
    label: "Consultation Scheduled",
    badgeClass: "border-violet-200 bg-violet-50 text-violet-800",
  },
  in_progress: {
    label: "In Progress",
    badgeClass: "border-amber-200 bg-amber-50 text-amber-800",
  },
  completed: {
    label: "Completed",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  on_hold: {
    label: "On Hold",
    badgeClass: "border-slate-200 bg-slate-100 text-slate-700",
  },
  cancelled: {
    label: "Cancelled",
    badgeClass: "border-rose-200 bg-rose-50 text-rose-800",
  },
} as const;

export type ServiceReferralStatus = keyof typeof SERVICE_REFERRAL_STATUSES;

export interface ServicePartnerView {
  id: string;
  serviceCode: string;
  serviceName: string;
  providerName: string;
  category: string;
  description?: string | null;
  benefitLabel?: string | null;
  includedConsultations: number;
  contactPerson?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
}

export interface MemberServiceReferralView {
  id: string;
  memberId: string;
  partnerId: string;
  status: string;
  ownerName?: string | null;
  scheduledAt?: string | Date | null;
  completedAt?: string | Date | null;
  notes?: string | null;
  assignedByName?: string | null;
  updatedByName?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  partner: ServicePartnerView;
}

export function getServiceReferralStatusMeta(status?: string | null) {
  return (
    SERVICE_REFERRAL_STATUSES[status as ServiceReferralStatus] ||
    SERVICE_REFERRAL_STATUSES.referred
  );
}
