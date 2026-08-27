import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db";

export function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  return digits;
}

export function authorizeMobile(request: Request) {
  const expected = process.env.MOBILE_SYNC_API_KEY || "";
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!expected || expected.length !== supplied.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(supplied));
}

export async function findMemberByPhone(phone: string) {
  const normalized = normalizePhone(phone);
  const members = await prisma.member.findMany({ select: { id: true, phone: true }, take: 5000 });
  return members.find((member) => normalizePhone(member.phone) === normalized) || null;
}

export async function saveRecording(file: File, externalReference: string) {
  const safeExtension = path.extname(file.name).replace(/[^.a-zA-Z0-9]/g, "").slice(0, 8) || ".m4a";
  const fileName = `${createHash("sha256").update(externalReference).digest("hex")}${safeExtension}`;
  const directory = path.join(process.cwd(), "public", "uploads", "call-recordings");
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, fileName), Buffer.from(await file.arrayBuffer()));
  return { url: `/uploads/call-recordings/${fileName}`, fileName };
}
