export const LEAD_IMPORT_FIELDS = [
  { key: "fullName", label: "Full name" },
  { key: "firstName", label: "First name" },
  { key: "lastName", label: "Last name" },
  { key: "phone", label: "Phone / WhatsApp" },
  { key: "email", label: "Email" },
  { key: "response", label: "Response / intent" },
  { key: "campaign", label: "Campaign" },
  { key: "company", label: "Company" },
  { key: "location", label: "Location" },
  { key: "notes", label: "Notes" },
  { key: "receivedAt", label: "Lead date" },
  { key: "externalId", label: "External lead ID" },
] as const;

export type LeadImportField = (typeof LEAD_IMPORT_FIELDS)[number]["key"];
export type LeadColumnMapping = Record<number, LeadImportField | "">;
export type LeadResponseCode =
  | "already_paid"
  | "will_pay_shortly"
  | "has_question"
  | "other";

const FIELD_ALIASES: Record<LeadImportField, string[]> = {
  fullName: [
    "name",
    "full name",
    "customer name",
    "lead name",
    "contact name",
    "participant name",
    "student name",
    "sender name",
  ],
  firstName: ["first name", "firstname", "given name"],
  lastName: ["last name", "lastname", "surname", "family name"],
  phone: [
    "phone",
    "phone number",
    "mobile",
    "mobile number",
    "mobile no",
    "contact number",
    "whatsapp",
    "whatsapp number",
    "wa id",
  ],
  email: ["email", "email address", "mail", "customer email"],
  response: [
    "response",
    "answer",
    "reply",
    "selection",
    "selected option",
    "button response",
    "intent",
    "payment response",
  ],
  campaign: ["campaign", "campaign name", "broadcast", "broadcast name", "source campaign"],
  company: ["company", "company name", "business", "business name", "brand"],
  location: ["location", "city", "state", "address", "region"],
  notes: ["notes", "note", "remarks", "remark", "comments", "comment", "message"],
  receivedAt: ["date", "lead date", "created at", "received at", "timestamp", "submitted at"],
  externalId: [
    "lead id",
    "external id",
    "event id",
    "message id",
    "contact id",
    "record id",
  ],
};

const FIELD_LIMITS: Record<LeadImportField, number> = {
  fullName: 180,
  firstName: 100,
  lastName: 100,
  phone: 40,
  email: 254,
  response: 500,
  campaign: 240,
  company: 180,
  location: 180,
  notes: 4_000,
  receivedAt: 100,
  externalId: 240,
};

export function normalizeLeadHeader(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(left: string, right: string) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= right.length; column += 1) {
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
}

function headerScore(header: string, alias: string) {
  const normalizedHeader = normalizeLeadHeader(header);
  const normalizedAlias = normalizeLeadHeader(alias);
  if (!normalizedHeader || !normalizedAlias) return 0;
  if (normalizedHeader === normalizedAlias) return 100;
  if (
    normalizedAlias.length >= 4 &&
    (normalizedHeader.includes(normalizedAlias) || normalizedAlias.includes(normalizedHeader))
  ) {
    return 88;
  }

  const headerTokens = new Set(normalizedHeader.split(" "));
  const aliasTokens = normalizedAlias.split(" ");
  const tokenMatches = aliasTokens.filter((token) => headerTokens.has(token)).length;
  if (tokenMatches > 0) {
    const coverage = tokenMatches / aliasTokens.length;
    if (coverage >= 0.5) return 68 + Math.round(coverage * 15);
  }

  const longest = Math.max(normalizedHeader.length, normalizedAlias.length);
  const similarity = longest
    ? 1 - levenshtein(normalizedHeader, normalizedAlias) / longest
    : 0;
  return similarity >= 0.72 ? Math.round(similarity * 80) : 0;
}

export function autoMapLeadColumns(headers: string[]): LeadColumnMapping {
  const candidates: Array<{ index: number; field: LeadImportField; score: number }> = [];
  headers.forEach((header, index) => {
    for (const field of LEAD_IMPORT_FIELDS) {
      const score = Math.max(...FIELD_ALIASES[field.key].map((alias) => headerScore(header, alias)));
      if (score >= 60) candidates.push({ index, field: field.key, score });
    }
  });

  const mapping: LeadColumnMapping = {};
  const usedFields = new Set<LeadImportField>();
  for (const candidate of candidates.toSorted((left, right) => right.score - left.score)) {
    if (mapping[candidate.index] !== undefined || usedFields.has(candidate.field)) continue;
    mapping[candidate.index] = candidate.field;
    usedFields.add(candidate.field);
  }
  headers.forEach((_, index) => {
    if (mapping[index] === undefined) mapping[index] = "";
  });
  return mapping;
}

export function normalizeLeadResponse(value?: string | null): LeadResponseCode {
  const normalized = normalizeLeadHeader(value || "").replace(/\s+/g, " ");
  if (!normalized) return "other";
  if (
    normalized.includes("already paid") ||
    normalized === "paid" ||
    normalized.includes("payment done") ||
    normalized.includes("have paid")
  ) {
    return "already_paid";
  }
  if (
    normalized.includes("will pay shortly") ||
    normalized.includes("pay shortly") ||
    normalized.includes("will pay soon") ||
    normalized.includes("pay later")
  ) {
    return "will_pay_shortly";
  }
  if (
    normalized.includes("have a question") ||
    normalized.includes("i have question") ||
    normalized.includes("question") ||
    normalized.includes("have a query")
  ) {
    return "has_question";
  }
  return "other";
}

export function normalizeLeadPhone(value?: string | null) {
  if (!value) return "";
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";
  return trimmed.startsWith("+") ? `+${digits}` : digits;
}

function cleanCell(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export interface NormalizedLeadInput {
  fullName: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  responseText: string;
  responseCode: LeadResponseCode;
  campaign: string;
  company: string;
  location: string;
  notes: string;
  receivedAt: string;
  externalId: string;
  rawData: Record<string, string>;
}

export function mapLeadImportRow(
  headers: string[],
  row: unknown[],
  mapping: LeadColumnMapping,
): NormalizedLeadInput {
  const values: Partial<Record<LeadImportField, string>> = {};
  const rawData: Record<string, string> = {};
  headers.forEach((header, index) => {
    const value = cleanCell(row[index]);
    const rawKey = (header || `Column ${index + 1}`).slice(0, 200);
    rawData[rawKey] = value.slice(0, 2_000);
    const field = mapping[index];
    if (field && value && !values[field]) values[field] = value.slice(0, FIELD_LIMITS[field]);
  });

  const firstName = values.firstName || "";
  const lastName = values.lastName || "";
  const phone = normalizeLeadPhone(values.phone);
  const email = (values.email || "").trim().toLowerCase();
  const fullName =
    values.fullName || `${firstName} ${lastName}`.trim() || email || phone || "Unnamed lead";
  const responseText = values.response || "";

  return {
    fullName,
    firstName,
    lastName,
    phone,
    email,
    responseText,
    responseCode: normalizeLeadResponse(responseText),
    campaign: values.campaign || "",
    company: values.company || "",
    location: values.location || "",
    notes: values.notes || "",
    receivedAt: values.receivedAt || "",
    externalId: values.externalId || "",
    rawData,
  };
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function flattenLeadPayload(
  value: unknown,
  flattened = new Map<string, unknown>(),
  depth = 0,
) {
  if (!isRecord(value) || depth > 6) return flattened;
  for (const [key, entry] of Object.entries(value)) {
    const normalizedKey = normalizeLeadHeader(key).replace(/\s/g, "");
    if (!flattened.has(normalizedKey) && entry !== null && entry !== "") {
      flattened.set(normalizedKey, entry);
    }
    if (isRecord(entry)) flattenLeadPayload(entry, flattened, depth + 1);
  }
  return flattened;
}

function payloadString(values: Map<string, unknown>, aliases: string[]) {
  for (const alias of aliases) {
    const value = values.get(normalizeLeadHeader(alias).replace(/\s/g, ""));
    if (typeof value === "string" || typeof value === "number") return String(value).trim();
  }
  return "";
}

export function normalizeGenericLeadPayload(payload: unknown): NormalizedLeadInput {
  const values = flattenLeadPayload(payload);
  const firstName = payloadString(values, ["firstName", "first_name", "givenName"]);
  const lastName = payloadString(values, ["lastName", "last_name", "surname"]);
  const phone = normalizeLeadPhone(
    payloadString(values, [
      "phone",
      "phoneNumber",
      "mobile",
      "mobileNumber",
      "whatsapp",
      "whatsappNumber",
      "waId",
      "contactNumber",
    ]),
  );
  const email = payloadString(values, ["email", "emailAddress", "customerEmail"]).toLowerCase();
  const fullName =
    payloadString(values, [
      "fullName",
      "name",
      "customerName",
      "leadName",
      "contactName",
      "senderName",
    ]) || `${firstName} ${lastName}`.trim() || email || phone || "Unnamed lead";
  const responseText = payloadString(values, [
    "response",
    "answer",
    "reply",
    "selection",
    "selectedOption",
    "buttonReply",
    "intent",
    "text",
  ]);

  return {
    fullName,
    firstName,
    lastName,
    phone,
    email,
    responseText,
    responseCode: normalizeLeadResponse(responseText),
    campaign: payloadString(values, ["campaign", "campaignName", "broadcast", "broadcastName"]),
    company: payloadString(values, ["company", "companyName", "business", "brand"]),
    location: payloadString(values, ["location", "city", "state", "region"]),
    notes: payloadString(values, ["notes", "remarks", "comments", "message"]),
    receivedAt: payloadString(values, ["receivedAt", "createdAt", "date", "timestamp"]),
    externalId: payloadString(values, [
      "eventId",
      "externalId",
      "leadId",
      "messageId",
      "whatsappMessageId",
      "id",
    ]),
    rawData: {},
  };
}
