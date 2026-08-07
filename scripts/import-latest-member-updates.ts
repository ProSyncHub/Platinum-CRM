import { readFile } from "node:fs/promises";
import { prisma } from "../src/lib/db";
import { generateMemberCode } from "../src/lib/membershipUtils";

const sourcePath = process.argv[2];
if (!sourcePath) throw new Error("Pass the pasted-text file path as the first argument.");

function normalize(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

function normalizePhone(value?: string | null) {
  return (value || "").replace(/\D/g, "").slice(-10);
}

function parseUpdateDate(value: string) {
  const normalized = value.trim();
  const numeric = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (numeric) {
    return new Date(Date.UTC(Number(numeric[3]), Number(numeric[1]) - 1, Number(numeric[2]), 12));
  }
  const parsed = new Date(`${normalized} 12:00:00 UTC`);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid update date: ${value}`);
  return parsed;
}

function outcomeFrom(notes: string) {
  const value = notes.toLowerCase();
  if (value.includes("busy")) return "Busy";
  if (value.includes("voicemail")) return "Voicemail / No Answer";
  if (/\bnc\b|not connected|no response|incoming not available/.test(value)) return "No Answer";
  return "Connected";
}

function healthFrom(notes: string) {
  return /quit|suspend|loss|not getting sale|no sales|complain|delay|trouble|await|not receive|no response|wants mayank|issue/.test(notes.toLowerCase())
    ? "warning"
    : "healthy";
}

async function importUpdates() {
  const cellsByRow = (await readFile(sourcePath, "utf8"))
    .split(/\r?\n/)
    .map((line) => line.split("\t").map((cell) => cell.trim()))
    .filter((cells) => cells.some(Boolean));

  const members = await prisma.member.findMany();
  const abdul = await prisma.user.findFirst({
    where: { name: { equals: "Abdul Barr", mode: "insensitive" } },
    select: { email: true, department: true },
  });

  const imported: Array<{ memberCode: string; fullName: string; outcome: string; date: Date }> = [];
  const unmatched: string[] = [];

  await prisma.callLog.deleteMany({});
  await prisma.queryTransfer.deleteMany({});
  await prisma.member.updateMany({
    data: {
      lastConnectDate: null,
      nextConnectDate: null,
      lastContactMedium: null,
      lastContactStaff: null,
      healthStatus: "healthy",
    },
  });

  for (const cells of cellsByRow) {
    const isPaymentVijay = normalize(cells[0]) === "vijay" && normalize(cells[1]).includes("@gmail.com");
    const firstName = cells[0] || "";
    const lastName = isPaymentVijay ? "" : cells[1] || "";
    const fullName = `${firstName} ${lastName}`.trim();
    const email = isPaymentVijay ? cells[1] : cells[3];
    const phone = isPaymentVijay ? cells[3] : cells[4];
    const notes = isPaymentVijay
      ? "Payment incomplete. Balance payment is pending."
      : (cells[10] || "Phone follow-up completed; no additional note provided.");
    const dateValue = cells[11];
    const date = parseUpdateDate(dateValue);
    const outcome = isPaymentVijay ? "Payment Follow-up" : outcomeFrom(notes);

    let member = members.find((candidate) =>
      (email && normalize(candidate.email) === normalize(email)) ||
      (phone && normalizePhone(candidate.phone) === normalizePhone(phone))
    );

    if (!member && !isPaymentVijay) {
      member = members.find((candidate) => normalize(candidate.fullName) === normalize(fullName));
    }

    if (!member && isPaymentVijay) {
      const sequence = await prisma.member.count({ where: { programType: "Platinum" } }) + 1;
      member = await prisma.member.create({
        data: {
          memberCode: generateMemberCode("Platinum", sequence, 2026),
          firstName: "Vijay",
          fullName: "Vijay",
          email,
          phone,
          programType: "Platinum",
          department: abdul?.department?.toLowerCase() || "operations",
          activeStatus: "Active",
          currentStage: "onboarding",
          currentMilestone: "Payment Completion",
          healthStatus: "warning",
          paymentStatus: "partial",
          paymentNotes: "Balance payment pending",
          notes: "Payment incomplete. Follow up for the remaining balance.",
        },
      });
      members.push(member);
    }

    if (!member) {
      unmatched.push(`${fullName} <${email}> ${phone}`);
      continue;
    }

    await prisma.callLog.create({
      data: {
        memberId: member.id,
        date,
        type: "outbound",
        medium: "phone",
        outcome,
        notes,
        staffName: "Abdul Barr",
        staffEmail: abdul?.email || undefined,
        staffDepartment: abdul?.department?.toLowerCase() || "support",
      },
    });

    await prisma.member.update({
      where: { id: member.id },
      data: {
        lastConnectDate: date,
        lastContactMedium: "phone",
        lastContactStaff: "Abdul Barr",
        healthStatus: isPaymentVijay ? "warning" : healthFrom(notes),
        ...(isPaymentVijay
          ? { paymentStatus: "partial", paymentNotes: "Balance payment pending" }
          : {}),
      },
    });

    imported.push({ memberCode: member.memberCode, fullName: member.fullName, outcome, date });
  }

  if (unmatched.length) throw new Error(`Unmatched rows after cleanup: ${unmatched.join("; ")}`);

  console.log(JSON.stringify({
    sourceRows: cellsByRow.length,
    importedUpdates: imported.length,
    newMembers: imported.filter((item) => item.fullName === "Vijay").length,
    staffName: "Abdul Barr",
    medium: "phone",
    paymentDueMember: "Vijay",
  }, null, 2));
}

importUpdates()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

