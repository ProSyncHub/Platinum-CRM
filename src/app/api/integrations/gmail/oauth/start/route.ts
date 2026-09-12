import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { buildGmailOAuthUrl, gmailOAuthConfigured } from "@/lib/gmailOAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAdmin(role?: string | null) {
  const normalized = role?.trim().toLowerCase();
  return normalized === "owner" || normalized === "admin" || normalized === "superadmin";
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Only admins can connect Gmail." }, { status: 403 });
  }
  if (!gmailOAuthConfigured()) {
    return NextResponse.json(
      {
        error:
          "Add GOOGLE_GMAIL_CLIENT_ID and GOOGLE_GMAIL_CLIENT_SECRET before starting Gmail OAuth.",
      },
      { status: 503 },
    );
  }

  const origin = new URL(request.url).origin;
  const stateSecret =
    process.env.GOOGLE_GMAIL_OAUTH_STATE_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    "gmail-oauth";
  return NextResponse.redirect(buildGmailOAuthUrl(origin, stateSecret));
}
