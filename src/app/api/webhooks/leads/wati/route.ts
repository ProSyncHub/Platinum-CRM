import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { createLeadRecord, ensureDefaultLeadSources } from "@/lib/leads";
import { normalizeWatiLeadPayload } from "@/lib/watiLeads";

export const runtime = "nodejs";

function readSecret(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const bearer = authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : "";
  return request.headers.get("x-wati-secret")?.trim() || bearer;
}

function safeSecretMatch(received: string, expected: string) {
  const left = createHash("sha256").update(received).digest();
  const right = createHash("sha256").update(expected).digest();
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  const configuredSecret = process.env.WATI_WEBHOOK_SECRET?.trim();
  if (!configuredSecret) {
    return NextResponse.json(
      { accepted: false, error: "WATI webhook is not configured" },
      { status: 503 },
    );
  }

  if (!safeSecretMatch(readSecret(request), configuredSecret)) {
    return NextResponse.json({ accepted: false, error: "Invalid webhook secret" }, { status: 401 });
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 1_000_000) {
    return NextResponse.json({ accepted: false, error: "Payload is too large" }, { status: 413 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ accepted: false, error: "Invalid JSON payload" }, { status: 400 });
  }

  const normalized = normalizeWatiLeadPayload(payload);
  if (!normalized.accepted) {
    // WATI retries non-2xx deliveries. A valid event that is irrelevant to this
    // campaign is acknowledged and intentionally ignored.
    return NextResponse.json({ accepted: true, created: false, ignored: normalized.reason });
  }

  const { wati } = await ensureDefaultLeadSources();
  if (!wati.active || !wati.webhookEnabled) {
    return NextResponse.json({ accepted: true, created: false, ignored: "WATI source is disabled" });
  }

  const result = await createLeadRecord({
    sourceId: wati.id,
    input: normalized.input,
    defaultCampaign: wati.defaultCampaign,
    rawPayload: payload,
  });

  return NextResponse.json({ accepted: true, ...result });
}

export async function GET() {
  const configured = Boolean(process.env.WATI_WEBHOOK_SECRET?.trim());
  const source = configured
    ? await prisma.leadSource.findUnique({
        where: { slug: "wati" },
        select: { active: true, webhookEnabled: true },
      })
    : null;
  return NextResponse.json({
    service: "WATI lead webhook",
    configured,
    active: Boolean(source?.active && source.webhookEnabled),
  });
}
