import { NextResponse } from "next/server";
import {
  createEmailJourneyLog,
  readWebhookSecret,
  safeSecretMatch,
} from "@/lib/emailJourneyIntegrations";

export const runtime = "nodejs";

export async function handleMailerLiteWebhook(request: Request, explicitSecret?: string) {
  const configuredSecret = process.env.MAILERLITE_WEBHOOK_SECRET?.trim();
  if (!configuredSecret) {
    return NextResponse.json(
      { accepted: false, error: "MailerLite webhook is not configured" },
      { status: 503 },
    );
  }
  if (!safeSecretMatch(readWebhookSecret(request, explicitSecret), configuredSecret)) {
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

  const result = await createEmailJourneyLog("mailerlite", payload);
  return NextResponse.json({ accepted: true, ...result });
}

export async function POST(request: Request) {
  return handleMailerLiteWebhook(request);
}

export async function GET() {
  return NextResponse.json({
    service: "MailerLite journey webhook",
    configured: Boolean(process.env.MAILERLITE_WEBHOOK_SECRET?.trim()),
  });
}
