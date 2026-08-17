import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";

const actionItemSchema = z.object({
  task: z.string().trim().min(1).max(600),
  ownerName: z.string().trim().max(160).nullable(),
  ownerEmail: z.string().trim().email().nullable(),
  ownerDepartment: z.string().trim().max(100).nullable(),
  dueDate: z.string().trim().max(40).nullable(),
  evidence: z.string().trim().max(800),
});

export const oneOnOneAnalysisSchema = z.object({
  executiveSummary: z.string().trim().min(1).max(4_000),
  topicsDiscussed: z.array(z.string().trim().min(1).max(500)).max(20),
  decisionsAndAdvice: z.array(z.string().trim().min(1).max(700)).max(20),
  memberCommitments: z.array(z.string().trim().min(1).max(700)).max(20),
  prosyncCommitments: z.array(z.string().trim().min(1).max(700)).max(20),
  blockersAndRisks: z.array(z.string().trim().min(1).max(700)).max(20),
  unresolvedQuestions: z.array(z.string().trim().min(1).max(700)).max(20),
  nextSessionFocus: z.array(z.string().trim().min(1).max(700)).max(12),
  actionItems: z.array(actionItemSchema).max(20),
  reviewRequired: z.boolean(),
  reviewReason: z.string().trim().max(1_000).nullable(),
});

export type OneOnOneAnalysis = z.infer<typeof oneOnOneAnalysisSchema>;

export interface OneOnOneAnalysisSource {
  member: {
    memberCode: string;
    fullName: string;
    programType: string;
    currentStage: string;
    healthStatus: string;
  };
  session: {
    sessionNumber: number;
    scheduledStart: string;
    verifiedMinutes: number;
    memberQuestions: string | null;
    preparationNotes: string | null;
    postMeetingNotes: string | null;
  };
  transcript: string;
}

const SYSTEM_PROMPT = `You document a ProSync Platinum member's verified Zoom 1-on-1 session.
Use only the supplied CRM context and transcript. Do not invent a person, owner, email, date, amount, result, commitment, deadline, or decision.
Separate what the member committed to do from what ProSync committed to do. An action item may include an owner email or due date only when explicitly stated in the evidence. Otherwise use null.
Keep the executive summary concise but operationally complete. Include blockers and unresolved questions without exaggeration.
Set reviewRequired when speaker identity is unclear, the transcript is materially incomplete, or the evidence conflicts. Explain why in reviewReason.
Return the result only through the provided tool.`;

const analysisJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "executiveSummary",
    "topicsDiscussed",
    "decisionsAndAdvice",
    "memberCommitments",
    "prosyncCommitments",
    "blockersAndRisks",
    "unresolvedQuestions",
    "nextSessionFocus",
    "actionItems",
    "reviewRequired",
    "reviewReason",
  ],
  properties: {
    executiveSummary: { type: "string" },
    topicsDiscussed: { type: "array", items: { type: "string" } },
    decisionsAndAdvice: { type: "array", items: { type: "string" } },
    memberCommitments: { type: "array", items: { type: "string" } },
    prosyncCommitments: { type: "array", items: { type: "string" } },
    blockersAndRisks: { type: "array", items: { type: "string" } },
    unresolvedQuestions: { type: "array", items: { type: "string" } },
    nextSessionFocus: { type: "array", items: { type: "string" } },
    actionItems: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "task",
          "ownerName",
          "ownerEmail",
          "ownerDepartment",
          "dueDate",
          "evidence",
        ],
        properties: {
          task: { type: "string" },
          ownerName: { type: ["string", "null"] },
          ownerEmail: { type: ["string", "null"] },
          ownerDepartment: { type: ["string", "null"] },
          dueDate: { type: ["string", "null"] },
          evidence: { type: "string" },
        },
      },
    },
    reviewRequired: { type: "boolean" },
    reviewReason: { type: ["string", "null"] },
  },
} as const;

async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 75_000);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export function oneOnOneAnalysisSourceHash(source: OneOnOneAnalysisSource) {
  return createHash("sha256").update(JSON.stringify(source)).digest("hex");
}

export async function generateOneOnOneAnalysis(source: OneOnOneAnalysisSource) {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured on the server.");

  const model = process.env.CRM_AI_MODEL?.trim() || "claude-sonnet-5";
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
          content: `Create the verified 1-on-1 record from this evidence:\n${JSON.stringify(source)}`,
        },
      ],
      tools: [
        {
          name: "record_one_on_one_analysis",
          description: "Record a factual structured analysis of the verified 1-on-1.",
          input_schema: analysisJsonSchema,
        },
      ],
      tool_choice: { type: "tool", name: "record_one_on_one_analysis" },
    }),
    cache: "no-store",
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
      ? (payload as {
          content?: Array<{ type?: string; name?: string; input?: unknown }>;
        }).content
      : [];
  const result = content?.find(
    (item) =>
      item.type === "tool_use" && item.name === "record_one_on_one_analysis",
  )?.input;
  if (!result) throw new Error("Anthropic returned no structured 1-on-1 analysis.");

  return {
    analysis: oneOnOneAnalysisSchema.parse(result),
    provider: "anthropic",
    model,
    sourceHash: oneOnOneAnalysisSourceHash(source),
  };
}
