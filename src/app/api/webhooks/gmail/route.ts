import { NextResponse } from "next/server";
import {
  createEmailJourneyLog,
  readWebhookSecret,
  safeSecretMatch,
} from "@/lib/emailJourneyIntegrations";

export const runtime = "nodejs";

export async function handleGmailWebhook(request: Request, explicitSecret?: string) {
  const configuredSecret = process.env.GMAIL_WEBHOOK_SECRET?.trim();
  if (!configuredSecret) {
    return NextResponse.json(
      { accepted: false, error: "Gmail webhook is not configured" },
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

  const result = await createEmailJourneyLog("gmail", payload);
  return NextResponse.json({ accepted: true, ...result });
}

export async function POST(request: Request) {
  return handleGmailWebhook(request);
}

export async function GET() {
  return NextResponse.json({
    service: "Gmail journey webhook",
    configured: Boolean(process.env.GMAIL_WEBHOOK_SECRET?.trim()),
  });
}
