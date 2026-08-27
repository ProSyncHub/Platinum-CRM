import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { authorizeMobile } from "@/lib/mobileCalls";

export const runtime = "nodejs";

const noteSchema = z.object({ summary: z.string(), concern: z.string(), action: z.string(), followUp: z.string() });

export async function POST(request: Request, context: RouteContext<"/api/mobile/calls/[id]/analyze">) {
  if (!authorizeMobile(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.OPENAI_API_KEY) return Response.json({ error: "OPENAI_API_KEY is not configured" }, { status: 503 });
  const { id } = await context.params;
  const log = await prisma.callLog.findUnique({ where: { id } });
  if (!log?.recordingUrl) return Response.json({ error: "Recording not available" }, { status: 404 });

  const bytes = await readFile(path.join(process.cwd(), "public", log.recordingUrl.replace(/^\//, "")));
  const audioForm = new FormData();
  audioForm.set("model", process.env.CRM_TRANSCRIPTION_MODEL || "gpt-4o-mini-transcribe");
  audioForm.set("file", new File([bytes], log.recordingFileName || "call.m4a", { type: log.recordingMimeType || "audio/mp4" }));
  const transcriptionResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: audioForm });
  if (!transcriptionResponse.ok) return Response.json({ error: "Transcription failed" }, { status: 502 });
  const transcription = await transcriptionResponse.json() as { text?: string };
  const transcript = transcription.text?.trim();
  if (!transcript) return Response.json({ error: "Empty transcript" }, { status: 502 });

  const analysisResponse = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({
    model: process.env.CRM_AI_MODEL || "gpt-5.6-terra", store: false,
    instructions: "Create a concise factual CRM call note. Do not invent details. Use an empty string when a concern, action, or follow-up was not stated.",
    input: transcript,
    text: { format: { type: "json_schema", name: "call_note", strict: true, schema: { type: "object", additionalProperties: false, properties: { summary: { type: "string" }, concern: { type: "string" }, action: { type: "string" }, followUp: { type: "string" } }, required: ["summary", "concern", "action", "followUp"] } } },
  }) });
  if (!analysisResponse.ok) return Response.json({ error: "AI analysis failed" }, { status: 502 });
  const response = await analysisResponse.json() as { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
  const outputText = response.output_text || response.output?.flatMap((item) => item.content || []).find((item) => item.type === "output_text")?.text || "";
  const note = noteSchema.parse(JSON.parse(outputText));
  await prisma.callLog.update({ where: { id }, data: { transcript, aiSummary: note.summary, aiConcern: note.concern, aiAction: note.action, aiFollowUp: note.followUp } });
  return Response.json({ ok: true, transcript, ...note });
}
