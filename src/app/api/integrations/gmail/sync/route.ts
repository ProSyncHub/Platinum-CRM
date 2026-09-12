import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  gmailSyncConfigured,
  safeSyncSecretMatch,
  syncGmailToJourney,
} from "@/lib/gmailOAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAdmin(role?: string | null) {
  const normalized = role?.trim().toLowerCase();
  return normalized === "owner" || normalized === "admin" || normalized === "superadmin";
}

function readSecret(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const bearer = authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : "";
  return (
    request.headers.get("x-gmail-sync-secret")?.trim() ||
    bearer ||
    new URL(request.url).searchParams.get("secret")?.trim() ||
    ""
  );
}

async function authorized(request: Request) {
  const configured = process.env.GMAIL_SYNC_SECRET?.trim();
  if (configured && safeSyncSecretMatch(readSecret(request), configured)) return true;
  const session = await getServerSession(authOptions);
  return Boolean(session?.user && isAdmin(session.user.role));
}

export async function POST(request: Request) {
  if (!(await authorized(request))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!gmailSyncConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Gmail sync is not configured. Add GOOGLE_GMAIL_CLIENT_ID, GOOGLE_GMAIL_CLIENT_SECRET, and GOOGLE_GMAIL_REFRESH_TOKEN.",
      },
      { status: 503 },
    );
  }

  try {
    return NextResponse.json(await syncGmailToJourney());
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Gmail sync failed" },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return POST(request);
}
