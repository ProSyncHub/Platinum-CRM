import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { NormalizedLeadInput } from "@/lib/leadMapping";

export const WATI_SOURCE_SLUG = "wati";
export const MANUAL_SOURCE_SLUG = "manual-excel";

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
      },
      create: {
        name: "WATI Leads",
        slug: WATI_SOURCE_SLUG,
        sourceType: "wati",
        description: "WhatsApp campaign responses received from WATI",
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
          input.responseCode === "already_paid" || input.responseCode === "has_question"
            ? "high"
            : "medium",
        notes: clean(input.notes, 4_000) || null,
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
