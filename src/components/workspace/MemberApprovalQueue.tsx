"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock3, Eye, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { reviewMemberRegistration } from "@/app/actions/workspaceActions";

interface ApprovalMember {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  programType: string;
  submittedByName?: string | null;
  submittedByDepartment?: string | null;
  callLogs: Array<{ id: string; outcome: string; notes: string }>;
}

export default function MemberApprovalQueue({
  members,
  programs,
}: {
  members: ApprovalMember[];
  programs: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedPrograms, setSelectedPrograms] = useState<Record<string, string>>({});

  async function review(member: ApprovalMember, decision: "approved" | "rejected") {
    const programType = selectedPrograms[member.id] || member.programType;
    const notes = window.prompt(
      decision === "approved" ? "Optional approval note:" : "Reason for rejection:",
      "",
    );
    if (decision === "rejected" && notes === null) return;
    setBusyId(member.id);
    try {
      const response = await reviewMemberRegistration(member.id, decision, {
        programType,
        reviewNotes: notes || "",
      });
      if (!response.success) return toast.error(response.error || "Review failed.");
      toast.success(decision === "approved" ? "Member approved." : "Registration rejected.");
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      <Link href="/workspace" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950">
        <ArrowLeft className="h-4 w-4" /> Back to member workspace
      </Link>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-950">New member approvals</h1>
            <p className="mt-1 text-sm text-slate-500">Review staff registrations and confirm the final program.</p>
          </div>
        </div>
      </section>

      {members.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
          <h2 className="mt-3 font-bold text-slate-950">All caught up</h2>
          <p className="mt-1 text-sm text-slate-500">There are no registrations waiting for approval.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {members.map((member) => {
            const latest = member.callLogs?.[0];
            return (
              <article key={member.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-bold text-slate-950">{member.fullName}</h2>
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-1 text-[11px] font-bold text-amber-800">
                        <Clock3 className="h-3 w-3" /> Pending
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{member.phone} · {member.email}</p>
                    <p className="mt-2 text-xs capitalize text-slate-400">
                      Submitted by {member.submittedByName || "Staff"} · {member.submittedByDepartment || "operations"}
                    </p>
                    {latest && (
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">First communication</p>
                        <p className="mt-2 text-sm font-semibold text-slate-900">{latest.outcome}</p>
                        <p className="mt-1 text-sm leading-6 text-slate-600">{latest.notes}</p>
                      </div>
                    )}
                  </div>

                  <div className="w-full space-y-3 lg:w-80">
                    <label className="block space-y-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
                      Approve for program
                      <select
                        value={selectedPrograms[member.id] || member.programType}
                        onChange={(event) => setSelectedPrograms((current) => ({ ...current, [member.id]: event.target.value }))}
                        className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium normal-case text-slate-950 outline-none focus:border-violet-500"
                      >
                        {!programs.some((program) => program.name === member.programType) && (
                          <option value={member.programType}>{member.programType} (requested)</option>
                        )}
                        {programs.map((program) => <option key={program.id} value={program.name}>{program.name}</option>)}
                      </select>
                    </label>
                    <Link href={`/workspace/${member.id}`} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 text-sm font-bold text-slate-700 hover:bg-slate-50">
                      <Eye className="h-4 w-4" /> Review journey
                    </Link>
                    <div className="grid grid-cols-2 gap-2">
                      <button disabled={busyId === member.id} onClick={() => review(member, "rejected")} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 text-sm font-bold text-red-700 hover:bg-red-100 disabled:opacity-50">
                        <XCircle className="h-4 w-4" /> Reject
                      </button>
                      <button disabled={busyId === member.id} onClick={() => review(member, "approved")} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Approve
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
