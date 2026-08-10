import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { normalizeGenericLeadPayload } from "@/lib/leadMapping";
import { createLeadRecord, secretsMatch } from "@/lib/leads";

export const runtime = "nodejs";

function readSecret(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const bearer = authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : "";
  return request.headers.get("x-prosync-secret")?.trim() || bearer;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ source: string }> },
) {
  const { source: slug } = await context.params;
  const source = await prisma.leadSource.findUnique({
    where: { slug },
    select: {
      id: true,
      active: true,
      webhookEnabled: true,
      webhookSecretHash: true,
      defaultCampaign: true,
    },
  });

  if (!source || !source.active || !source.webhookEnabled) {
    return NextResponse.json({ accepted: false, error: "Lead source is unavailable" }, { status: 404 });
  }
  const receivedSecret = readSecret(request);
  if (
    !receivedSecret ||
    !source.webhookSecretHash ||
    !secretsMatch(receivedSecret, source.webhookSecretHash)
  ) {
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

  const input = normalizeGenericLeadPayload(payload);
  const result = await createLeadRecord({
    sourceId: source.id,
    input,
    defaultCampaign: source.defaultCampaign,
    rawPayload: payload,
  });
  return NextResponse.json({ accepted: true, ...result });
}
