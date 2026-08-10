"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";
import { isElevatedViewer } from "@/lib/authorization";
import {
  createLeadRecord,
  generateLeadWebhookSecret,
  hashLeadSecret,
  slugifyLeadSource,
} from "@/lib/leads";

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;
const ADMIN_ROLES = new Set(["admin", "superadmin"]);
const LEAD_STATUSES = new Set(["new", "contacted", "qualified", "converted", "closed"]);

const importRowSchema = z.object({
  fullName: z.string().trim().min(1).max(180),
  firstName: z.string().trim().max(100).default(""),
  lastName: z.string().trim().max(100).default(""),
  phone: z.string().trim().max(40).default(""),
  email: z.string().trim().max(254).default(""),
  responseText: z.string().trim().max(500).default(""),
  responseCode: z.enum(["already_paid", "will_pay_shortly", "has_question", "other"]),
  campaign: z.string().trim().max(240).default(""),
  company: z.string().trim().max(180).default(""),
  location: z.string().trim().max(180).default(""),
  notes: z.string().trim().max(4_000).default(""),
  receivedAt: z.string().trim().max(100).default(""),
  externalId: z.string().trim().max(240).default(""),
  rawData: z.record(z.string().max(200), z.string().max(2_000)),
});

function isAdmin(role?: string | null) {
  return ADMIN_ROLES.has(role?.trim().toLowerCase() || "");
}

function refreshLeadViews() {
  revalidatePath("/leads");
  revalidatePath("/dashboard");
}

export async function createLeadSource(input: {
  name: string;
  slug?: string;
  description?: string;
  sourceType?: string;
  defaultCampaign?: string;
  defaultDepartment?: string;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.role)) {
    return { success: false as const, error: "Only administrators can configure lead sources." };
  }

  const name = input.name?.trim().slice(0, 120);
  const slug = slugifyLeadSource(input.slug || name);
  if (!name || !slug) return { success: false as const, error: "Enter a source name." };

  const exists = await prisma.leadSource.findFirst({
    where: { OR: [{ name: { equals: name, mode: "insensitive" } }, { slug }] },
    select: { id: true },
  });
  if (exists) return { success: false as const, error: "A lead source with this name or slug exists." };

  const webhookSecret = generateLeadWebhookSecret();
  const source = await prisma.leadSource.create({
    data: {
      name,
      slug,
      sourceType: input.sourceType?.trim().slice(0, 40) || "api",
      description: input.description?.trim().slice(0, 500) || null,
      webhookEnabled: true,
      webhookSecretHash: hashLeadSecret(webhookSecret),
      webhookSecretHint: webhookSecret.slice(-6),
      defaultCampaign: input.defaultCampaign?.trim().slice(0, 240) || null,
      defaultDepartment: input.defaultDepartment?.trim().toLowerCase().slice(0, 100) || "sales",
      createdByUser: session.user.id || null,
      createdByName: session.user.name || "Administrator",
      createdByEmail: session.user.email || "",
    },
    select: { id: true, name: true, slug: true },
  });

  refreshLeadViews();
  return { success: true as const, source, webhookSecret };
}

export async function regenerateLeadSourceSecret(sourceId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.role)) {
    return { success: false as const, error: "Only administrators can rotate webhook secrets." };
  }
  if (!OBJECT_ID_PATTERN.test(sourceId)) {
    return { success: false as const, error: "Invalid lead source." };
  }

  const webhookSecret = generateLeadWebhookSecret();
  const source = await prisma.leadSource.update({
    where: { id: sourceId },
    data: {
      webhookEnabled: true,
      webhookSecretHash: hashLeadSecret(webhookSecret),
      webhookSecretHint: webhookSecret.slice(-6),
    },
    select: { id: true, name: true, slug: true },
  });
  refreshLeadViews();
  return { success: true as const, source, webhookSecret };
}

export async function setLeadSourceActive(sourceId: string, active: boolean) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.role)) {
    return { success: false as const, error: "Only administrators can change lead sources." };
  }
  if (!OBJECT_ID_PATTERN.test(sourceId)) {
    return { success: false as const, error: "Invalid lead source." };
  }
  await prisma.leadSource.update({ where: { id: sourceId }, data: { active } });
  refreshLeadViews();
  return { success: true as const };
}

export async function createLeadImportBatch(input: {
  sourceId: string;
  fileName: string;
  mapping: Record<string, string>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { success: false as const, error: "Unauthorized" };
  if (!OBJECT_ID_PATTERN.test(input.sourceId)) {
    return { success: false as const, error: "Choose a valid lead source." };
  }
  const source = await prisma.leadSource.findFirst({
    where: { id: input.sourceId, active: true },
    select: { id: true },
  });
  if (!source) return { success: false as const, error: "This lead source is not active." };

  const batch = await prisma.leadImportBatch.create({
    data: {
      sourceId: source.id,
      fileName: input.fileName.trim().slice(0, 255) || "Lead import",
      mappingJson: JSON.stringify(input.mapping).slice(0, 20_000),
      createdByUser: session.user.id || null,
      createdByName: session.user.name || "Staff Member",
      createdByEmail: session.user.email || "",
    },
    select: { id: true },
  });
  return { success: true as const, batchId: batch.id };
}

export async function importLeadRows(input: {
  batchId: string;
  rows: unknown[];
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { success: false as const, error: "Unauthorized" };
  if (!OBJECT_ID_PATTERN.test(input.batchId) || input.rows.length > 200) {
    return { success: false as const, error: "Invalid import batch or chunk size." };
  }

  const parsedRows = z.array(importRowSchema).max(200).safeParse(input.rows);
  if (!parsedRows.success) {
    return { success: false as const, error: "Some imported rows contain invalid or oversized data." };
  }

  const batch = await prisma.leadImportBatch.findUnique({
    where: { id: input.batchId },
    select: {
      id: true,
      sourceId: true,
      status: true,
      createdByUser: true,
      source: { select: { active: true, defaultCampaign: true } },
    },
  });
  if (!batch || batch.status !== "processing" || !batch.source.active) {
    return { success: false as const, error: "This import batch is no longer available." };
  }
  if (
    !isElevatedViewer(session.user) &&
    batch.createdByUser &&
    batch.createdByUser !== session.user.id
  ) {
    return { success: false as const, error: "You cannot update another employee's import." };
  }

  let imported = 0;
  let skipped = 0;
  let failed = 0;
  for (let offset = 0; offset < parsedRows.data.length; offset += 20) {
    const group = parsedRows.data.slice(offset, offset + 20);
    const results = await Promise.allSettled(
      group.map((row) =>
        createLeadRecord({
          sourceId: batch.sourceId,
          input: row,
          importBatchId: batch.id,
          defaultCampaign: batch.source.defaultCampaign,
        }),
      ),
    );
    for (const result of results) {
      if (result.status === "rejected") failed += 1;
      else if (result.value.created) imported += 1;
      else skipped += 1;
    }
  }

  await prisma.leadImportBatch.update({
    where: { id: batch.id },
    data: {
      imported: { increment: imported },
      skipped: { increment: skipped },
      failed: { increment: failed },
    },
  });
  return { success: true as const, imported, skipped, failed };
}

export async function completeLeadImport(batchId: string, totalRows: number) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { success: false as const, error: "Unauthorized" };
  if (!OBJECT_ID_PATTERN.test(batchId)) {
    return { success: false as const, error: "Invalid import batch." };
  }
  const batch = await prisma.leadImportBatch.findUnique({
    where: { id: batchId },
    select: { createdByUser: true, status: true },
  });
  if (!batch || batch.status !== "processing") {
    return { success: false as const, error: "Import batch is already closed." };
  }
  if (
    !isElevatedViewer(session.user) &&
    batch.createdByUser &&
    batch.createdByUser !== session.user.id
  ) {
    return { success: false as const, error: "You cannot complete another employee's import." };
  }

  await prisma.leadImportBatch.update({
    where: { id: batchId },
    data: {
      status: "completed",
      totalRows: Math.max(0, Math.min(Math.trunc(totalRows), 100_000)),
      completedAt: new Date(),
    },
  });
  refreshLeadViews();
  return { success: true as const };
}

export async function updateLeadStatus(leadId: string, status: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { success: false as const, error: "Unauthorized" };
  if (!OBJECT_ID_PATTERN.test(leadId) || !LEAD_STATUSES.has(status)) {
    return { success: false as const, error: "Invalid lead status." };
  }
  await prisma.lead.update({ where: { id: leadId }, data: { status } });
  refreshLeadViews();
  return { success: true as const };
}
