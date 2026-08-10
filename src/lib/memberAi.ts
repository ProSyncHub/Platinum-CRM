import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";

type DateValue = Date | string;

interface MemberAiSourceInput {
  id: string;
  memberCode: string;
  fullName: string;
  programType: string;
  activeStatus: string;
  currentStage: string;
  currentMilestone?: string | null;
  healthStatus: string;
  paymentStatus: string;
  department?: string | null;
  notes?: string | null;
  detailedNotes?: string | null;
  enrollingDate?: DateValue | null;
  endDate?: DateValue | null;
  callLogs: Array<{
    id: string;
    date: DateValue;
    type: string;
    medium: string;
    outcome: string;
    notes: string;
    staffName?: string | null;
    staffDepartment?: string | null;
  }>;
  departmentUpdates: Array<{
    id: string;
    createdAt: DateValue;
    department: string;
    category?: string | null;
    status: string;
    summary: string;
    details?: string | null;
    nextStep?: string | null;
    updatedByName: string;
  }>;
  queryTransfers: Array<{
    id: string;
    createdAt: DateValue;
    fromDepartment: string;
    toDepartment: string;
    priority: string;
    status: string;
    reason: string;
    resolutionNotes?: string | null;
    resolutionMedium?: string | null;
    resolvedAt?: DateValue | null;
  }>;
}

interface MonthlySourceEvent {
  at: string;
  department: string;
  kind: "conversation" | "department_update" | "transfer";
  detail: string;
}

const departmentBriefSchema = z.object({
  department: z.string(),
  latestConversation: z.string(),
  progress: z.string(),
  risks: z.array(z.string()),
  nextAction: z.string(),
});

const monthlyTimelineSchema = z.object({
  month: z.string(),
  status: z.string(),
  summary: z.string(),
  keyEvents: z.array(z.string()),
  departments: z.array(z.string()),
  escalations: z.array(z.string()),
});

const nextActionSchema = z.object({
  action: z.string(),
  ownerDepartment: z.string(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
});

export const memberAiAnalysisSchema = z.object({
  executiveBrief: z.string(),
  currentStatus: z.string(),
  departmentBriefs: z.array(departmentBriefSchema),
  monthlyTimeline: z.array(monthlyTimelineSchema),
  escalation: z.object({
    level: z.enum(["none", "watch", "high", "critical"]),
    summary: z.string(),
    unresolvedIssues: z.array(z.string()),
    recommendedOwner: z.string(),
    recommendedAction: z.string(),
  }),
  nextActions: z.array(nextActionSchema),
});

export type MemberAiAnalysisResult = z.infer<typeof memberAiAnalysisSchema>;

export interface MemberAiSourceBundle {
  source: ReturnType<typeof createSource>;
  sourceHash: string;
  sourceEventCount: number;
}

const analysisJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    executiveBrief: { type: "string" },
    currentStatus: { type: "string" },
    departmentBriefs: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          department: { type: "string" },
          latestConversation: { type: "string" },
          progress: { type: "string" },
          risks: { type: "array", items: { type: "string" } },
          nextAction: { type: "string" },
        },
        required: ["department", "latestConversation", "progress", "risks", "nextAction"],
      },
    },
    monthlyTimeline: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          month: { type: "string" },
          status: { type: "string" },
          summary: { type: "string" },
          keyEvents: { type: "array", items: { type: "string" } },
          departments: { type: "array", items: { type: "string" } },
          escalations: { type: "array", items: { type: "string" } },
        },
        required: ["month", "status", "summary", "keyEvents", "departments", "escalations"],
      },
    },
    escalation: {
      type: "object",
      additionalProperties: false,
      properties: {
        level: { type: "string", enum: ["none", "watch", "high", "critical"] },
        summary: { type: "string" },
        unresolvedIssues: { type: "array", items: { type: "string" } },
        recommendedOwner: { type: "string" },
        recommendedAction: { type: "string" },
      },
      required: ["level", "summary", "unresolvedIssues", "recommendedOwner", "recommendedAction"],
    },
    nextActions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          action: { type: "string" },
          ownerDepartment: { type: "string" },
          priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
        },
        required: ["action", "ownerDepartment", "priority"],
      },
    },
  },
  required: [
    "executiveBrief",
    "currentStatus",
    "departmentBriefs",
    "monthlyTimeline",
    "escalation",
    "nextActions",
  ],
} as const;

const SYSTEM_PROMPT = `You are the CRM analysis layer for a multi-department membership business.
Analyze only the supplied CRM evidence. Never invent a conversation, payment, promise, date, status, or owner.
The factual department conversations and updates remain the source of truth; your output is a concise decision brief.

Requirements:
- Lead with the member's present position, material progress, unresolved blockers, and the next best actions.
- Give every department represented in the evidence its own brief. If a department has no customer conversation, say so.
- Produce a chronological month-by-month timeline using YYYY-MM. Include only months supported by recorded activity.
- For escalation, explain what changed over time, what remains unresolved, and which department should own the next action.
- Treat old statements as historical, not current, when newer evidence supersedes them.
- Use plain, direct language suitable for staff scanning a CRM. Be concise but preserve material facts.
- If evidence is incomplete or contradictory, state that explicitly instead of guessing.`;

function asDate(value: DateValue) {
  return value instanceof Date ? value : new Date(value);
}

function iso(value: DateValue) {
  return asDate(value).toISOString();
}

function normalizeDepartment(value?: string | null) {
  return (value || "unassigned").trim().toLowerCase();
}

function clip(value: string | null | undefined, maximum = 700) {
  const clean = (value || "").replace(/\s+/g, " ").trim();
  if (clean.length <= maximum) return clean;
  return `${clean.slice(0, maximum - 1)}…`;
}

function configuredInteger(name: string, fallback: number, minimum: number, maximum: number) {
  const parsed = Number.parseInt(process.env[name] || "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

function createSource(member: MemberAiSourceInput) {
  const maxMonths = configuredInteger("CRM_AI_MAX_MONTHS", 24, 3, 60);
  const maxEvents = configuredInteger("CRM_AI_MAX_EVENTS", 240, 30, 600);

  const conversations = member.callLogs
    .filter((log) => normalizeDepartment(log.medium) !== "internal")
    .toSorted((left, right) => asDate(right.date).getTime() - asDate(left.date).getTime());

  const latestDepartmentConversations = new Map<string, (typeof conversations)[number]>();
  for (const conversation of conversations) {
    const department = normalizeDepartment(conversation.staffDepartment);
    if (!latestDepartmentConversations.has(department)) {
      latestDepartmentConversations.set(department, conversation);
    }
  }

  const events: MonthlySourceEvent[] = [
    ...conversations.map((log) => ({
      at: iso(log.date),
      department: normalizeDepartment(log.staffDepartment),
      kind: "conversation" as const,
      detail: clip(
        `${log.medium} ${log.type}; outcome: ${log.outcome}; by ${log.staffName || "staff member"}; notes: ${log.notes}`,
      ),
    })),
    ...member.departmentUpdates.map((update) => ({
      at: iso(update.createdAt),
      department: normalizeDepartment(update.department),
      kind: "department_update" as const,
      detail: clip(
        `status: ${update.status}; summary: ${update.summary}; details: ${update.details || "none"}; next step: ${update.nextStep || "none"}; by ${update.updatedByName}`,
      ),
    })),
    ...member.queryTransfers.map((transfer) => ({
      at: iso(transfer.createdAt),
      department: normalizeDepartment(transfer.fromDepartment),
      kind: "transfer" as const,
      detail: clip(
        `${transfer.fromDepartment} to ${transfer.toDepartment}; ${transfer.priority} priority; ${transfer.status}; reason: ${transfer.reason}; resolution: ${transfer.resolutionNotes || "not recorded"}`,
      ),
    })),
  ].toSorted((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime());

  const newestMonth = events[0]?.at.slice(0, 7);
  const allowedMonths = new Set<string>();
  if (newestMonth) {
    const [year, month] = newestMonth.split("-").map(Number);
    for (let offset = 0; offset < maxMonths; offset += 1) {
      const candidate = new Date(Date.UTC(year, month - 1 - offset, 1));
      allowedMonths.add(candidate.toISOString().slice(0, 7));
    }
  }

  const includedEvents = events
    .filter((event) => allowedMonths.size === 0 || allowedMonths.has(event.at.slice(0, 7)))
    .slice(0, maxEvents);
  const monthlyHistory = new Map<string, MonthlySourceEvent[]>();
  for (const event of includedEvents.toReversed()) {
    const month = event.at.slice(0, 7);
    const current = monthlyHistory.get(month) || [];
    current.push(event);
    monthlyHistory.set(month, current);
  }

  return {
    generatedFrom: "verified CRM records",
    historyCoverage: {
      recordedEvents: events.length,
      suppliedEvents: includedEvents.length,
      omittedOlderOrExcessEvents: Math.max(0, events.length - includedEvents.length),
      maximumMonths: maxMonths,
    },
    member: {
      memberCode: member.memberCode,
      fullName: member.fullName,
      program: member.programType,
      activeStatus: member.activeStatus,
      currentStage: member.currentStage,
      currentMilestone: member.currentMilestone || "not recorded",
      healthStatus: member.healthStatus,
      paymentStatus: member.paymentStatus,
      owningDepartment: normalizeDepartment(member.department),
      enrollmentDate: member.enrollingDate ? iso(member.enrollingDate) : "not recorded",
      endDate: member.endDate ? iso(member.endDate) : "not recorded",
    },
    overallOperationalNotes: clip(member.notes, 5_000) || "No operational notes recorded.",
    originalMemberBackground: clip(member.detailedNotes, 2_500) || "No original background recorded.",
    latestConversationByDepartment: Array.from(latestDepartmentConversations.entries()).map(
      ([department, conversation]) => ({
        department,
        at: iso(conversation.date),
        medium: conversation.medium,
        outcome: conversation.outcome,
        discussed: clip(conversation.notes),
        staffName: conversation.staffName || "staff member",
      }),
    ),
    latestDepartmentStatus: member.departmentUpdates
      .toSorted((left, right) => asDate(right.createdAt).getTime() - asDate(left.createdAt).getTime())
      .filter(
        (update, index, updates) =>
          updates.findIndex(
            (candidate) =>
              normalizeDepartment(candidate.department) === normalizeDepartment(update.department),
          ) === index,
      )
      .map((update) => ({
        department: normalizeDepartment(update.department),
        at: iso(update.createdAt),
        status: update.status,
        summary: clip(update.summary),
        details: clip(update.details),
        nextStep: clip(update.nextStep),
        updatedBy: update.updatedByName,
      })),
    openTransfers: member.queryTransfers
      .filter((transfer) => transfer.status.toLowerCase() !== "resolved")
      .map((transfer) => ({
        at: iso(transfer.createdAt),
        from: normalizeDepartment(transfer.fromDepartment),
        to: normalizeDepartment(transfer.toDepartment),
        priority: transfer.priority,
        reason: clip(transfer.reason),
      })),
    monthlyHistory: Array.from(monthlyHistory.entries()).map(([month, monthEvents]) => ({
      month,
      events: monthEvents,
    })),
  };
}

export function buildMemberAiSource(member: MemberAiSourceInput): MemberAiSourceBundle {
  const source = createSource(member);
  const serialized = JSON.stringify(source);
  return {
    source,
    sourceHash: createHash("sha256").update(serialized).digest("hex"),
    sourceEventCount: source.historyCoverage.recordedEvents,
  };
}

function extractOpenAiText(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const response = payload as {
    output_text?: string;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  };
  if (typeof response.output_text === "string") return response.output_text;
  return (response.output || [])
    .flatMap((item) => item.content || [])
    .filter((item) => item.type === "output_text" && typeof item.text === "string")
    .map((item) => item.text)
    .join("");
}

async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 75_000);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function runOpenAi(source: MemberAiSourceBundle["source"]) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured on the server.");

  const model = process.env.CRM_AI_MODEL || "gpt-5.6-terra";
  const response = await fetchWithTimeout("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      instructions: SYSTEM_PROMPT,
      input: `CRM evidence JSON:\n${JSON.stringify(source)}`,
      reasoning: { effort: "low" },
      text: {
        verbosity: "low",
        format: {
          type: "json_schema",
          name: "crm_member_analysis",
          description: "A factual member brief with department and monthly status analysis.",
          strict: true,
          schema: analysisJsonSchema,
        },
      },
      max_output_tokens: 3_500,
      store: false,
      safety_identifier: createHash("sha256")
        .update(source.member.memberCode)
        .digest("hex")
        .slice(0, 32),
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? (payload as { error?: { message?: string } }).error?.message
        : null;
    throw new Error(message || `OpenAI request failed with status ${response.status}.`);
  }

  const output = extractOpenAiText(payload);
  if (!output) throw new Error("OpenAI returned no analysis text.");
  return { analysis: memberAiAnalysisSchema.parse(JSON.parse(output)), provider: "openai", model };
}

async function runAnthropic(source: MemberAiSourceBundle["source"]) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured on the server.");

  const model = process.env.CRM_AI_MODEL || "claude-sonnet-5";
  const response = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 3_500,
      output_config: { effort: "low" },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Analyze this CRM evidence and record the result with the provided tool.\n${JSON.stringify(source)}`,
        },
      ],
      tools: [
        {
          name: "record_crm_analysis",
          description: "Record the structured, factual CRM member analysis.",
          input_schema: analysisJsonSchema,
        },
      ],
      tool_choice: { type: "tool", name: "record_crm_analysis" },
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? (payload as { error?: { message?: string } }).error?.message
        : null;
    throw new Error(message || `Anthropic request failed with status ${response.status}.`);
  }

  const content =
    payload && typeof payload === "object" && "content" in payload
      ? (payload as { content?: Array<{ type?: string; name?: string; input?: unknown }> }).content
      : [];
  const toolResult = content?.find(
    (item) => item.type === "tool_use" && item.name === "record_crm_analysis",
  )?.input;
  if (!toolResult) throw new Error("Anthropic returned no structured analysis.");

  return {
    analysis: memberAiAnalysisSchema.parse(toolResult),
    provider: "anthropic",
    model,
  };
}

export async function generateMemberAiAnalysis(source: MemberAiSourceBundle["source"]) {
  const provider = (process.env.CRM_AI_PROVIDER || "anthropic").trim().toLowerCase();
  if (provider === "anthropic") return runAnthropic(source);
  if (provider === "openai") return runOpenAi(source);
  throw new Error("CRM_AI_PROVIDER must be either openai or anthropic.");
}
