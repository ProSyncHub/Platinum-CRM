import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";

type JsonRecord = Record<string, unknown>;
type EmailSource = "mailerlite" | "gmail";

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clean(value: unknown, maxLength = 500) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value).trim().slice(0, maxLength);
}

function flatten(value: unknown, output = new Map<string, unknown>(), depth = 0) {
  if (!isRecord(value) || depth > 7) return output;
  for (const [key, entry] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!output.has(normalizedKey) && entry !== null && entry !== "") output.set(normalizedKey, entry);
    if (isRecord(entry)) flatten(entry, output, depth + 1);
    if (Array.isArray(entry)) {
      entry.filter(isRecord).slice(0, 10).forEach((item) => flatten(item, output, depth + 1));
    }
  }
  return output;
}

function valueFor(values: Map<string, unknown>, aliases: string[], maxLength = 500) {
  for (const alias of aliases) {
    const value = values.get(alias.toLowerCase().replace(/[^a-z0-9]/g, ""));
    const text = clean(value, maxLength);
    if (text) return text;
  }
  return "";
}

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

function extractEmails(value: unknown) {
  const found = new Set<string>();
  const visit = (entry: unknown, depth = 0) => {
    if (depth > 6 || entry === null || entry === undefined) return;
    if (typeof entry === "string" || typeof entry === "number") {
      for (const match of String(entry).matchAll(EMAIL_PATTERN)) {
        found.add(match[0].toLowerCase());
      }
      return;
    }
    if (Array.isArray(entry)) {
      entry.slice(0, 20).forEach((item) => visit(item, depth + 1));
      return;
    }
    if (isRecord(entry)) {
      Object.values(entry).forEach((item) => visit(item, depth + 1));
    }
  };
  visit(value);
  return Array.from(found);
}

function parseDate(value: string) {
  if (!value) return new Date();
  if (/^\d{10}$/.test(value)) return new Date(Number(value) * 1000);
  if (/^\d{13}$/.test(value)) return new Date(Number(value));
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function normalizeDirection(source: EmailSource, event: string, fromEmail: string, toEmail: string) {
  const normalized = event.toLowerCase();
  if (source === "mailerlite") return "outbound";
  if (normalized.includes("sent") || normalized.includes("delivered")) return "outbound";
  if (normalized.includes("received") || normalized.includes("reply") || normalized.includes("inbound")) return "inbound";
  const companyDomain = process.env.COMPANY_EMAIL_DOMAIN?.trim().toLowerCase() || "prosyncedu.com";
  if (fromEmail.toLowerCase().endsWith(`@${companyDomain}`)) return "outbound";
  if (toEmail.toLowerCase().endsWith(`@${companyDomain}`)) return "inbound";
  return "outbound";
}

export function readWebhookSecret(request: Request, explicitSecret?: string) {
  const authorization = request.headers.get("authorization") || "";
  const bearer = authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : "";
  const urlSecret = new URL(request.url).searchParams.get("secret")?.trim() || "";
  return (
    request.headers.get("x-prosync-secret")?.trim() ||
    request.headers.get("x-mailerlite-secret")?.trim() ||
    request.headers.get("x-gmail-secret")?.trim() ||
    bearer ||
    urlSecret ||
    explicitSecret?.trim() ||
    ""
  );
}

export function safeSecretMatch(received: string, expected: string) {
  const left = createHash("sha256").update(received).digest();
  const right = createHash("sha256").update(expected).digest();
  return left.length === right.length && timingSafeEqual(left, right);
}

export function normalizeEmailJourneyPayload(source: EmailSource, payload: unknown) {
  const values = flatten(payload);
  const event = valueFor(values, ["event", "eventType", "type", "activity", "action"], 120);
  const subject = valueFor(values, ["subject", "emailSubject", "campaignSubject", "name", "campaignName"], 240);
  const messageId = valueFor(values, ["id", "messageId", "emailId", "campaignId", "eventId", "webhookId"], 240);
  const fromEmail = valueFor(values, ["from", "fromEmail", "sender", "senderEmail"], 254);
  const toEmail = valueFor(values, ["to", "email", "subscriberEmail", "recipient", "recipientEmail"], 254);
  const snippet = valueFor(values, ["snippet", "preview", "summary", "body", "text", "message", "content"], 1_500);
  const occurredAt = valueFor(values, ["date", "timestamp", "createdAt", "created", "occurredAt", "sentAt"], 100);
  const allEmails = extractEmails(payload);
  const targetEmails = Array.from(
    new Set([toEmail, ...allEmails].map((email) => email.toLowerCase()).filter(Boolean)),
  );
  const direction = normalizeDirection(source, event, fromEmail, toEmail);
  const label = source === "mailerlite" ? "MailerLite" : "Gmail";
  const normalizedEvent = event || (source === "mailerlite" ? "Email activity" : "Email communication");

  return {
    source,
    sourceLabel: label,
    externalReference:
      messageId ||
      createHash("sha256")
        .update(JSON.stringify(payload).slice(0, 10_000))
        .digest("hex"),
    event: normalizedEvent,
    direction,
    subject,
    fromEmail,
    toEmail,
    targetEmails,
    occurredAt: parseDate(occurredAt),
    notes: [
      `${label}: ${normalizedEvent}`,
      subject ? `Subject: ${subject}` : "",
      fromEmail ? `From: ${fromEmail}` : "",
      toEmail ? `To: ${toEmail}` : "",
      snippet ? `Summary/message: ${snippet}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    rawPayloadJson: JSON.stringify(payload).slice(0, 20_000),
  };
}

export async function createEmailJourneyLog(source: EmailSource, payload: unknown) {
  const input = normalizeEmailJourneyPayload(source, payload);
  if (!input.targetEmails.length) {
    return { ok: true as const, created: false as const, ignored: "No email address in payload" };
  }

  const existing = await prisma.callLog.findFirst({
    where: {
      source: `${source}_integration`,
      externalReference: input.externalReference,
    },
    select: { id: true, memberId: true },
  });
  if (existing) {
    return { ok: true as const, created: false as const, duplicate: true as const, callLogId: existing.id, memberId: existing.memberId };
  }

  const member = await prisma.member.findFirst({
    where: {
      email: { in: input.targetEmails, mode: "insensitive" },
    },
    select: { id: true },
  });
  if (!member) {
    return {
      ok: true as const,
      created: false as const,
      ignored: "No matching CRM member email",
      emailCount: input.targetEmails.length,
    };
  }

  const log = await prisma.callLog.create({
    data: {
      memberId: member.id,
      date: input.occurredAt,
      type: input.direction,
      medium: "email",
      outcome: input.source === "mailerlite" ? `MailerLite ${input.event}` : input.event,
      notes: input.notes,
      staffName: input.sourceLabel,
      staffDepartment: "automation",
      source: `${source}_integration`,
      externalReference: input.externalReference,
    },
    select: { id: true, memberId: true },
  });

  await prisma.member.update({
    where: { id: member.id },
    data: {
      lastConnectDate: input.occurredAt,
      lastContactMedium: "email",
      lastContactStaff: input.sourceLabel,
    },
  });

  return { ok: true as const, created: true as const, callLogId: log.id, memberId: log.memberId };
}
