import { NextResponse } from "next/server";
import { exchangeGmailCodeForTokens } from "@/lib/gmailOAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function html(body: string, status = 200) {
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><title>Gmail connected</title><style>body{font-family:Inter,Arial,sans-serif;background:#f8fafc;color:#020617;padding:32px}main{max-width:900px;margin:auto;background:white;border:1px solid #e2e8f0;border-radius:24px;padding:28px;box-shadow:0 20px 60px rgba(15,23,42,.08)}code,textarea{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}textarea{width:100%;min-height:110px;border:1px solid #cbd5e1;border-radius:14px;padding:14px;font-size:12px}.ok{color:#047857}.bad{color:#b91c1c}.box{background:#f1f5f9;border-radius:16px;padding:16px;margin-top:16px}.small{color:#64748b;font-size:13px;line-height:1.6}</style></head><body><main>${body}</main></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  if (error) {
    return html(`<h1 class="bad">Gmail connection failed</h1><p>${error}</p>`, 400);
  }

  const state = url.searchParams.get("state") || "";
  const expectedState =
    process.env.GOOGLE_GMAIL_OAUTH_STATE_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    "gmail-oauth";
  if (state !== expectedState) {
    return html(`<h1 class="bad">Invalid OAuth state</h1><p>Please restart the Gmail connection from CRM.</p>`, 400);
  }

  const code = url.searchParams.get("code");
  if (!code) {
    return html(`<h1 class="bad">Missing code</h1><p>Google did not return an authorization code.</p>`, 400);
  }

  try {
    const tokens = await exchangeGmailCodeForTokens(url.origin, code);
    if (!tokens.refreshToken) {
      return html(
        `<h1 class="bad">Connected, but no refresh token was returned</h1><p class="small">Go to your Google Account connected apps, remove this CRM app, then start OAuth again. The CRM needs offline access so it can sync emails automatically.</p>`,
        400,
      );
    }
    return html(`<h1 class="ok">Gmail connected</h1><p>Copy this refresh token into your CRM environment file. It is shown only once.</p><textarea readonly>${tokens.refreshToken}</textarea><div class="box"><p><strong>Add this to env:</strong></p><code>GOOGLE_GMAIL_REFRESH_TOKEN=${tokens.refreshToken}</code></div><p class="small">After saving env, restart CRM. Then test sync at <code>/api/integrations/gmail/sync?secret=YOUR_GMAIL_SYNC_SECRET</code>.</p>`);
  } catch (err) {
    return html(
      `<h1 class="bad">Gmail token exchange failed</h1><p>${err instanceof Error ? err.message : "Unknown error"}</p>`,
      500,
    );
  }
}
