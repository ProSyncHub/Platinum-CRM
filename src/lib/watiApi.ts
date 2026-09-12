import "server-only";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function collectMessageRecords(value: unknown): JsonRecord[] {
  if (Array.isArray(value)) {
    return value.filter(isRecord);
  }
  if (!isRecord(value)) return [];
  for (const key of ["messages", "items", "records", "data", "result", "results"]) {
    const nested = value[key];
    const records = collectMessageRecords(nested);
    if (records.length) return records;
  }
  return [];
}

export async function fetchWatiConversationMessages(target: string, limit = 50) {
  const baseUrl = process.env.WATI_API_BASE_URL?.trim().replace(/\/+$/, "");
  const token = process.env.WATI_API_TOKEN?.trim();
  if (!baseUrl || !token) {
    return {
      success: false as const,
      error: "Add WATI_API_BASE_URL and WATI_API_TOKEN to enable WATI chat sync.",
    };
  }

  const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 100));
  const url = new URL(
    `api/v1/getMessages/${encodeURIComponent(target)}`,
    `${baseUrl}/`,
  );
  url.searchParams.set("pageSize", String(safeLimit));

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    return {
      success: false as const,
      error: `WATI chat sync failed (${response.status}). ${text.slice(0, 240)}`,
    };
  }

  const payload = (await response.json()) as unknown;
  return {
    success: true as const,
    messages: collectMessageRecords(payload),
  };
}
