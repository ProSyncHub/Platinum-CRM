import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { createEmailJourneyLog } from "@/lib/emailJourneyIntegrations";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_API_URL = "https://gmail.googleapis.com/gmail/v1/users/me";
const GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];

type GmailHeader = { name?: string; value?: string };
type GmailMessage = {
  id?: string;
  threadId?: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: { headers?: GmailHeader[] };
};

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function redirectUri(origin: string) {
  return `${origin.replace(/\/+$/, "")}/api/integrations/gmail/oauth/callback`;
}

export function gmailOAuthConfigured() {
  return Boolean(
    process.env.GOOGLE_GMAIL_CLIENT_ID?.trim() &&
      process.env.GOOGLE_GMAIL_CLIENT_SECRET?.trim(),
  );
}

export function gmailSyncConfigured() {
  return gmailOAuthConfigured() && Boolean(process.env.GOOGLE_GMAIL_REFRESH_TOKEN?.trim());
}

export function buildGmailOAuthUrl(origin: string, stateSecret: string) {
  const params = new URLSearchParams({
    client_id: requiredEnv("GOOGLE_GMAIL_CLIENT_ID"),
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: GMAIL_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: stateSecret,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeGmailCodeForTokens(origin: string, code: string) {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: requiredEnv("GOOGLE_GMAIL_CLIENT_ID"),
      client_secret: requiredEnv("GOOGLE_GMAIL_CLIENT_SECRET"),
      redirect_uri: redirectUri(origin),
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(String(data.error_description || data.error || "Google token exchange failed"));
  }
  return {
    accessToken: String(data.access_token || ""),
    refreshToken: String(data.refresh_token || ""),
    scope: String(data.scope || ""),
    expiresIn: Number(data.expires_in || 0),
  };
}

async function refreshGmailAccessToken() {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requiredEnv("GOOGLE_GMAIL_CLIENT_ID"),
      client_secret: requiredEnv("GOOGLE_GMAIL_CLIENT_SECRET"),
      refresh_token: requiredEnv("GOOGLE_GMAIL_REFRESH_TOKEN"),
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(String(data.error_description || data.error || "Could not refresh Gmail token"));
  }
  return String(data.access_token || "");
}

async function gmailGet<T>(accessToken: string, path: string, params?: Record<string, string>) {
  const url = new URL(`${GMAIL_API_URL}${path}`);
  Object.entries(params || {}).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    cache: "no-store",
  });
  const data = (await response.json().catch(() => ({}))) as T & Record<string, unknown>;
  if (!response.ok) {
    throw new Error(String(data.error || data.message || `Gmail API failed: ${response.status}`));
  }
  return data as T;
}

function header(message: GmailMessage, name: string) {
  return (
    message.payload?.headers?.find(
      (item) => item.name?.trim().toLowerCase() === name.toLowerCase(),
    )?.value || ""
  );
}

function isoDateFromGmail(message: GmailMessage) {
  const headerDate = header(message, "Date");
  if (headerDate) {
    const parsed = new Date(headerDate);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  if (message.internalDate && /^\d+$/.test(message.internalDate)) {
    return new Date(Number(message.internalDate)).toISOString();
  }
  return new Date().toISOString();
}

function normalizeGmailMessage(message: GmailMessage, event: string) {
  return {
    event,
    messageId: message.id,
    threadId: message.threadId,
    from: header(message, "From"),
    to: header(message, "To"),
    subject: header(message, "Subject"),
    date: isoDateFromGmail(message),
    snippet: message.snippet || "",
  };
}

async function listMessageIds(accessToken: string, query: string, maxResults: number) {
  const data = await gmailGet<{ messages?: Array<{ id?: string }> }>(accessToken, "/messages", {
    q: query,
    maxResults: String(maxResults),
  });
  return (data.messages || []).map((message) => message.id).filter(Boolean) as string[];
}

export function safeSyncSecretMatch(received: string, expected: string) {
  const left = createHash("sha256").update(received).digest();
  const right = createHash("sha256").update(expected).digest();
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function syncGmailToJourney() {
  const accessToken = await refreshGmailAccessToken();
  const maxResults = Math.max(1, Math.min(Number(process.env.GMAIL_SYNC_MAX_RESULTS || 50), 200));
  const sentQuery = process.env.GMAIL_SYNC_SENT_QUERY?.trim() || "in:sent newer_than:2d";
  const inboxQuery = process.env.GMAIL_SYNC_INBOX_QUERY?.trim() || "in:inbox newer_than:2d";
  const [sentIds, inboxIds] = await Promise.all([
    listMessageIds(accessToken, sentQuery, maxResults),
    listMessageIds(accessToken, inboxQuery, maxResults),
  ]);

  const entries = [
    ...sentIds.map((id) => ({ id, event: "Email sent" })),
    ...inboxIds.map((id) => ({ id, event: "Email received" })),
  ];
  const uniqueEntries = Array.from(
    new Map(entries.map((entry) => [entry.id, entry])).values(),
  ).slice(0, maxResults * 2);

  let created = 0;
  let duplicate = 0;
  let ignored = 0;
  for (const entry of uniqueEntries) {
    const message = await gmailGet<GmailMessage>(accessToken, `/messages/${entry.id}`, {
      format: "metadata",
    });
    const result = await createEmailJourneyLog("gmail", normalizeGmailMessage(message, entry.event));
    if (result.created) created += 1;
    else if ("duplicate" in result && result.duplicate) duplicate += 1;
    else ignored += 1;
  }

  return {
    ok: true as const,
    scanned: uniqueEntries.length,
    created,
    duplicate,
    ignored,
  };
}
