import { z } from "zod";
import { prisma } from "@/lib/db";
import { authorizeMobile, findMemberByPhone, normalizePhone, saveRecording } from "@/lib/mobileCalls";

export const runtime = "nodejs";

const payloadSchema = z.object({
  externalReference: z.string().min(1).max(200),
  phone: z.string().max(40).default(""),
  employee: z.string().min(1).max(120),
  employeeEmail: z.string().email().optional().or(z.literal("")),
  deviceId: z.string().max(120),
  deviceLabel: z.string().max(160),
  direction: z.string().max(40),
  startedAt: z.coerce.number().int().positive(),
  durationSeconds: z.coerce.number().int().nonnegative(),
  simAccount: z.string().max(200).optional().nullable(),
  recordingStatus: z.string().max(40).default("unavailable"),
});

export async function POST(request: Request) {
  if (!authorizeMobile(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const contentType = request.headers.get("content-type") || "";
  const form = contentType.includes("multipart/form-data") ? await request.formData() : null;
  const raw = form ? JSON.parse(String(form.get("payload") || "{}")) : await request.json();
  const parsed = payloadSchema.safeParse(raw);
  if (!parsed.success) return Response.json({ error: "Invalid call payload", details: parsed.error.flatten() }, { status: 400 });

  const data = parsed.data;
  const existing = await prisma.callLog.findFirst({ where: { source: "android_companion", externalReference: data.externalReference } });
  const recording = form?.get("recording");
  const stored = recording instanceof File && recording.size > 0 ? await saveRecording(recording, data.externalReference) : null;
  if (existing) {
    const updated = stored ? await prisma.callLog.update({ where: { id: existing.id }, data: {
      recordingUrl: stored.url, recordingFileName: stored.fileName,
      recordingMimeType: recording instanceof File ? recording.type : null, recordingStatus: "available",
    } }) : existing;
    return Response.json({ ok: true, duplicate: true, callLogId: updated.id, memberId: updated.memberId });
  }

  const member = await findMemberByPhone(data.phone);
  if (!member) {
    const unmatched = await prisma.unmatchedMobileCall.upsert({ where: { externalReference: data.externalReference }, update: {
      recordingUrl: stored?.url, recordingFileName: stored?.fileName,
      recordingMimeType: recording instanceof File ? recording.type : undefined,
      recordingStatus: stored ? "available" : data.recordingStatus,
    }, create: {
      externalReference: data.externalReference, phoneNumber: data.phone, normalizedPhone: normalizePhone(data.phone),
      direction: data.direction, startedAt: new Date(data.startedAt), durationSeconds: data.durationSeconds,
      employeeName: data.employee, employeeEmail: data.employeeEmail || null, deviceId: data.deviceId,
      deviceLabel: data.deviceLabel, simAccount: data.simAccount || null, recordingUrl: stored?.url || null,
      recordingFileName: stored?.fileName || null, recordingMimeType: recording instanceof File ? recording.type : null,
      recordingStatus: stored ? "available" : data.recordingStatus,
    } });
    return Response.json({ ok: true, unmatched: true, unmatchedCallId: unmatched.id, normalizedPhone: unmatched.normalizedPhone }, { status: 202 });
  }
  const user = data.employeeEmail ? await prisma.user.findUnique({ where: { email: data.employeeEmail } }) : await prisma.user.findFirst({ where: { name: { equals: data.employee, mode: "insensitive" } } });
  const type = data.direction.toUpperCase() === "INCOMING" ? "inbound" : "outbound";
  const connected = data.durationSeconds > 0;
  const callLog = await prisma.callLog.create({ data: {
    memberId: member.id, date: new Date(data.startedAt), type, medium: "phone",
    outcome: connected ? "Connected" : data.direction.toUpperCase() === "MISSED" ? "No Answer" : "Not Connected",
    duration: Math.ceil(data.durationSeconds / 60), durationSeconds: data.durationSeconds,
    notes: `${data.employee} ${type === "inbound" ? "received" : "made"} a ${data.durationSeconds}-second call.`,
    staffName: data.employee, staffEmail: data.employeeEmail || user?.email || null,
    staffDepartment: user?.department || null, staffUserId: user?.id || null,
    source: "android_companion", externalReference: data.externalReference,
    phoneNumber: data.phone, normalizedPhone: normalizePhone(data.phone), deviceId: data.deviceId,
    deviceLabel: data.deviceLabel, simAccount: data.simAccount || null,
    recordingUrl: stored?.url || null, recordingFileName: stored?.fileName || null,
    recordingMimeType: recording instanceof File ? recording.type : null,
    recordingStatus: stored ? "available" : data.recordingStatus,
  } });
  await prisma.member.update({ where: { id: member.id }, data: { lastConnectDate: new Date(data.startedAt), lastContactMedium: "phone", lastContactStaff: data.employee } });
  return Response.json({ ok: true, callLogId: callLog.id, memberId: member.id }, { status: 201 });
}
