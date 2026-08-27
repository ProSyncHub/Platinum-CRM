import { z } from "zod";
import { prisma } from "@/lib/db";
import { authorizeMobile, findMemberByPhone, normalizePhone } from "@/lib/mobileCalls";

const schema = z.object({
  externalReference: z.string().min(1), channel: z.enum(["whatsapp", "email"]),
  phone: z.string().optional().default(""), email: z.string().email().optional(),
  direction: z.enum(["inbound", "outbound"]), staffName: z.string().default("Integration"),
  outcome: z.string().default("Message received"), notes: z.string().min(1), occurredAt: z.coerce.date().default(() => new Date()),
});

export async function POST(request: Request) {
  if (!authorizeMobile(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;
  const member = input.phone ? await findMemberByPhone(input.phone) : input.email ? await prisma.member.findFirst({ where: { email: { equals: input.email, mode: "insensitive" } } }) : null;
  if (!member) return Response.json({ error: "No matching CRM member" }, { status: 422 });
  const source = `${input.channel}_integration`;
  const existing = await prisma.callLog.findFirst({ where: { source, externalReference: input.externalReference } });
  if (existing) return Response.json({ ok: true, duplicate: true, callLogId: existing.id, memberId: existing.memberId });
  const log = await prisma.callLog.create({ data: {
    memberId: member.id, date: input.occurredAt, type: input.direction, medium: input.channel,
    outcome: input.outcome, notes: input.notes, staffName: input.staffName,
    source, externalReference: input.externalReference,
    phoneNumber: input.phone || null, normalizedPhone: input.phone ? normalizePhone(input.phone) : null,
  } });
  return Response.json({ ok: true, callLogId: log.id, memberId: member.id });
}
