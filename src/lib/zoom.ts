import "server-only";

const ZOOM_API_BASE = "https://api.zoom.us/v2";
const ZOOM_TOKEN_URL = "https://zoom.us/oauth/token";

interface ZoomTokenCache {
  accessToken: string;
  expiresAt: number;
}

interface ZoomGlobal {
  zoomTokenCache?: ZoomTokenCache;
}

const zoomGlobal = globalThis as typeof globalThis & ZoomGlobal;

export class ZoomApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: number | string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ZoomApiError";
  }
}

export class ZoomDataNotReadyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ZoomDataNotReadyError";
  }
}

function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured on the server.`);
  return value;
}

export function getZoomConfiguration() {
  return {
    accountId: requiredEnvironment("ZOOM_ACCOUNT_ID"),
    clientId: requiredEnvironment("ZOOM_CLIENT_ID"),
    clientSecret: requiredEnvironment("ZOOM_CLIENT_SECRET"),
    hostUserId: requiredEnvironment("ZOOM_HOST_USER_ID"),
    timezone: process.env.ZOOM_DEFAULT_TIMEZONE?.trim() || "Asia/Calcutta",
    autoRecording:
      process.env.ZOOM_AUTO_RECORDING?.trim().toLowerCase() === "none"
        ? "none"
        : process.env.ZOOM_AUTO_RECORDING?.trim().toLowerCase() === "local"
          ? "local"
          : "cloud",
  } as const;
}

export function getZoomWebhookSecret() {
  return requiredEnvironment("ZOOM_WEBHOOK_SECRET_TOKEN");
}

export function zoomConfigurationStatus() {
  const required = [
    "ZOOM_ACCOUNT_ID",
    "ZOOM_CLIENT_ID",
    "ZOOM_CLIENT_SECRET",
    "ZOOM_HOST_USER_ID",
    "ZOOM_WEBHOOK_SECRET_TOKEN",
  ];
  const missing = required.filter((name) => !process.env[name]?.trim());
  return { configured: missing.length === 0, missing };
}

async function getZoomAccessToken(forceRefresh = false) {
  if (
    !forceRefresh &&
    zoomGlobal.zoomTokenCache &&
    zoomGlobal.zoomTokenCache.expiresAt > Date.now() + 60_000
  ) {
    return zoomGlobal.zoomTokenCache.accessToken;
  }

  const config = getZoomConfiguration();
  const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString(
    "base64",
  );
  const tokenUrl = new URL(ZOOM_TOKEN_URL);
  tokenUrl.searchParams.set("grant_type", "account_credentials");
  tokenUrl.searchParams.set("account_id", config.accountId);

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as
    | { access_token?: string; expires_in?: number; reason?: string; error?: string }
    | null;

  if (!response.ok || !payload?.access_token) {
    throw new ZoomApiError(
      payload?.reason || payload?.error || "Zoom OAuth token request failed.",
      response.status,
      payload?.error,
      payload,
    );
  }

  zoomGlobal.zoomTokenCache = {
    accessToken: payload.access_token,
    expiresAt: Date.now() + Math.max(60, payload.expires_in || 3_600) * 1_000,
  };
  return payload.access_token;
}

async function parseZoomResponse(response: Response) {
  if (response.status === 204) return null;
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return response.json().catch(() => null);
  return response.text().catch(() => "");
}

async function zoomRequest<T>(
  path: string,
  init: RequestInit = {},
  retryUnauthorized = true,
): Promise<T> {
  const accessToken = await getZoomAccessToken();
  const response = await fetch(`${ZOOM_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
  });

  if (response.status === 401 && retryUnauthorized) {
    zoomGlobal.zoomTokenCache = undefined;
    await getZoomAccessToken(true);
    return zoomRequest<T>(path, init, false);
  }

  const payload = await parseZoomResponse(response);
  if (!response.ok) {
    const errorPayload = payload as { message?: string; code?: number | string } | null;
    throw new ZoomApiError(
      errorPayload?.message || `Zoom request failed with status ${response.status}.`,
      response.status,
      errorPayload?.code,
      payload,
    );
  }
  return payload as T;
}

export interface CreateZoomMeetingInput {
  topic: string;
  agenda?: string;
  startTime: Date;
  durationMinutes: number;
  timezone?: string;
}

export interface ZoomMeeting {
  id: number;
  uuid?: string;
  host_id?: string;
  host_email?: string;
  topic?: string;
  start_time?: string;
  duration?: number;
  join_url?: string;
  start_url?: string;
}

export async function createZoomMeeting(input: CreateZoomMeetingInput) {
  const config = getZoomConfiguration();
  const host = encodeURIComponent(config.hostUserId);
  return zoomRequest<ZoomMeeting>(`/users/${host}/meetings`, {
    method: "POST",
    body: JSON.stringify({
      topic: input.topic,
      type: 2,
      start_time: input.startTime.toISOString(),
      duration: input.durationMinutes,
      timezone: input.timezone || config.timezone,
      agenda: input.agenda || "ProSync Platinum 1-on-1 session",
      default_password: true,
      settings: {
        host_video: true,
        participant_video: true,
        join_before_host: false,
        mute_upon_entry: true,
        waiting_room: true,
        auto_recording: config.autoRecording,
        meeting_authentication: false,
      },
    }),
  });
}

export async function updateZoomMeeting(
  meetingId: string,
  input: Pick<CreateZoomMeetingInput, "startTime" | "durationMinutes" | "timezone">,
) {
  const config = getZoomConfiguration();
  await zoomRequest<null>(`/meetings/${encodeURIComponent(meetingId)}`, {
    method: "PATCH",
    body: JSON.stringify({
      start_time: input.startTime.toISOString(),
      duration: input.durationMinutes,
      timezone: input.timezone || config.timezone,
    }),
  });
}

export async function deleteZoomMeeting(meetingId: string) {
  await zoomRequest<null>(`/meetings/${encodeURIComponent(meetingId)}`, {
    method: "DELETE",
  });
}

function encodeMeetingReference(reference: string) {
  const encoded = encodeURIComponent(reference);
  return reference.startsWith("/") || reference.includes("//")
    ? encodeURIComponent(encoded)
    : encoded;
}

export interface ZoomPastParticipant {
  id?: string;
  user_id?: string;
  name?: string;
  user_name?: string;
  email?: string;
  user_email?: string;
  join_time?: string;
  leave_time?: string;
  duration?: number;
  status?: string;
  [key: string]: unknown;
}

interface ZoomParticipantPage {
  next_page_token?: string;
  participants?: ZoomPastParticipant[];
  total_records?: number;
}

export async function listPastMeetingParticipants(meetingReference: string) {
  const participants: ZoomPastParticipant[] = [];
  let nextPageToken = "";
  let page = 0;

  do {
    const query = new URLSearchParams({ page_size: "300" });
    if (nextPageToken) query.set("next_page_token", nextPageToken);
    const payload = await zoomRequest<ZoomParticipantPage>(
      `/past_meetings/${encodeMeetingReference(meetingReference)}/participants?${query}`,
    );
    participants.push(...(payload.participants || []));
    nextPageToken = payload.next_page_token || "";
    page += 1;
  } while (nextPageToken && page < 10);

  if (participants.length === 0) {
    throw new ZoomDataNotReadyError("Zoom participant attendance is not available yet.");
  }
  return participants;
}

export interface ZoomRecordingFile {
  id?: string;
  file_type?: string;
  file_extension?: string;
  file_size?: number;
  recording_type?: string;
  status?: string;
  download_url?: string;
  play_url?: string;
  recording_start?: string;
  recording_end?: string;
}

export interface ZoomMeetingRecordings {
  uuid?: string;
  id?: number;
  host_id?: string;
  topic?: string;
  start_time?: string;
  duration?: number;
  total_size?: number;
  recording_count?: number;
  recording_files?: ZoomRecordingFile[];
}

export async function getMeetingRecordings(meetingReference: string) {
  return zoomRequest<ZoomMeetingRecordings>(
    `/meetings/${encodeMeetingReference(meetingReference)}/recordings`,
  );
}

interface ZoomTranscriptResponse {
  can_download?: boolean;
  download_url?: string;
  download_restriction_reason?: string;
}

export async function downloadMeetingTranscript(meetingReference: string) {
  let transcript: ZoomTranscriptResponse | null = null;
  try {
    transcript = await zoomRequest<ZoomTranscriptResponse>(
      `/meetings/${encodeMeetingReference(meetingReference)}/transcript`,
    );
  } catch (error) {
    if (error instanceof ZoomApiError && [3001, 3301].includes(Number(error.code))) {
      throw new ZoomDataNotReadyError("Zoom transcript is not available yet.");
    }
    throw error;
  }

  if (!transcript?.can_download || !transcript.download_url) {
    throw new ZoomDataNotReadyError(
      transcript?.download_restriction_reason || "Zoom transcript is still processing.",
    );
  }

  const accessToken = await getZoomAccessToken();
  const response = await fetch(transcript.download_url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new ZoomApiError(
      `Zoom transcript download failed with status ${response.status}.`,
      response.status,
    );
  }
  const text = await response.text();
  if (!text.trim()) throw new ZoomDataNotReadyError("Zoom returned an empty transcript.");
  if (Buffer.byteLength(text, "utf8") > 2_000_000) {
    throw new Error("Zoom transcript exceeds the CRM's 2 MB safety limit.");
  }
  return text;
}
