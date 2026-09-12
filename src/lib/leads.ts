import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { NormalizedLeadInput } from "@/lib/leadMapping";

export const WATI_SOURCE_SLUG = "wati";
export const MANUAL_SOURCE_SLUG = "manual-excel";

type LeadRouting = {
  department: string | null;
  priority: "medium" | "high" | "urgent";
  reason: string;
};

const WATI_DEPARTMENT_RULES: Array<{
  department: string;
  label: string;
  keywords: string[];
}> = [
  {
    department: "brand",
    label: "Brand",
    keywords: [
      "brand",
      "branding",
      "private label",
      "pl brand",
      "trademark",
      "logo",
      "packaging",
      "brand registry",
    ],
  },
  {
    department: "ecom",
    label: "E-Commerce",
    keywords: [
      "amazon",
      "flipkart",
      "meesho",
      "seller",
      "listing",
      "catalog",
      "catalogue",
      "fba",
      "inventory",
      "order",
      "ppc",
      "ads",
      "account health",
      "buy box",
    ],
  },
  {
    department: "software development",
    label: "Software Development",
    keywords: [
      "website",
      "web site",
      "app",
      "portal",
      "crm",
      "login",
      "bug",
      "error",
      "software",
      "developer",
      "dev",
      "dashboard",
      "not working",
    ],
  },
  {
    department: "sourcing",
    label: "Sourcing",
    keywords: [
      "supplier",
      "vendor",
      "manufacturer",
      "sample",
      "sourcing",
      "factory",
      "product source",
      "moq",
    ],
  },
  {
    department: "research",
    label: "Product Research",
    keywords: [
      "research",
      "product research",
      "niche",
      "competitor",
      "winning product",
      "market analysis",
      "validation",
    ],
  },
  {
    department: "sales",
    label: "Sales & Accounts",
    keywords: [
      "payment",
      "pay",
      "invoice",
      "receipt",
      "refund",
      "emi",
      "installment",
      "balance",
      "pricing",
      "fees",
    ],
  },
  {
    department: "support",
    label: "Support",
    keywords: [
      "support",
      "issue",
      "problem",
      "stuck",
      "not able",
      "unable",
      "help me",
      "query",
      "question",
      "doubt",
    ],
  },
];

const GENERIC_MANAGER_KEYWORDS = [
  "need help",
  "help with this",
  "please help",
  "call me",
  "connect me",
  "talk to",
  "urgent",
  "escalate",
  "manager",
  "senior",
  "not satisfied",
];

function clean(value: string | undefined | null, maxLength: number) {
  return (value || "").trim().slice(0, maxLength);
}

export function hashLeadSecret(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function generateLeadWebhookSecret() {
  return randomBytes(32).toString("hex");
}

export function secretsMatch(received: string, expectedHash: string) {
  const receivedBuffer = Buffer.from(hashLeadSecret(received), "hex");
  const expectedBuffer = Buffer.from(expectedHash, "hex");
  return (
    receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer)
  );
}

export function slugifyLeadSource(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function ensureDefaultLeadSources() {
  const [wati, manual] = await Promise.all([
    prisma.leadSource.upsert({
      where: { slug: WATI_SOURCE_SLUG },
      update: {
        sourceType: "wati",
        webhookEnabled: true,
        description:
          "WhatsApp replies and meaningful WATI chat messages routed into CRM work queues",
      },
      create: {
        name: "WATI Leads",
        slug: WATI_SOURCE_SLUG,
        sourceType: "wati",
        description:
          "WhatsApp replies and meaningful WATI chat messages routed into CRM work queues",
        webhookEnabled: true,
        defaultCampaign: "Saturday WATI Payment Intent",
        defaultDepartment: "sales",
      },
    }),
    prisma.leadSource.upsert({
      where: { slug: MANUAL_SOURCE_SLUG },
      update: { sourceType: "manual", webhookEnabled: false },
      create: {
        name: "Manual Excel",
        slug: MANUAL_SOURCE_SLUG,
        sourceType: "manual",
        description: "CSV and Excel lead imports uploaded by CRM staff",
        webhookEnabled: false,
        defaultDepartment: "sales",
      },
    }),
  ]);
  return { wati, manual };
}

export function parseLeadDate(value?: string | null) {
  const raw = clean(value, 100);
  if (!raw) return new Date();
  if (/^\d{10}$/.test(raw)) return new Date(Number(raw) * 1000);
  if (/^\d{13}$/.test(raw)) return new Date(Number(raw));
  if (/^\d{5}(?:\.\d+)?$/.test(raw)) {
    const excelSerial = Number(raw);
    if (excelSerial > 20_000 && excelSerial < 80_000) {
      return new Date(Math.round((excelSerial - 25_569) * 86_400_000));
    }
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function leadDedupeKey(input: NormalizedLeadInput) {
  const identity = input.phone || input.email || input.fullName.toLowerCase();
  return createHash("sha256").update(identity).digest("hex");
}

function generatedExternalId(input: NormalizedLeadInput) {
  return createHash("sha256")
    .update(
      [
        input.phone,
        input.email,
        input.fullName.toLowerCase(),
        input.responseCode,
        input.responseText.toLowerCase(),
        input.campaign.toLowerCase(),
        input.receivedAt,
      ].join("|"),
    )
    .digest("hex");
}

function normalizeMessageForRouting(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function classifyWatiLeadRouting(input: NormalizedLeadInput): LeadRouting {
  const message = normalizeMessageForRouting(
    [input.responseText, input.notes, input.campaign, input.company].filter(Boolean).join(" "),
  );
  const urgent = /\b(urgent|asap|immediately|complaint|angry|not satisfied|refund)\b/.test(message);

  for (const rule of WATI_DEPARTMENT_RULES) {
    if (rule.keywords.some((keyword) => message.includes(normalizeMessageForRouting(keyword)))) {
      return {
        department: rule.department,
        priority: urgent ? "urgent" : "high",
        reason: `Auto-routed to ${rule.label} from WATI message keywords.`,
      };
    }
  }

  if (
    input.responseCode === "has_question" ||
    GENERIC_MANAGER_KEYWORDS.some((keyword) => message.includes(normalizeMessageForRouting(keyword)))
  ) {
    return {
      department: "management",
      priority: urgent ? "urgent" : "high",
      reason:
        "Auto-routed to Management because the WATI message needs a manager to triage and assign.",
    };
  }

  if (input.responseCode === "already_paid" || input.responseCode === "will_pay_shortly") {
    return {
      department: "sales",
      priority: "high",
      reason: "Auto-routed to Sales & Accounts from payment-intent WATI reply.",
    };
  }

  return {
    department: null,
    priority: urgent ? "urgent" : "medium",
    reason: "Meaningful WATI message captured; no specific department keyword matched.",
  };
}

async function findMatchingMember(input: NormalizedLeadInput) {
  const phoneDigits = input.phone.replace(/\D/g, "");
  const phoneTail = phoneDigits.length >= 8 ? phoneDigits.slice(-10) : "";
  if (!input.email && !phoneTail) return null;

  return prisma.member.findFirst({
    where: {
      OR: [
        ...(input.email
          ? [{ email: { equals: input.email, mode: Prisma.QueryMode.insensitive } }]
          : []),
        ...(phoneTail ? [{ phone: { contains: phoneTail } }] : []),
      ],
    },
    select: { id: true },
  });
}

export async function createLeadRecord(options: {
  sourceId: string;
  input: NormalizedLeadInput;
  importBatchId?: string | null;
  rawPayload?: unknown;
  defaultCampaign?: string | null;
  sourceSlug?: string | null;
}) {
  const { input } = options;
  if (!input.phone && !input.email && input.fullName === "Unnamed lead") {
    return { created: false as const, invalid: true as const, reason: "Missing lead identity" };
  }

  const externalId = clean(input.externalId, 240) || generatedExternalId(input);
  const existing = await prisma.lead.findUnique({
    where: { sourceId_externalId: { sourceId: options.sourceId, externalId } },
    select: { id: true },
  });
  if (existing) return { created: false as const, duplicate: true as const, leadId: existing.id };

  const member = await findMatchingMember(input);
  const receivedAt = parseLeadDate(input.receivedAt);
  const watiRouting =
    options.sourceSlug === WATI_SOURCE_SLUG ? classifyWatiLeadRouting(input) : null;
  const rawPayloadJson = options.rawPayload
    ? JSON.stringify(options.rawPayload).slice(0, 40_000)
    : Object.keys(input.rawData).length
      ? JSON.stringify(input.rawData).slice(0, 40_000)
      : null;

  try {
    const lead = await prisma.lead.create({
      data: {
        sourceId: options.sourceId,
        importBatchId: options.importBatchId || null,
        memberId: member?.id || null,
        externalId,
        dedupeKey: leadDedupeKey(input),
        fullName: clean(input.fullName, 180) || "Unnamed lead",
        firstName: clean(input.firstName, 100) || null,
        lastName: clean(input.lastName, 100) || null,
        phone: clean(input.phone, 40) || null,
        email: clean(input.email.toLowerCase(), 254) || null,
        company: clean(input.company, 180) || null,
        location: clean(input.location, 180) || null,
        responseCode: input.responseCode,
        responseText: clean(input.responseText, 500) || null,
        campaign: clean(input.campaign || options.defaultCampaign, 240) || null,
        priority:
          watiRouting?.priority ||
          (input.responseCode === "already_paid" || input.responseCode === "has_question"
            ? "high"
            : "medium"),
        notes: clean(
          [input.notes, watiRouting?.reason ? `Routing: ${watiRouting.reason}` : ""]
            .filter(Boolean)
            .join("\n\n"),
          4_000,
        ) || null,
        assignedToDepartment: watiRouting?.department || null,
        assignedAt: watiRouting?.department ? receivedAt : null,
        assignedByName: watiRouting?.department ? "WATI auto-router" : null,
        rawPayloadJson,
        receivedAt,
      },
      select: { id: true },
    });
    return { created: true as const, leadId: lead.id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const duplicate = await prisma.lead.findUnique({
        where: { sourceId_externalId: { sourceId: options.sourceId, externalId } },
        select: { id: true },
      });
      return {
        created: false as const,
        duplicate: true as const,
        leadId: duplicate?.id,
      };
    }
    throw error;
  }
}
