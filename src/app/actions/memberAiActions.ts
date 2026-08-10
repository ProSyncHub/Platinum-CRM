"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { canAccessMember } from "@/lib/authorization";
import { prisma } from "@/lib/db";
import {
  buildMemberAiSource,
  generateMemberAiAnalysis,
} from "@/lib/memberAi";
import { syncMemberBackground } from "@/lib/memberBackground";

const PROCESSING_LOCK_MS = 3 * 60_000;
const FAILURE_RETRY_MS = 10 * 60_000;

function publicError(error: unknown) {
  const message = error instanceof Error ? error.message : "AI analysis failed.";
  return message.replace(/\s+/g, " ").slice(0, 350);
}

export async function refreshMemberAiBrief(memberId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!/^[a-f\d]{24}$/i.test(memberId)) {
    return { success: false, error: "Invalid member." };
  }
  if (!(await canAccessMember(session.user, memberId))) {
    return { success: false, error: "You do not have access to this member." };
  }

  try {
    // Keep the deterministic operational note current before it becomes AI input.
    await syncMemberBackground(memberId);

    const member = await prisma.member.findUnique({
      where: { id: memberId },
      include: {
        callLogs: { orderBy: { date: "desc" } },
        departmentUpdates: { orderBy: { createdAt: "desc" } },
        queryTransfers: { orderBy: { createdAt: "desc" } },
        aiAnalysis: true,
      },
    });
    if (!member) return { success: false, error: "Member not found." };

    const sourceBundle = buildMemberAiSource(member);
    const existing = member.aiAnalysis;
    if (
      existing?.status === "ready" &&
      existing.sourceHash === sourceBundle.sourceHash &&
      existing.analysisJson
    ) {
      return { success: true, cached: true };
    }

    const now = new Date();
    const processingCutoff = new Date(now.getTime() - PROCESSING_LOCK_MS);
    const failureCutoff = new Date(now.getTime() - FAILURE_RETRY_MS);

    if (
      existing?.sourceHash === sourceBundle.sourceHash &&
      existing.status === "processing" &&
      existing.refreshStartedAt &&
      existing.refreshStartedAt > processingCutoff
    ) {
      return { success: true, processing: true };
    }
    if (
      existing?.sourceHash === sourceBundle.sourceHash &&
      existing.status === "failed" &&
      existing.refreshStartedAt &&
      existing.refreshStartedAt > failureCutoff
    ) {
      return {
        success: false,
        error: existing.lastError || "AI brief refresh will retry automatically later.",
        retryLater: true,
      };
    }

    if (existing) {
      const lock = await prisma.memberAiAnalysis.updateMany({
        where: {
          id: existing.id,
          OR: [
            { status: { not: "processing" } },
            { refreshStartedAt: null },
            { refreshStartedAt: { lt: processingCutoff } },
          ],
        },
        data: {
          status: "processing",
          sourceHash: sourceBundle.sourceHash,
          sourceEventCount: sourceBundle.sourceEventCount,
          refreshStartedAt: now,
          lastError: null,
        },
      });
      if (lock.count === 0) return { success: true, processing: true };
    } else {
      try {
        await prisma.memberAiAnalysis.create({
          data: {
            memberId,
            status: "processing",
            sourceHash: sourceBundle.sourceHash,
            sourceEventCount: sourceBundle.sourceEventCount,
            refreshStartedAt: now,
          },
        });
      } catch (error) {
        if ((error as { code?: string }).code === "P2002") {
          return { success: true, processing: true };
        }
        throw error;
      }
    }

    try {
      const generated = await generateMemberAiAnalysis(sourceBundle.source);
      const analysis = generated.analysis;
      await prisma.memberAiAnalysis.update({
        where: { memberId },
        data: {
          status: "ready",
          executiveBrief: analysis.executiveBrief,
          currentStatus: analysis.currentStatus,
          escalationLevel: analysis.escalation.level,
          escalationSummary: analysis.escalation.summary,
          analysisJson: JSON.stringify(analysis),
          sourceHash: sourceBundle.sourceHash,
          sourceEventCount: sourceBundle.sourceEventCount,
          provider: generated.provider,
          model: generated.model,
          generatedAt: new Date(),
          generatedByName: session.user.name || "CRM automation",
          generatedByEmail: session.user.email || null,
          lastError: null,
        },
      });
    } catch (error) {
      const message = publicError(error);
      console.error("Member AI brief generation failed:", error);
      await prisma.memberAiAnalysis.update({
        where: { memberId },
        data: {
          status: "failed",
          lastError: message,
        },
      });
      return { success: false, error: message };
    }

    revalidatePath(`/workspace/${memberId}`);
    revalidatePath(`/members/${memberId}`);
    return { success: true, refreshed: true };
  } catch (error) {
    console.error("Unable to refresh member AI brief:", error);
    return { success: false, error: publicError(error) };
  }
}
