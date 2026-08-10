"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bot,
  Building2,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { refreshMemberAiBrief } from "@/app/actions/memberAiActions";

interface AnalysisPayload {
  executiveBrief: string;
  currentStatus: string;
  departmentBriefs: Array<{
    department: string;
    latestConversation: string;
    progress: string;
    risks: string[];
    nextAction: string;
  }>;
  monthlyTimeline: Array<{
    month: string;
    status: string;
    summary: string;
    keyEvents: string[];
    departments: string[];
    escalations: string[];
  }>;
  escalation: {
    level: "none" | "watch" | "high" | "critical";
    summary: string;
    unresolvedIssues: string[];
    recommendedOwner: string;
    recommendedAction: string;
  };
  nextActions: Array<{
    action: string;
    ownerDepartment: string;
    priority: "low" | "medium" | "high" | "urgent";
  }>;
}

interface StoredAnalysis {
  status: string;
  analysisJson?: string | null;
  sourceEventCount: number;
  provider?: string | null;
  model?: string | null;
  lastError?: string | null;
  generatedAt?: string | null;
}

interface MemberAiBriefProps {
  memberId: string;
  analysis?: StoredAnalysis | null;
  needsRefresh: boolean;
  sourceVersion: string;
}

const ESCALATION_STYLES = {
  none: "border-emerald-200 bg-emerald-50 text-emerald-800",
  watch: "border-amber-200 bg-amber-50 text-amber-900",
  high: "border-orange-200 bg-orange-50 text-orange-900",
  critical: "border-red-200 bg-red-50 text-red-900",
};

function titleCase(value?: string | null) {
  return (value || "Not set")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatMonth(value: string) {
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return value;
  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

function formatGeneratedAt(value?: string | null) {
  if (!value) return "Not generated yet";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function parseAnalysis(value?: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value) as AnalysisPayload;
  } catch {
    return null;
  }
}

export default function MemberAiBrief({
  memberId,
  analysis,
  needsRefresh,
  sourceVersion,
}: MemberAiBriefProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(
    analysis?.status === "failed" ? analysis.lastError || "AI brief generation failed." : null,
  );
  const parsed = parseAnalysis(analysis?.analysisJson);

  useEffect(() => {
    if (!needsRefresh) return;
    let cancelled = false;

    startTransition(async () => {
      const result = await refreshMemberAiBrief(memberId);
      if (cancelled) return;
      if (!result.success) {
        setError(result.error || "The automatic AI brief could not be refreshed.");
        return;
      }
      setError(null);
      if (result.processing) {
        window.setTimeout(() => router.refresh(), 4_000);
        return;
      }
      router.refresh();
    });

    return () => {
      cancelled = true;
    };
  }, [memberId, needsRefresh, router, sourceVersion]);

  function retry() {
    setError(null);
    startTransition(async () => {
      const result = await refreshMemberAiBrief(memberId);
      if (!result.success) {
        setError(result.error || "The AI brief could not be refreshed.");
        return;
      }
      router.refresh();
    });
  }

  const updating =
    !error && (isPending || needsRefresh || analysis?.status === "processing");
  const escalationLevel = parsed?.escalation.level || "none";
  const escalationStyle =
    ESCALATION_STYLES[escalationLevel as keyof typeof ESCALATION_STYLES] ||
    ESCALATION_STYLES.watch;

  return (
    <section className="overflow-hidden rounded-3xl border border-indigo-200 bg-white shadow-sm">
      <div className="border-b border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-violet-50 p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-950">AI member brief</h2>
              <p className="mt-1 text-sm leading-5 text-slate-600">
                A short, automatically maintained overview of the complete customer journey.
              </p>
            </div>
          </div>
          {updating ? (
            <span className="inline-flex items-center gap-2 self-start rounded-full bg-indigo-100 px-3 py-1.5 text-xs font-bold text-indigo-800">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Updating brief
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 self-start rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-800">
              <CheckCircle2 className="h-3.5 w-3.5" /> Current
            </span>
          )}
        </div>
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        {error && !parsed ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-bold">Automatic brief is temporarily unavailable</p>
                <p className="mt-1 leading-5">{error}</p>
                <button
                  type="button"
                  onClick={retry}
                  disabled={isPending}
                  className="mt-3 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-bold hover:bg-amber-100 disabled:opacity-50"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        ) : !parsed ? (
          <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
        ) : (
          <>
            {error ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
                Showing the last saved brief while refresh waits: {error}
              </div>
            ) : null}

            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-indigo-700">
                <Bot className="h-4 w-4" /> Executive brief
              </div>
              <p className="mt-3 text-sm leading-7 text-slate-700">{parsed.executiveBrief}</p>
              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Current status</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-800">{parsed.currentStatus}</p>
              </div>
            </article>

            <details className="group rounded-2xl border border-slate-200 bg-white">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-bold text-slate-800 hover:bg-slate-50">
                Open detailed analysis and escalation
                <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
              </summary>
              <div className="space-y-6 border-t border-slate-200 p-4 sm:p-5">
                <article className={`rounded-2xl border p-5 ${escalationStyle}`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-bold uppercase tracking-wide">Escalation context</p>
                    <span className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-bold">
                      {titleCase(parsed.escalation.level)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-semibold leading-6">{parsed.escalation.summary}</p>
                  {parsed.escalation.unresolvedIssues.length > 0 ? (
                    <ul className="mt-3 space-y-1.5 text-xs leading-5">
                      {parsed.escalation.unresolvedIssues.map((issue) => (
                        <li key={issue}>• {issue}</li>
                      ))}
                    </ul>
                  ) : null}
                  <p className="mt-4 text-xs font-bold">
                    Owner: {titleCase(parsed.escalation.recommendedOwner)}
                  </p>
                  <p className="mt-1 text-xs leading-5">{parsed.escalation.recommendedAction}</p>
                </article>

                {parsed.departmentBriefs.length > 0 ? (
                  <div>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-indigo-600" />
                      <h3 className="font-bold text-slate-950">Department analysis</h3>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {parsed.departmentBriefs.map((department) => (
                        <article key={department.department} className="rounded-2xl border border-slate-200 p-4">
                          <p className="font-bold text-slate-950">{titleCase(department.department)}</p>
                          <p className="mt-2 text-xs font-semibold text-slate-400">Latest conversation</p>
                          <p className="mt-1 text-sm leading-5 text-slate-700">{department.latestConversation}</p>
                          <p className="mt-3 text-xs font-semibold text-slate-400">Progress</p>
                          <p className="mt-1 text-sm leading-5 text-slate-700">{department.progress}</p>
                          {department.risks.length > 0 ? (
                            <p className="mt-3 text-xs leading-5 text-amber-800">
                              Risk: {department.risks.join("; ")}
                            </p>
                          ) : null}
                          <p className="mt-3 rounded-lg bg-indigo-50 px-3 py-2 text-xs font-semibold leading-5 text-indigo-900">
                            Next: {department.nextAction}
                          </p>
                        </article>
                      ))}
                    </div>
                  </div>
                ) : null}

                {parsed.monthlyTimeline.length > 0 ? (
                  <div>
                    <div className="flex items-center gap-2">
                      <CalendarRange className="h-4 w-4 text-indigo-600" />
                      <h3 className="font-bold text-slate-950">Month-by-month status</h3>
                    </div>
                    <div className="mt-3 space-y-3">
                      {parsed.monthlyTimeline
                        .toSorted((left, right) => right.month.localeCompare(left.month))
                        .map((month) => (
                          <article key={month.month} className="rounded-2xl border border-slate-200 p-4 sm:p-5">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <p className="font-bold text-slate-950">{formatMonth(month.month)}</p>
                                <p className="mt-1 text-sm font-semibold text-indigo-700">{month.status}</p>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {month.departments.map((department) => (
                                  <span key={department} className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">
                                    {titleCase(department)}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <p className="mt-3 text-sm leading-6 text-slate-600">{month.summary}</p>
                            {month.keyEvents.length > 0 ? (
                              <ul className="mt-3 grid gap-1.5 text-xs leading-5 text-slate-500 sm:grid-cols-2">
                                {month.keyEvents.map((event) => (
                                  <li key={event}>• {event}</li>
                                ))}
                              </ul>
                            ) : null}
                            {month.escalations.length > 0 ? (
                              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-900">
                                Escalation: {month.escalations.join("; ")}
                              </p>
                            ) : null}
                          </article>
                        ))}
                    </div>
                  </div>
                ) : null}

                {parsed.nextActions.length > 0 ? (
                  <div>
                    <h3 className="font-bold text-slate-950">Recommended next actions</h3>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      {parsed.nextActions.map((action) => (
                        <div key={`${action.ownerDepartment}-${action.action}`} className="flex gap-3 rounded-xl border border-slate-200 p-3">
                          <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-indigo-500" />
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{action.action}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {titleCase(action.ownerDepartment)} · {titleCase(action.priority)} priority
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </details>
          </>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 text-[11px] text-slate-400">
          <span>
            {analysis?.sourceEventCount || 0} source events · Last generated {formatGeneratedAt(analysis?.generatedAt)}
          </span>
          {analysis?.provider && analysis?.model ? (
            <span>{titleCase(analysis.provider)} · {analysis.model}</span>
          ) : null}
        </div>
      </div>
    </section>
  );
}
