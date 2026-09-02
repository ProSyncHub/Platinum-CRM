"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  CircleDot,
  Clock3,
  FileText,
  Inbox,
  MessageSquareText,
  UserRoundCheck,
} from "lucide-react";
import ResolveQueryModal from "@/components/members/ResolveQueryModal";

export interface QueryTicket {
  id: string;
  status: string;
  priority: string;
  reason: string;
  fromDepartment: string;
  toDepartment: string;
  assignedToUser?: string | null;
  assignedToName?: string | null;
  assignedToEmail?: string | null;
  createdByUser?: string | null;
  createdByName?: string | null;
  sourceCallLogId?: string | null;
  createdAt: string;
  resolutionNotes?: string | null;
  resolutionMedium?: string | null;
  resolvedByName?: string | null;
  resolvedByEmail?: string | null;
  resolvedAt?: string | null;
  member: {
    id: string;
    fullName: string;
    memberCode: string;
    phone: string;
    email: string;
    programType: string;
  };
  sourceCommunication: {
    id: string;
    date: string;
    medium: string;
    type: string;
    outcome: string;
    notes: string;
    staffName?: string | null;
    staffDepartment?: string | null;
    staffUserId?: string | null;
  } | null;
}

interface QueryDeskClientProps {
  tickets: QueryTicket[];
  viewer: { id: string; name?: string; role: string; department: string; scope?: string };
  counts?: { open: number; resolved: number; assignedToMe: number; sentByMe: number; department: number };
  focusedTicketId?: string;
}

function titleCase(value?: string | null) {
  return (value || "Not set")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value?: string | null) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function isOpen(ticket: QueryTicket) {
  return ticket.status === "pending" || ticket.status === "in_progress";
}

function canResolve(ticket: QueryTicket, viewer: QueryDeskClientProps["viewer"]) {
  const role = viewer.role.trim().toLowerCase();
  if (["owner", "admin", "superadmin"].includes(role)) return true;
  if (ticket.assignedToUser === viewer.id) return true;
  return role === "manager" && ticket.toDepartment.trim().toLowerCase() === viewer.department.trim().toLowerCase();
}

function priorityClass(priority: string) {
  if (priority === "urgent") return "border-red-200 bg-red-50 text-red-700";
  if (priority === "high") return "border-amber-200 bg-amber-50 text-amber-800";
  if (priority === "low") return "border-slate-200 bg-slate-50 text-slate-600";
  return "border-blue-200 bg-blue-50 text-blue-700";
}

export function QueryTicketCard({
  ticket,
  viewer,
  compact = false,
}: {
  ticket: QueryTicket;
  viewer: QueryDeskClientProps["viewer"];
  compact?: boolean;
}) {
  const [resolveOpen, setResolveOpen] = useState(false);
  const unresolved = isOpen(ticket);
  const canClose = unresolved && canResolve(ticket, viewer);

  return (
    <article className={`rounded-2xl border p-5 shadow-xs ${unresolved ? "border-violet-200 bg-white" : "border-slate-200 bg-slate-50"}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${unresolved ? "border-violet-200 bg-violet-50 text-violet-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
              {unresolved ? "Open query" : "Resolved"}
            </span>
            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${priorityClass(ticket.priority)}`}>
              {ticket.priority} priority
            </span>
            <span className="text-xs font-semibold text-slate-500">{formatDate(ticket.createdAt)}</span>
          </div>
          <Link href={`/queries/${ticket.id}`} className="mt-3 inline-flex items-center gap-2 text-lg font-bold text-slate-950 hover:text-violet-800">
            {ticket.member.fullName}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="mt-1 text-xs font-medium text-slate-500">{ticket.member.memberCode} · {ticket.member.phone}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600 sm:text-right">
          <p><span className="font-bold text-slate-800">Route:</span> {titleCase(ticket.fromDepartment)} → {titleCase(ticket.toDepartment)}</p>
          <p><span className="font-bold text-slate-800">Owner:</span> {ticket.assignedToName || "Department queue"}</p>
        </div>
      </div>

      <section className="mt-4 rounded-xl border border-violet-100 bg-violet-50/50 p-4">
        <p className="text-[10px] font-bold uppercase tracking-wide text-violet-700">Issue to resolve</p>
        <p className="mt-1 whitespace-pre-wrap text-sm font-medium leading-6 text-slate-800">{ticket.reason}</p>
      </section>

      {!compact && (
        <section className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            <MessageSquareText className="h-3.5 w-3.5" /> Original communication
          </div>
          {ticket.sourceCommunication ? (
            <>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{ticket.sourceCommunication.notes}</p>
              <p className="mt-2 text-xs text-slate-500">
                {titleCase(ticket.sourceCommunication.medium)} · {titleCase(ticket.sourceCommunication.type)} · {ticket.sourceCommunication.staffName || titleCase(ticket.fromDepartment)} · {formatDate(ticket.sourceCommunication.date)}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-500">Original communication was not linked on this older transfer. The ticket instructions above remain the source of truth.</p>
          )}
        </section>
      )}

      {unresolved ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <p className="text-xs text-slate-500">This issue remains open until the receiving owner records how it was resolved.</p>
          <div className="flex gap-2">
            <Link href={`/queries/${ticket.id}`} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
              View issue <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            {canClose && (
              <button type="button" onClick={() => setResolveOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" /> Mark resolved
              </button>
            )}
          </div>
        </div>
      ) : (
        <section className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="flex items-center gap-2 text-xs font-bold text-emerald-800"><CheckCircle2 className="h-4 w-4" /> Resolved by {ticket.resolvedByName || "team member"} · {formatDate(ticket.resolvedAt)}</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{ticket.resolutionNotes || "Resolution record unavailable."}</p>
          {ticket.resolutionMedium && <p className="mt-2 text-xs text-slate-500">Resolved via {titleCase(ticket.resolutionMedium)}</p>}
        </section>
      )}

      <ResolveQueryModal
        isOpen={resolveOpen}
        onClose={() => setResolveOpen(false)}
        transferId={ticket.id}
        memberName={ticket.member.fullName}
        transferReason={ticket.reason}
        toDepartment={ticket.toDepartment}
        onSuccess={() => window.location.reload()}
      />
    </article>
  );
}

export default function QueryDeskClient({ tickets, viewer, counts }: QueryDeskClientProps) {
  const manager = viewer.scope === "manager";
  const admin = viewer.scope === "admin";
  const [scope, setScope] = useState<"mine" | "sent" | "department" | "all">(admin ? "all" : "mine");
  const [status, setStatus] = useState<"open" | "resolved" | "all">("open");

  const visibleTickets = useMemo(() => tickets.filter((ticket) => {
    const inScope = scope === "all"
      || (scope === "mine" && ticket.assignedToUser === viewer.id)
      || (scope === "sent" && (ticket.createdByUser === viewer.id || ticket.sourceCommunication?.staffUserId === viewer.id))
      || (scope === "department" && ticket.toDepartment.trim().toLowerCase() === viewer.department.trim().toLowerCase());
    const statusMatches = status === "all" || (status === "open" ? isOpen(ticket) : ticket.status === "resolved");
    return inScope && statusMatches;
  }), [scope, status, tickets, viewer.department, viewer.id]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-violet-700"><Inbox className="h-4 w-4" /> Query desk</div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">Transferred issues with clear ownership.</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Every transfer keeps the original communication, receiving owner and resolution evidence. A query stays open until it is explicitly closed.</p>
          </div>
          <Link href="/workspace" className="inline-flex items-center gap-2 self-start rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800"><MessageSquareText className="h-4 w-4 text-amber-400" /> Find a member</Link>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            ["1", "Received", "The original customer issue and conversation are preserved."],
            ["2", "Assigned", "One person owns the response; managers can supervise their team."],
            ["3", "Resolved", "The owner records the medium and outcome before the ticket closes."],
          ].map(([step, title, detail]) => (
            <div key={step} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-bold text-amber-400">{step}</span>
              <div><p className="text-xs font-bold text-slate-900">{title}</p><p className="mt-0.5 text-xs leading-5 text-slate-500">{detail}</p></div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={CircleDot} label="Open in this view" value={counts?.open ?? tickets.filter(isOpen).length} tone="violet" />
        <Metric icon={UserRoundCheck} label="Assigned to me" value={counts?.assignedToMe ?? tickets.filter((ticket) => ticket.assignedToUser === viewer.id && isOpen(ticket)).length} tone="blue" />
        <Metric icon={MessageSquareText} label="Sent by me" value={counts?.sentByMe ?? tickets.filter((ticket) => ticket.createdByUser === viewer.id && isOpen(ticket)).length} tone="amber" />
        {(manager || admin) && <Metric icon={Inbox} label={manager ? "Department open" : "Resolved"} value={manager ? counts?.department ?? 0 : counts?.resolved ?? tickets.filter((ticket) => ticket.status === "resolved").length} tone="amber" />}
        <Metric icon={CheckCircle2} label="Resolved in this view" value={tickets.filter((ticket) => ticket.status === "resolved").length} tone="emerald" />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Query queue</h2>
            <p className="mt-1 text-sm text-slate-500">Open a query to review the full issue before you resolve it.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {admin && <FilterButton active={scope === "all"} onClick={() => setScope("all")}>Organization</FilterButton>}
            <FilterButton active={scope === "mine"} onClick={() => setScope("mine")}>Assigned to me</FilterButton>
            <FilterButton active={scope === "sent"} onClick={() => setScope("sent")}>Sent by me</FilterButton>
            {manager && <FilterButton active={scope === "department"} onClick={() => setScope("department")}>My department</FilterButton>}
            <span className="mx-1 hidden h-8 w-px bg-slate-200 sm:block" />
            <FilterButton active={status === "open"} onClick={() => setStatus("open")}>Open</FilterButton>
            <FilterButton active={status === "resolved"} onClick={() => setStatus("resolved")}>Resolved</FilterButton>
            <FilterButton active={status === "all"} onClick={() => setStatus("all")}>All</FilterButton>
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {visibleTickets.length > 0 ? visibleTickets.map((ticket) => <QueryTicketCard key={ticket.id} ticket={ticket} viewer={viewer} />) : (
            <div className="col-span-full rounded-2xl border border-dashed border-slate-300 p-10 text-center">
              <FileText className="mx-auto h-8 w-8 text-slate-300" />
              <h3 className="mt-3 font-bold text-slate-800">No queries match this view</h3>
              <p className="mt-1 text-sm text-slate-500">Transferred issues will appear here as soon as a team assigns them.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Metric({ icon: Icon, label, value, tone }: { icon: typeof Inbox; label: string; value: number; tone: "violet" | "blue" | "amber" | "emerald" }) {
  const tones = { violet: "border-violet-200 bg-violet-50 text-violet-700", blue: "border-blue-200 bg-blue-50 text-blue-700", amber: "border-amber-200 bg-amber-50 text-amber-800", emerald: "border-emerald-200 bg-emerald-50 text-emerald-700" };
  return <div className={`rounded-2xl border p-5 ${tones[tone]}`}><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-wide">{label}</p><Icon className="h-5 w-5" /></div><p className="mt-3 text-3xl font-bold">{value}</p></div>;
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`rounded-lg px-3 py-2 text-xs font-bold transition ${active ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>{children}</button>;
}
