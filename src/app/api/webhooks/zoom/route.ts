import { createHmac, timingSafeEqual } from "node:crypto";
import { after, NextRequest, NextResponse } from "next/server";
import {
  processZoomWebhookEvent,
  recordZoomWebhookEvent,
} from "@/lib/oneOnOneSessions";
import { getZoomWebhookSecret } from "@/lib/zoom";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_BODY_BYTES = 2_000_000;
const MAX_TIMESTAMP_SKEW_SECONDS = 5 * 60;

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function verifyZoomSignature(request: NextRequest, rawBody: string, secret: string) {
  const timestamp = request.headers.get("x-zm-request-timestamp")?.trim() || "";
  const received = request.headers.get("x-zm-signature")?.trim() || "";
  if (!timestamp || !received) return false;

  const timestampSeconds = Number(timestamp);
  if (
    !Number.isFinite(timestampSeconds) ||
    Math.abs(Date.now() / 1_000 - timestampSeconds) > MAX_TIMESTAMP_SKEW_SECONDS
  ) {
    return false;
  }

  const message = `v0:${timestamp}:${rawBody}`;
  const expected = `v0=${createHmac("sha256", secret).update(message).digest("hex")}`;
  return safeEqual(received, expected);
}

export async function POST(request: NextRequest) {
  let secret: string;
  try {
    secret = getZoomWebhookSecret();
  } catch (error) {
    console.error("Zoom webhook configuration error:", error);
    return NextResponse.json(
      { accepted: false, error: "Zoom webhook is not configured." },
      { status: 503 },
    );
  }

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
    return NextResponse.json(
      { accepted: false, error: "Webhook payload is too large." },
      { status: 413 },
    );
  }
  if (!verifyZoomSignature(request, rawBody, secret)) {
    return NextResponse.json(
      { accepted: false, error: "Invalid Zoom webhook signature." },
      { status: 401 },
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { accepted: false, error: "Invalid JSON payload." },
      { status: 400 },
    );
  }

  const record = payload as {
    event?: string;
    payload?: { plainToken?: string };
  };
  if (record.event === "endpoint.url_validation") {
    const plainToken = record.payload?.plainToken?.trim();
    if (!plainToken) {
      return NextResponse.json(
        { accepted: false, error: "Zoom validation token is missing." },
        { status: 400 },
      );
    }
    return NextResponse.json({
      plainToken,
      encryptedToken: createHmac("sha256", secret)
        .update(plainToken)
        .digest("hex"),
    });
  }

  try {
    const receipt = await recordZoomWebhookEvent(rawBody, payload);
    if (!receipt.duplicate && receipt.eventId) {
      after(() => processZoomWebhookEvent(receipt.eventId));
    }
    return NextResponse.json({ accepted: true, duplicate: receipt.duplicate });
  } catch (error) {
    console.error("Zoom webhook receipt failed:", error);
    return NextResponse.json(
      { accepted: false, error: "Webhook receipt could not be recorded." },
      { status: 500 },
    );
  }
}
