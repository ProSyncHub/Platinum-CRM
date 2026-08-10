import { createHash, timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { generateMemberCode } from "@/lib/membershipUtils";
import { syncMemberBackground } from "@/lib/memberBackground";
import {
  classifyPabblyRegistration,
  type ImportedProgram,
} from "@/lib/pabblyRegistration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 100_000;
const PROCESSING_TIMEOUT_MS = 5 * 60_000;
const SOURCE = "pabbly";

const normalizedPayloadSchema = z.object({
  eventId: z.string().trim().min(3).max(200),
  fullName: z.string().trim().min(2).max(160),
  email: z.string().trim().toLowerCase().email().max(254),
  phone: z.string().trim().max(40).optional().default(""),
  state: z.string().trim().max(100).optional().default(""),
  amount: z.number().positive(),
  currency: z.string().trim().toUpperCase().default("INR"),
  amountUnit: z.enum(["rupees", "paise"]).default("rupees"),
  paymentLabel: z.string().trim().max(200).optional().default(""),
  paidAt: z.coerce.date().optional(),
});

type JsonRecord = Record<string, unknown>;

class WebhookError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function collectPayloadValues(
  value: unknown,
  values = new Map<string, unknown>(),
  depth = 0,
) {
  if (depth > 5 || !isRecord(value)) return values;
  for (const [key, entry] of Object.entries(value)) {
    const normalized = normalizeKey(key);
    if (!values.has(normalized) && entry !== null && entry !== "") {
      values.set(normalized, entry);
    }
    if (isRecord(entry)) collectPayloadValues(entry, values, depth + 1);
  }
  return values;
}

function firstValue(values: Map<string, unknown>, aliases: string[]) {
  for (const alias of aliases) {
    const value = values.get(normalizeKey(alias));
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function asString(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  return "";
}

function parseMoney(value: unknown) {
  if (typeof value === "number") return value;
  const normalized = asString(value).replace(/,/g, "").replace(/[^0-9.-]/g, "");
  return Number(normalized);
}

function normalizeIncomingPayload(payload: unknown) {
  const values = collectPayloadValues(payload);
  const firstName = asString(firstValue(values, ["first_name", "firstname"]));
  const lastName = asString(firstValue(values, ["last_name", "lastname"]));
  const fullName =
    asString(firstValue(values, ["full_name", "fullname", "customer_name", "name"])) ||
    `${firstName} ${lastName}`.trim();
  const amountUnitRaw = asString(
    firstValue(values, ["amount_unit", "amountunit", "unit"]),
  ).toLowerCase();
  const amountUnit = amountUnitRaw === "paise" ? "paise" : "rupees";
  const rawAmount = parseMoney(
    firstValue(values, ["amount", "amount_paid", "amountpaid", "payment_amount"]),
  );

  return normalizedPayloadSchema.parse({
    eventId: asString(
      firstValue(values, [
        "event_id",
        "eventid",
        "payment_id",
        "paymentid",
        "transaction_id",
        "transactionid",
        "order_id",
        "orderid",
      ]),
    ),
    fullName,
    email: asString(firstValue(values, ["email", "customer_email", "customeremail"])),
    phone: asString(
      firstValue(values, ["phone", "mobile", "contact", "customer_phone", "customerphone"]),
    ),
    state: asString(firstValue(values, ["state", "location", "customer_state"])),
    amount: amountUnit === "paise" ? rawAmount / 100 : rawAmount,
    amountUnit,
    currency: asString(firstValue(values, ["currency", "currency_code"])) || "INR",
    paymentLabel: asString(
      firstValue(values, [
        "payment_for",
        "paymentfor",
        "product_name",
        "productname",
        "product",
        "plan_name",
        "planname",
        "description",
      ]),
    ),
    paidAt: firstValue(values, ["paid_at", "paidat", "payment_date", "created_at"]),
  });
}

function safeSecretEqual(received: string, expected: string) {
  const receivedHash = createHash("sha256").update(received).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(receivedHash, expectedHash);
}

function suppliedSecret(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || "";
  return request.headers.get("x-pabbly-secret")?.trim() || bearer;
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" ") || null,
  };
}

async function allocateMemberCode(programType: string) {
  const year = new Date().getFullYear();
  const count = await prisma.member.count({
    where: { programType: { equals: programType, mode: "insensitive" } },
  });

  for (let offset = 1; offset <= 100; offset += 1) {
    const memberCode = generateMemberCode(programType, count + offset, year);
    const exists = await prisma.member.findUnique({
      where: { memberCode },
      select: { id: true },
    });
    if (!exists) return memberCode;
  }
  return generateMemberCode(programType, Date.now() % 100_000, year);
}

async function ensureProgram(programType: ImportedProgram) {
  const codePrefix =
    programType === "Webinar" ? "WEB" : programType === "PNP" ? "PNP" : "OTH";
  const existing = await prisma.program.findFirst({
    where: {
      OR: [
        { name: { equals: programType, mode: "insensitive" } },
        { codePrefix },
      ],
    },
    select: { id: true },
  });
  if (existing) return;

  try {
    await prisma.program.create({
      data: {
        name: programType,
        codePrefix,
        description:
          programType === "Webinar"
            ? "Paid webinar registrations imported through Pabbly"
            : programType === "PNP"
              ? "PNP membership registrations imported through Pabbly"
              : "Other paid registrations awaiting administrator classification",
        icon:
          programType === "Webinar" ? "Video" : programType === "PNP" ? "Users" : "Receipt",
        color:
          programType === "Webinar"
            ? "#2563eb"
            : programType === "PNP"
              ? "#7c3aed"
              : "#475569",
        badgeColor:
          programType === "Webinar" ? "blue" : programType === "PNP" ? "purple" : "slate",
        active: true,
      },
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
      throw error;
    }
  }
}

async function findExistingMember(email: string, phone: string) {
  const matches = await prisma.member.findMany({
    where: {
      OR: [
        { email: { equals: email, mode: "insensitive" } },
        ...(phone ? [{ phone }] : []),
      ],
    },
    select: {
      id: true,
      memberCode: true,
      programType: true,
      paymentNotes: true,
    },
    take: 3,
  });
  const uniqueMatches = Array.from(new Map(matches.map((member) => [member.id, member])).values());
  if (uniqueMatches.length > 1) {
    throw new WebhookError(
      "The supplied email and phone match different CRM members. Resolve the duplicate records before retrying.",
      409,
    );
  }
  return uniqueMatches[0] || null;
}

async function createOrUpdateMember(
  input: z.infer<typeof normalizedPayloadSchema>,
  programType: ImportedProgram,
) {
  const existing = await findExistingMember(input.email, input.phone);
  const paymentLabel = input.paymentLabel ? ` for ${input.paymentLabel}` : "";
  const paymentNote = `INR ${input.amount.toLocaleString("en-IN")} ${programType} payment${paymentLabel} imported through Pabbly (${input.eventId}).`;
  const registrationDate = input.paidAt || new Date();

  if (existing) {
    const programUpgrade = programType === "PNP" ? "PNP" : existing.programType;
    const member = await prisma.member.update({
      where: { id: existing.id },
      data: {
        programType: programUpgrade,
        requestedProgram: programUpgrade,
        paymentStatus: "paid",
        paymentNotes: [existing.paymentNotes, paymentNote].filter(Boolean).join("\n"),
        ...(programType === "Others"
          ? {}
          : {
              activeStatus: "Active",
              approvalStatus: "approved",
            }),
        ...(programType === "PNP" ? { enrollingDate: registrationDate } : {}),
      },
      select: { id: true, memberCode: true },
    });
    return { member, created: false };
  }

  const { firstName, lastName } = splitName(input.fullName);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const memberCode = await allocateMemberCode(programType);
    try {
      const member = await prisma.member.create({
        data: {
          memberCode,
          firstName,
          lastName,
          fullName: input.fullName,
          phone: input.phone || "Not provided",
          email: input.email,
          state: input.state || null,
          programType,
          requestedProgram: programType,
          requestedProgramOther:
            programType === "Others"
              ? input.paymentLabel ||
                `Unclassified INR ${input.amount.toLocaleString("en-IN")} payment`
              : null,
          department: "operations",
          enrollingDate: registrationDate,
          plan:
            programType === "PNP"
              ? "6 Months"
              : programType === "Webinar"
                ? "Webinar Registration"
                : "Other Payment - Awaiting Classification",
          activeStatus: programType === "Others" ? "Pending Approval" : "Active",
          healthStatus: programType === "Others" ? "needs_attention" : "healthy",
          paymentStatus: "paid",
          paymentNotes: paymentNote,
          approvalStatus: programType === "Others" ? "pending" : "approved",
          submittedByName: "Pabbly Automation",
          submittedByEmail: "webhook@prosyncedu.com",
          submittedByDepartment: "operations",
          submittedAt: registrationDate,
        },
        select: { id: true, memberCode: true },
      });
      return { member, created: true };
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== "P2002" ||
        attempt === 4
      ) {
        throw error;
      }
    }
  }
  throw new Error("Could not allocate a unique member code.");
}

async function recordImportedActivity(
  memberId: string,
  input: z.infer<typeof normalizedPayloadSchema>,
  programType: ImportedProgram,
) {
  const alreadyRecorded = await prisma.callLog.findFirst({
    where: {
      memberId,
      medium: "internal",
      notes: { contains: input.eventId },
    },
    select: { id: true },
  });

  const at = input.paidAt || new Date();
  if (!alreadyRecorded) {
    await prisma.callLog.create({
      data: {
        memberId,
        date: at,
        type: "inbound",
        medium: "internal",
        outcome: `${programType} registration imported`,
        notes: `Verified INR ${input.amount.toLocaleString("en-IN")} payment received through Pabbly. Event: ${input.eventId}.`,
        staffName: "Pabbly Automation",
        staffEmail: "webhook@prosyncedu.com",
        staffDepartment: "operations",
      },
    });
  }

  const departmentUpdateExists = await prisma.departmentUpdate.findFirst({
    where: {
      memberId,
      department: "operations",
      category: "registration",
      details: { contains: input.eventId },
    },
    select: { id: true },
  });
  if (!departmentUpdateExists) {
    await prisma.departmentUpdate.create({
      data: {
        memberId,
        department: "operations",
        category: "registration",
        status:
          programType === "Webinar"
            ? "completed"
            : programType === "PNP"
              ? "not_started"
              : "waiting",
        summary:
          programType === "Webinar"
            ? "Webinar registration and payment received"
            : programType === "PNP"
              ? "PNP payment received; onboarding pending"
              : `Other payment received${input.paymentLabel ? ` for ${input.paymentLabel}` : ""}; classification pending`,
        details: `Verified Pabbly payment event: ${input.eventId}. Amount: INR ${input.amount.toLocaleString("en-IN")}.`,
        nextStep:
          programType === "Webinar"
            ? "Send webinar access details"
            : programType === "PNP"
              ? "Assign onboarding owner and complete the welcome call"
              : "Administrator must review the payment and assign the correct program or service",
        updatedByName: "Pabbly Automation",
        updatedByEmail: "webhook@prosyncedu.com",
      },
    });
  }
}

export async function POST(request: NextRequest) {
  const configuredSecret = process.env.PABBLY_WEBHOOK_SECRET?.trim() || "";
  if (!configuredSecret) {
    return NextResponse.json(
      { success: false, message: "Pabbly webhook is not configured." },
      { status: 503 },
    );
  }
  const receivedSecret = suppliedSecret(request);
  if (!receivedSecret || !safeSecretEqual(receivedSecret, configuredSecret)) {
    return NextResponse.json(
      { success: false, message: "Invalid webhook credentials." },
      { status: 401 },
    );
  }

  let receiptId: string | null = null;
  try {
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
      throw new WebhookError("Webhook body is too large.", 413);
    }
    const payload = JSON.parse(rawBody) as unknown;
    const input = normalizeIncomingPayload(payload);
    if (input.currency !== "INR") {
      throw new WebhookError("Only INR registrations are supported.", 422);
    }
    const programType = classifyPabblyRegistration(input.amount);
    const receiptKey = { source_eventId: { source: SOURCE, eventId: input.eventId } };
    const existingReceipt = await prisma.externalRegistration.findUnique({
      where: receiptKey,
    });

    if (existingReceipt?.status === "processed") {
      return NextResponse.json({
        success: true,
        duplicate: true,
        programType: existingReceipt.programType,
        memberId: existingReceipt.memberId,
        message: "This payment event was already processed.",
      });
    }
    if (
      existingReceipt?.status === "processing" &&
      existingReceipt.updatedAt.getTime() > Date.now() - PROCESSING_TIMEOUT_MS
    ) {
      return NextResponse.json(
        { success: true, processing: true, message: "This payment event is already processing." },
        { status: 202 },
      );
    }

    if (existingReceipt) {
      const receipt = await prisma.externalRegistration.update({
        where: { id: existingReceipt.id },
        data: {
          amount: input.amount,
          currency: input.currency,
          programType,
          paymentLabel: input.paymentLabel || null,
          email: input.email,
          phone: input.phone || null,
          status: "processing",
          errorMessage: null,
        },
      });
      receiptId = receipt.id;
    } else {
      try {
        const receipt = await prisma.externalRegistration.create({
          data: {
            source: SOURCE,
            eventId: input.eventId,
            amount: input.amount,
            currency: input.currency,
            programType,
            paymentLabel: input.paymentLabel || null,
            email: input.email,
            phone: input.phone || null,
          },
        });
        receiptId = receipt.id;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          return NextResponse.json(
            { success: true, processing: true, message: "This payment event is already processing." },
            { status: 202 },
          );
        }
        throw error;
      }
    }

    await ensureProgram(programType);
    const result = await createOrUpdateMember(input, programType);
    await recordImportedActivity(result.member.id, input, programType);
    await syncMemberBackground(result.member.id);
    if (!receiptId) {
      throw new Error("The webhook receipt could not be created.");
    }
    await prisma.externalRegistration.update({
      where: { id: receiptId },
      data: {
        memberId: result.member.id,
        status: "processed",
        processedAt: new Date(),
        errorMessage: null,
      },
    });
    revalidatePath("/workspace");
    revalidatePath("/members");
    revalidatePath("/dashboard");

    return NextResponse.json(
      {
        success: true,
        created: result.created,
        programType,
        memberId: result.member.id,
        memberCode: result.member.memberCode,
        message: result.created
          ? programType === "Others"
            ? "Other payment captured and queued for administrator classification."
            : `${programType} member created successfully.`
          : `${programType} registration added to the existing member.`,
      },
      { status: result.created ? 201 : 200 },
    );
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues.map((issue) => issue.message).join("; ")
        : error instanceof Error
          ? error.message
          : "Unexpected webhook error.";
    if (receiptId) {
      await prisma.externalRegistration
        .update({
          where: { id: receiptId },
          data: { status: "failed", errorMessage: message.slice(0, 500) },
        })
        .catch(() => undefined);
    }
    console.error("Pabbly member registration webhook failed:", message);
    const status =
      error instanceof WebhookError
        ? error.status
        : error instanceof z.ZodError || error instanceof SyntaxError
          ? 400
          : 500;
    return NextResponse.json(
      {
        success: false,
        message: status >= 500 ? "The registration could not be processed." : message,
      },
      { status },
    );
  }
}
