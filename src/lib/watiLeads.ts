import {
  flattenLeadPayload,
  normalizeGenericLeadPayload,
  normalizeLeadResponse,
  type NormalizedLeadInput,
} from "@/lib/leadMapping";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function valueFromObject(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (!isRecord(value)) return "";
  for (const key of [
    "title",
    "text",
    "displayText",
    "selectedDisplayText",
    "name",
    "description",
    "id",
  ]) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return "";
}

function directString(payload: JsonRecord, aliases: string[]) {
  for (const alias of aliases) {
    const value = payload[alias];
    if (typeof value === "string" || typeof value === "number") return String(value).trim();
  }
  return "";
}

export function normalizeWatiLeadPayload(payload: unknown):
  | { accepted: true; input: NormalizedLeadInput }
  | { accepted: false; reason: string } {
  if (!isRecord(payload)) return { accepted: false, reason: "Payload is not an object" };
  if (payload.owner === true) return { accepted: false, reason: "Outgoing account message" };

  const eventType = directString(payload, ["eventType", "event", "type"]).toLowerCase();
  const incomingEvent =
    !eventType ||
    eventType === "message" ||
    eventType.includes("messagereceived") ||
    eventType.includes("replied");
  if (!incomingEvent) return { accepted: false, reason: "Not an incoming reply event" };

  const replyCandidates = [
    valueFromObject(payload.interactiveButtonReply),
    valueFromObject(payload.buttonReply),
    valueFromObject(payload.listReply),
    directString(payload, ["text", "message", "reply"]),
  ].filter(Boolean);
  const responseText =
    replyCandidates.find((candidate) => normalizeLeadResponse(candidate) !== "other") || "";
  const responseCode = normalizeLeadResponse(responseText);
  if (responseCode === "other") {
    return { accepted: false, reason: "Reply is not one of the configured lead options" };
  }

  const generic = normalizeGenericLeadPayload(payload);
  const flattened = flattenLeadPayload(payload);
  const flattenedValue = (aliases: string[]) => {
    for (const alias of aliases) {
      const key = alias.toLowerCase().replace(/[^a-z0-9]/g, "");
      const value = flattened.get(key);
      if (typeof value === "string" || typeof value === "number") return String(value).trim();
    }
    return "";
  };
  const phone = directString(payload, ["waId", "whatsappNumber", "phone", "mobile"]);
  const senderName = directString(payload, ["senderName", "contactName", "name"]);
  const timestamp = directString(payload, ["created", "timestamp", "receivedAt"]);
  const externalId = directString(payload, [
    "id",
    "whatsappMessageId",
    "localMessageId",
    "messageId",
  ]);

  return {
    accepted: true,
    input: {
      ...generic,
      fullName: senderName || generic.fullName,
      phone: phone || generic.phone,
      responseText,
      responseCode,
      campaign:
        flattenedValue(["campaignName", "broadcastName", "templateName", "campaign"]) ||
        generic.campaign,
      receivedAt: timestamp || generic.receivedAt,
      externalId: externalId || generic.externalId,
      notes: generic.notes || "WATI campaign quick-reply response",
    },
  };
}
