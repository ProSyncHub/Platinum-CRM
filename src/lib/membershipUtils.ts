export type ProgramId = "Platinum" | "PNP" | "General" | string;

export interface ProgramMeta {
  id: string;
  name: string;
  shortLabel: string;
  codePrefix: string;
  icon: string;
  gradient: string;
  badgeClass: string;
  pillClass: string;
  textClass: string;
  borderClass: string;
  color: string;
  tagline: string;
}

export const PROGRAM_CONFIGS: Record<string, ProgramMeta> = {
  Platinum: {
    id: "Platinum",
    name: "Platinum Elite",
    shortLabel: "PLAT",
    codePrefix: "PLT",
    icon: "👑",
    gradient: "from-amber-500 to-amber-700",
    badgeClass: "bg-amber-100 text-amber-900 border-amber-300 font-bold",
    pillClass: "bg-amber-50 text-amber-900 border-amber-300 font-bold",
    textClass: "text-amber-800 font-bold",
    borderClass: "border-amber-300",
    color: "#b45309",
    tagline: "Exclusive high-touch 5-stage VIP mentorship program",
  },
  PNP: {
    id: "PNP",
    name: "PNP (Plug & Play)",
    shortLabel: "PNP",
    codePrefix: "PNP",
    icon: "⚡",
    gradient: "from-cyan-500 to-blue-600",
    badgeClass: "bg-cyan-100 text-cyan-950 border-cyan-300 font-bold",
    pillClass: "bg-cyan-50 text-cyan-950 border-cyan-300 font-bold",
    textClass: "text-cyan-800 font-bold",
    borderClass: "border-cyan-300",
    color: "#0e7490",
    tagline: "Accelerated Plug & Play fast-track store launch program",
  },
  "Amazon Wealth Shortcut": {
    id: "Amazon Wealth Shortcut",
    name: "Amazon Wealth Shortcut",
    shortLabel: "AWS",
    codePrefix: "AWS",
    icon: "🚀",
    gradient: "from-purple-500 to-indigo-600",
    badgeClass: "bg-purple-100 text-purple-950 border-purple-300 font-bold",
    pillClass: "bg-purple-50 text-purple-950 border-purple-300 font-bold",
    textClass: "text-purple-800 font-bold",
    borderClass: "border-purple-300",
    color: "#7e22ce",
    tagline: "Fast-paced Amazon e-commerce scaling & wealth creation blueprint",
  },
  General: {
    id: "General",
    name: "General Member",
    shortLabel: "GEN",
    codePrefix: "MEM",
    icon: "🌐",
    gradient: "from-slate-500 to-slate-700",
    badgeClass: "bg-slate-100 text-slate-800 border-slate-300 font-bold",
    pillClass: "bg-slate-50 text-slate-800 border-slate-300 font-bold",
    textClass: "text-slate-800 font-bold",
    borderClass: "border-slate-300",
    color: "#334155",
    tagline: "Standard ProSync enterprise member account",
  },
};

const COLOR_MAP: Record<string, { badge: string; pill: string; text: string; border: string; hex: string }> = {
  amber: {
    badge: "bg-amber-100 text-amber-900 border-amber-300 font-bold",
    pill: "bg-amber-50 text-amber-900 border-amber-300 font-bold",
    text: "text-amber-800 font-bold",
    border: "border-amber-300",
    hex: "#b45309",
  },
  cyan: {
    badge: "bg-cyan-100 text-cyan-950 border-cyan-300 font-bold",
    pill: "bg-cyan-50 text-cyan-950 border-cyan-300 font-bold",
    text: "text-cyan-800 font-bold",
    border: "border-cyan-300",
    hex: "#0e7490",
  },
  purple: {
    badge: "bg-purple-100 text-purple-950 border-purple-300 font-bold",
    pill: "bg-purple-50 text-purple-950 border-purple-300 font-bold",
    text: "text-purple-800 font-bold",
    border: "border-purple-300",
    hex: "#7e22ce",
  },
  emerald: {
    badge: "bg-emerald-100 text-emerald-950 border-emerald-300 font-bold",
    pill: "bg-emerald-50 text-emerald-950 border-emerald-300 font-bold",
    text: "text-emerald-800 font-bold",
    border: "border-emerald-300",
    hex: "#059669",
  },
  blue: {
    badge: "bg-blue-100 text-blue-950 border-blue-300 font-bold",
    pill: "bg-blue-50 text-blue-950 border-blue-300 font-bold",
    text: "text-blue-800 font-bold",
    border: "border-blue-300",
    hex: "#2563eb",
  },
  rose: {
    badge: "bg-rose-100 text-rose-950 border-rose-300 font-bold",
    pill: "bg-rose-50 text-rose-950 border-rose-300 font-bold",
    text: "text-rose-800 font-bold",
    border: "border-rose-300",
    hex: "#e11d48",
  },
  orange: {
    badge: "bg-orange-100 text-orange-950 border-orange-300 font-bold",
    pill: "bg-orange-50 text-orange-950 border-orange-300 font-bold",
    text: "text-orange-800 font-bold",
    border: "border-orange-300",
    hex: "#ea580c",
  },
  slate: {
    badge: "bg-slate-100 text-slate-800 border-slate-300 font-bold",
    pill: "bg-slate-50 text-slate-800 border-slate-300 font-bold",
    text: "text-slate-800 font-bold",
    border: "border-slate-300",
    hex: "#475569",
  },
};

export function getProgramMeta(program?: string | any | null): ProgramMeta {
  if (!program) return PROGRAM_CONFIGS.Platinum;

  // If already an object passed in
  if (typeof program === "object" && program.name) {
    const colorKey = program.badgeColor || "purple";
    const palette = COLOR_MAP[colorKey] || COLOR_MAP.purple;
    return {
      id: program.name,
      name: program.name,
      shortLabel: program.codePrefix || program.name.slice(0, 4).toUpperCase(),
      codePrefix: program.codePrefix || "MEM",
      icon: program.icon || "🎯",
      gradient: "from-purple-500 to-indigo-600",
      badgeClass: palette.badge,
      pillClass: palette.pill,
      textClass: palette.text,
      borderClass: palette.border,
      color: program.color || palette.hex,
      tagline: program.description || `${program.name} Program`,
    };
  }

  const normalized = String(program).trim();
  if (normalized.toLowerCase().includes("pnp") || normalized.toLowerCase().includes("plug")) {
    return PROGRAM_CONFIGS.PNP;
  }
  if (normalized.toLowerCase().includes("plat")) {
    return PROGRAM_CONFIGS.Platinum;
  }
  if (normalized.toLowerCase().includes("amazon") || normalized.toLowerCase().includes("wealth") || normalized.toLowerCase().includes("aws") || normalized.toLowerCase().includes("shortcut")) {
    return PROGRAM_CONFIGS["Amazon Wealth Shortcut"];
  }

  if (PROGRAM_CONFIGS[normalized]) {
    return PROGRAM_CONFIGS[normalized];
  }

  // Derive code prefix from words (e.g. "Amazon Wealth Shortcut" -> "AWS", "Ecom Mastery" -> "EM")
  const words = normalized.split(/\s+/).filter(Boolean);
  const derivedPrefix = words.length > 1
    ? words.map((w) => w[0].toUpperCase()).join("").slice(0, 4)
    : normalized.slice(0, 3).toUpperCase();

  return {
    id: normalized,
    name: normalized,
    shortLabel: derivedPrefix,
    codePrefix: derivedPrefix,
    icon: "🎯",
    gradient: "from-slate-500 to-slate-700",
    badgeClass: "bg-slate-100 text-slate-800 border-slate-300 font-bold",
    pillClass: "bg-slate-50 text-slate-800 border-slate-300 font-bold",
    textClass: "text-slate-800 font-bold",
    borderClass: "border-slate-300",
    color: "#334155",
    tagline: `${normalized} Member`,
  };
}

export function generateMemberCode(
  programType: string | any = "Platinum",
  sequenceNumber: number = 1,
  year: number = new Date().getFullYear()
): string {
  const meta = getProgramMeta(programType);
  const prefix = meta.codePrefix || "PLT";
  return `${prefix}-${year}-${String(sequenceNumber).padStart(3, "0")}`;
}

export interface MembershipStatusInfo {
  status: "Active" | "Expiring Soon" | "Expired" | "On Hold" | "Not Active";
  daysLeft: number;
  isExpired: boolean;
  isExpiringSoon: boolean;
  label: string;
  badgeClass: string;
}

export type StageId = "onboarding" | "research" | "sourcing" | "approval" | "growth";

export type MediumId = "phone" | "whatsapp" | "zoom" | "meet" | "email" | "sms" | "telegram" | "in_person" | "internal";

export interface MediumMeta {
  id: MediumId;
  label: string;
  shortLabel: string;
  icon: string;
  badgeClass: string;
  color: string;
}

export const COMMUNICATION_MEDIUMS: Record<MediumId, MediumMeta> = {
  phone: {
    id: "phone",
    label: "Phone Call",
    shortLabel: "Call",
    icon: "PhoneCall",
    badgeClass: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    color: "#10b981",
  },
  whatsapp: {
    id: "whatsapp",
    label: "WhatsApp Message",
    shortLabel: "WhatsApp",
    icon: "MessageSquare",
    badgeClass: "bg-green-500/15 text-green-300 border-green-500/30",
    color: "#22c55e",
  },
  zoom: {
    id: "zoom",
    label: "Zoom 1-on-1 Session",
    shortLabel: "Zoom 1:1",
    icon: "Video",
    badgeClass: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    color: "#3b82f6",
  },
  meet: {
    id: "meet",
    label: "Google Meet",
    shortLabel: "G-Meet",
    icon: "Video",
    badgeClass: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
    color: "#06b6d4",
  },
  email: {
    id: "email",
    label: "Official Email",
    shortLabel: "Email",
    icon: "Mail",
    badgeClass: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
    color: "#6366f1",
  },
  sms: {
    id: "sms",
    label: "SMS Text",
    shortLabel: "SMS",
    icon: "Smartphone",
    badgeClass: "bg-purple-500/15 text-purple-300 border-purple-500/30",
    color: "#a855f7",
  },
  telegram: {
    id: "telegram",
    label: "Telegram",
    shortLabel: "Telegram",
    icon: "Send",
    badgeClass: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    color: "#0ea5e9",
  },
  in_person: {
    id: "in_person",
    label: "In-Person Meeting",
    shortLabel: "In-Person",
    icon: "Users",
    badgeClass: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    color: "#f59e0b",
  },
  internal: {
    id: "internal",
    label: "Internal CRM Activity",
    shortLabel: "Internal",
    icon: "Workflow",
    badgeClass: "bg-slate-100 text-slate-700 border-slate-300",
    color: "#475569",
  },
};

const COMMUNICATION_MEDIUM_ALIASES: Readonly<Record<string, MediumId>> = {
  phone: "phone",
  call: "phone",
  on_call: "phone",
  phone_call: "phone",
  telephone: "phone",
  voice_call: "phone",
  whatsapp: "whatsapp",
  whats_app: "whatsapp",
  whatsapp_message: "whatsapp",
  zoom: "zoom",
  zoom_call: "zoom",
  zoom_1_1: "zoom",
  zoom_1_on_1: "zoom",
  meet: "meet",
  gmeet: "meet",
  google_meet: "meet",
  email: "email",
  official_email: "email",
  sms: "sms",
  text: "sms",
  text_message: "sms",
  telegram: "telegram",
  in_person: "in_person",
  in_person_meeting: "in_person",
  offline_meeting: "in_person",
  internal: "internal",
  internal_crm_activity: "internal",
};

/**
 * Converts imported and legacy communication labels to the canonical CRM value.
 * Unknown values deliberately return null so server actions can reject bad data.
 */
export function normalizeCommunicationMedium(medium?: string | null): MediumId | null {
  if (!medium) return null;

  const key = medium
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return COMMUNICATION_MEDIUM_ALIASES[key] || null;
}

export function getMediumMeta(medium?: string | null): MediumMeta {
  const normalizedMedium = normalizeCommunicationMedium(medium);
  return normalizedMedium
    ? COMMUNICATION_MEDIUMS[normalizedMedium]
    : COMMUNICATION_MEDIUMS.phone;
}

export function getContactAttentionStatus(
  lastConnectDate?: Date | string | null,
  nextConnectDate?: Date | string | null
): {
  urgency: "urgent" | "due_soon" | "healthy" | "never";
  label: string;
  daysSinceLast: number | null;
  badgeClass: string;
} {
  const now = new Date();

  if (nextConnectDate) {
    const next = new Date(nextConnectDate);
    const diffDays = Math.ceil((next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) {
      return {
        urgency: "urgent",
        label: `Follow-up Overdue (${Math.abs(diffDays)}d)`,
        daysSinceLast: lastConnectDate ? Math.floor((now.getTime() - new Date(lastConnectDate).getTime()) / (1000 * 60 * 60 * 24)) : null,
        badgeClass: "bg-red-500/20 text-red-300 border-red-500/40 animate-pulse",
      };
    } else if (diffDays === 0) {
      return {
        urgency: "due_soon",
        label: "Follow-up Due Today",
        daysSinceLast: lastConnectDate ? Math.floor((now.getTime() - new Date(lastConnectDate).getTime()) / (1000 * 60 * 60 * 24)) : null,
        badgeClass: "bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold",
      };
    } else if (diffDays <= 2) {
      return {
        urgency: "due_soon",
        label: `Due in ${diffDays}d`,
        daysSinceLast: lastConnectDate ? Math.floor((now.getTime() - new Date(lastConnectDate).getTime()) / (1000 * 60 * 60 * 24)) : null,
        badgeClass: "bg-amber-500/15 text-amber-400 border-amber-500/30",
      };
    }
  }

  if (!lastConnectDate) {
    return {
      urgency: "urgent",
      label: "Never Contacted",
      daysSinceLast: null,
      badgeClass: "bg-rose-500/20 text-rose-300 border-rose-500/40 font-semibold",
    };
  }

  const last = new Date(lastConnectDate);
  const daysSince = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));

  if (daysSince > 10) {
    return {
      urgency: "urgent",
      label: `Inactive ${daysSince}d`,
      daysSinceLast: daysSince,
      badgeClass: "bg-red-500/20 text-red-300 border-red-500/40",
    };
  }

  if (daysSince > 5) {
    return {
      urgency: "due_soon",
      label: `Contacted ${daysSince}d ago`,
      daysSinceLast: daysSince,
      badgeClass: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    };
  }

  return {
    urgency: "healthy",
    label: daysSince === 0 ? "Contacted Today" : `Contacted ${daysSince}d ago`,
    daysSinceLast: daysSince,
    badgeClass: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  };
}

export function getMembershipStatus(
  enrollingDate?: Date | string | null,
  endDate?: Date | string | null,
  manualStatus?: string | null
): MembershipStatusInfo {
  if (manualStatus === "On Hold") {
    return {
      status: "On Hold",
      daysLeft: 0,
      isExpired: false,
      isExpiringSoon: false,
      label: "On Hold",
      badgeClass: "bg-blue-500/20 text-blue-300 border-blue-500/40 font-medium",
    };
  }

  if (manualStatus === "Not Active") {
    return {
      status: "Not Active",
      daysLeft: 0,
      isExpired: true,
      isExpiringSoon: false,
      label: "Not Active",
      badgeClass: "bg-slate-800 text-slate-400 border-slate-700",
    };
  }

  if (!endDate) {
    return {
      status: "Active",
      daysLeft: 180,
      isExpired: false,
      isExpiringSoon: false,
      label: "Active (6M)",
      badgeClass: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    };
  }

  const end = new Date(endDate);
  const now = new Date();
  const diffTime = end.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      status: "Expired",
      daysLeft: diffDays,
      isExpired: true,
      isExpiringSoon: false,
      label: `Expired (${Math.abs(diffDays)}d ago)`,
      badgeClass: "bg-rose-500/20 text-rose-300 border-rose-500/40 font-bold",
    };
  }

  if (diffDays <= 30) {
    return {
      status: "Expiring Soon",
      daysLeft: diffDays,
      isExpired: false,
      isExpiringSoon: true,
      label: `Expiring Soon (${diffDays}d left)`,
      badgeClass: "bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold animate-pulse",
    };
  }

  return {
    status: "Active",
    daysLeft: diffDays,
    isExpired: false,
    isExpiringSoon: false,
    label: `Active (${diffDays}d left)`,
    badgeClass: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-medium",
  };
}

export const PLATINUM_STAGES: {
  id: StageId;
  number: string;
  name: string;
  shortName: string;
  description: string;
  timeline: string;
  whatHappens: string;
  managerResponsibility: string;
  milestone: string;
  moveForwardCondition: string;
  color: string;
}[] = [
  {
    id: "onboarding",
    number: "01",
    name: "Onboarding & Path Selection",
    shortName: "Onboarding",
    description: "Welcome call, induction, pilot course, choose Reselling vs PL path.",
    timeline: "Day 0 – Week 1",
    whatHappens:
      "Welcome call, induction, pilot course, choose path (Reselling or Private Label).",
    managerResponsibility:
      "Welcome setup, induction call, pilot course, help choose Reselling vs Private Label.",
    milestone: "Decision Stage",
    moveForwardCondition: "Path selected & induction checkpoint complete.",
    color: "blue",
  },
  {
    id: "research",
    number: "02",
    name: "Research & Validation",
    shortName: "Research",
    description: "Niche selection, Helium 10 / Black Box research, product shortlisting.",
    timeline: "Week 1 – 5",
    whatHappens:
      "Niche selection, tool support (Helium 10 / Black Box), brand outreach or product shortlisting.",
    managerResponsibility:
      "Guide niche selection (2-3-5 framework), Helium 10 / Black Box support, brand outreach or product shortlisting.",
    milestone: "Brand/Product Validation",
    moveForwardCondition:
      "Approved niche + brand outreach OR product shortlist submitted.",
    color: "purple",
  },
  {
    id: "sourcing",
    number: "03",
    name: "Sourcing & Acquisition",
    shortName: "Sourcing",
    description: "Brand approvals (Resell) or supplier quotes & samples (PL).",
    timeline: "Week 4 – 8",
    whatHappens:
      "Brand approvals (Resell) or supplier quotes & samples (Private Label).",
    managerResponsibility:
      "Review brand approvals (Resell) or supplier quotations & samples (PL).",
    milestone: "Authorization / Sourcing Stage",
    moveForwardCondition:
      "Brand authorized OR supplier shortlist + samples approved.",
    color: "amber",
  },
  {
    id: "approval",
    number: "04",
    name: "Profitability & Approval",
    shortName: "Approval",
    description: "Margin & feasibility check, senior team review for launch approval.",
    timeline: "Week 6 – 9",
    whatHappens:
      "Margin & feasibility check, senior team review for launch approval.",
    managerResponsibility:
      "Verify margins & feasibility, senior team review for launch approval.",
    milestone: "Financial Validation → Approval Stage",
    moveForwardCondition: "Profitability review submitted and approved.",
    color: "indigo",
  },
  {
    id: "growth",
    number: "05",
    name: "Live & Growth",
    shortName: "Live Growth",
    description: "Inventory planning, listing setup, sales monitoring, scaling.",
    timeline: "Week 9 – Month 6",
    whatHappens:
      "Inventory planning, listing setup, sales monitoring, ongoing optimization, quarterly reviews.",
    managerResponsibility:
      "Inventory planning, listing review, sales monitoring, ongoing optimization.",
    milestone: "Go-Live Ready → Growth Phase",
    moveForwardCondition: "Launch executed → quarterly review cycle.",
    color: "emerald",
  },
];

export function parseSalesValue(salesStr?: string | null): number {
  if (!salesStr) return 0;
  const cleaned = salesStr.toLowerCase().replace(/,/g, "").trim();

  if (cleaned.includes("lakh") || cleaned.includes("lac") || cleaned.includes("l")) {
    const num = parseFloat(cleaned.replace(/[^\d.]/g, ""));
    return isNaN(num) ? 0 : num * 100000;
  }

  if (cleaned.includes("k")) {
    const num = parseFloat(cleaned.replace(/[^\d.]/g, ""));
    return isNaN(num) ? 0 : num * 1000;
  }

  const num = parseFloat(cleaned.replace(/[^\d.]/g, ""));
  return isNaN(num) ? 0 : num;
}

export function formatINR(amount: number): string {
  if (amount >= 10000000) {
    return `₹${(amount / 10000000).toFixed(1)} Cr`;
  }
  if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(1)} Lakh`;
  }
  if (amount >= 1000) {
    return `₹${(amount / 1000).toFixed(0)}k`;
  }
  return `₹${amount.toLocaleString("en-IN")}`;
}
