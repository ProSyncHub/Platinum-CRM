import { prisma } from "@/lib/db";
import { authorizeMobile, findMemberByPhone } from "@/lib/mobileCalls";

export async function POST(request: Request) {
  if (!authorizeMobile(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const pending = await prisma.unmatchedMobileCall.findMany({ where: { status: "pending" }, orderBy: { startedAt: "asc" }, take: 500 });
  let linked = 0;
  for (const item of pending) {
    const member = await findMemberByPhone(item.phoneNumber);
    if (!member) continue;
    const type = item.direction.toUpperCase() === "INCOMING" ? "inbound" : "outbound";
    const log = await prisma.callLog.create({ data: {
      memberId: member.id, date: item.startedAt, type, medium: "phone",
      outcome: item.durationSeconds > 0 ? "Connected" : "No Answer", duration: Math.ceil(item.durationSeconds / 60),
      durationSeconds: item.durationSeconds, notes: `${item.employeeName} ${type === "inbound" ? "received" : "made"} a ${item.durationSeconds}-second call.`,
      staffName: item.employeeName, staffEmail: item.employeeEmail, source: "android_companion",
      externalReference: item.externalReference, phoneNumber: item.phoneNumber, normalizedPhone: item.normalizedPhone,
      deviceId: item.deviceId, deviceLabel: item.deviceLabel, simAccount: item.simAccount,
      recordingUrl: item.recordingUrl, recordingFileName: item.recordingFileName,
      recordingMimeType: item.recordingMimeType, recordingStatus: item.recordingStatus,
    } });
    await prisma.unmatchedMobileCall.update({ where: { id: item.id }, data: { status: "linked", linkedMemberId: member.id, linkedCallLogId: log.id } });
    linked += 1;
  }
  return Response.json({ ok: true, checked: pending.length, linked });
}
