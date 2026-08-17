"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRightLeft,
  Building2,
  CalendarClock,
  CircleDot,
  Clock3,
  ExternalLink,
  Mail,
  MapPin,
  MessageSquareText,
  Phone,
  RefreshCw,
  Route,
  ShieldCheck,
} from "lucide-react";
import MemberAiBrief from "@/components/workspace/MemberAiBrief";
import OneOnOneSessionsPanel, {
  type OneOnOneSessionView,
} from "@/components/workspace/OneOnOneSessionsPanel";
import {
  DepartmentUpdateModal,
  QuickCommunicationModal,
  TransferCommunicationModal,
} from "@/components/workspace/WorkspaceActionModals";

interface MemberJourneyWorkspaceProps {
  member: WorkspaceMember;
  user: { id: string; name: string; role: string; department: string };
  departments: string[];
  contactStaffOptions: Array<{
    id: string;
    name: string;
    email: string;
    department: string;
  }>;
  oneOnOneSessions: OneOnOneSessionView[];
}

interface CallLogEntry {
  id: string;
  date: string;
  type: string;
  medium: string;
  outcome: string;
  notes: string;
  staffName?: string | null;
  staffDepartment?: string | null;
}

interface TransferEntry {
  id: string;
  createdAt: string;
  fromDepartment: string;
  toDepartment: string;
  priority: string;
  status: string;
  reason: string;
  assignedToName?: string | null;
  assignedToEmail?: string | null;
}

interface DepartmentUpdateEntry {
  id: string;
  createdAt: string;
  department: string;
  status: string;
  summary: string;
  details?: string | null;
  nextStep?: string | null;
  updatedByName: string;
}

interface WorkspaceMember {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  state?: string | null;
  memberCode: string;
  programType: string;
  oneOnOneSessions: number;
  approvalStatus?: string | null;
  activeStatus: string;
  currentStage: string;
  department?: string | null;
  notes?: string | null;
  callLogs: CallLogEntry[];
  queryTransfers: TransferEntry[];
  departmentUpdates: DepartmentUpdateEntry[];
  aiAnalysis?: {
    status: string;
    executiveBrief?: string | null;
    currentStatus?: string | null;
    escalationLevel?: string | null;
    escalationSummary?: string | null;
    analysisJson?: string | null;
    sourceEventCount: number;
    provider?: string | null;
    model?: string | null;
    lastError?: string | null;
    generatedAt?: string | null;
  } | null;
  aiAnalysisNeedsRefresh: boolean;
  aiAnalysisSourceHash: string;
}

interface TimelineEntry {
  id: string;
  type: "communication" | "transfer" | "department";
  at: string;
  title: string;
  body: string;
  meta: string;
  department?: string | null;
}

const STATUS_STYLES: Record<string, string> = {
  completed: "bg-emerald-100 text-emerald-800",
  in_progress: "bg-blue-100 text-blue-800",
  waiting: "bg-amber-100 text-amber-800",
  blocked: "bg-red-100 text-red-800",
  not_started: "bg-slate-100 text-slate-700",
};

function formatDate(value?: string | null) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function titleCase(value?: string | null) {
  return (value || "Not set")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function MemberJourneyWorkspace({
  member,
  user,
  departments,
  contactStaffOptions,
  oneOnOneSessions,
}: MemberJourneyWorkspaceProps) {
  const router = useRouter();
  const [communicationOpen, setCommunicationOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [departmentOpen, setDepartmentOpen] = useState(false);

  const latestByDepartment = useMemo(() => {
    const latest = new Map<string, DepartmentUpdateEntry>();
    for (const update of member.departmentUpdates || []) {
      const department = update.department.toLowerCase();
      if (!latest.has(department)) latest.set(department, update);
    }
    return Array.from(latest.values());
  }, [member.departmentUpdates]);

  const latestConversationByDepartment = useMemo(() => {
    const latest = new Map<string, CallLogEntry>();
    const conversations = (member.callLogs || [])
      .filter((communication) => communication.medium.toLowerCase() !== "internal")
      .toSorted((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());
    for (const communication of conversations) {
      const department = (communication.staffDepartment || "unassigned").toLowerCase();
      if (!latest.has(department)) latest.set(department, communication);
    }
    return Array.from(latest.entries()).map(([department, communication]) => ({
      department,
      communication,
    }));
  }, [member.callLogs]);

  const timeline = useMemo(() => {
    const calls: TimelineEntry[] = (member.callLogs || []).map((item) => ({
      id: `call-${item.id}`,
      type: "communication",
      at: item.date,
      title: item.outcome,
      body: item.notes,
      meta: `${titleCase(item.medium)} · ${titleCase(item.type)} · ${item.staffName || "Staff member"}`,
      department: item.staffDepartment,
    }));
    const transfers: TimelineEntry[] = (member.queryTransfers || []).map((item) => ({
      id: `transfer-${item.id}`,
      type: "transfer",
      at: item.createdAt,
      title: `Transferred to ${titleCase(item.toDepartment)}`,
      body: item.reason,
      meta: `${titleCase(item.priority)} priority · ${titleCase(item.status)}${item.assignedToName ? ` · Assigned to ${item.assignedToName}` : ""}`,
      department: item.fromDepartment,
    }));
    const updates: TimelineEntry[] = (member.departmentUpdates || []).map((item) => ({
      id: `update-${item.id}`,
      type: "department",
      at: item.createdAt,
      title: `${titleCase(item.department)}: ${item.summary}`,
      body: [item.details, item.nextStep ? `Next: ${item.nextStep}` : ""].filter(Boolean).join(" · "),
      meta: `${titleCase(item.status)} · ${item.updatedByName}`,
      department: item.department,
    }));
    return [...calls, ...transfers, ...updates].sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
    );
  }, [member.callLogs, member.departmentUpdates, member.queryTransfers]);

  const approvalStatus = member.approvalStatus || "approved";
  const latestCall = member.callLogs?.[0];

  function refresh() {
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/workspace" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950">
          <ArrowLeft className="h-4 w-4" /> Back to search
        </Link>
        <Link href={`/members/${member.id}`} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-950">
          Open advanced profile <ExternalLink className="h-4 w-4" />
        </Link>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight text-slate-950">{member.fullName}</h1>
              <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{member.programType}</span>
              {approvalStatus === "pending" && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
                  <Clock3 className="h-3.5 w-3.5" /> Pending admin approval
                </span>
              )}
              {approvalStatus === "approved" && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
                  <ShieldCheck className="h-3.5 w-3.5" /> Approved
                </span>
              )}
            </div>
            <p className="mt-2 text-sm font-medium text-slate-500">{member.memberCode}</p>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-700">
              <span className="inline-flex items-center gap-2"><Phone className="h-4 w-4 text-slate-400" />{member.phone}</span>
              <span className="inline-flex items-center gap-2"><Mail className="h-4 w-4 text-slate-400" />{member.email}</span>
              {member.state && <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4 text-slate-400" />{member.state}</span>}
            </div>
          </div>

          <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-auto lg:min-w-[430px]">
            <button
              type="button"
              onClick={() => setCommunicationOpen(true)}
              className="flex min-h-16 items-center justify-center gap-3 rounded-2xl bg-slate-950 px-5 py-4 text-sm font-bold text-white shadow-sm hover:bg-slate-800"
            >
              <MessageSquareText className="h-5 w-5 text-amber-400" />
              Log communication
            </button>
            <button
              type="button"
              onClick={() => setTransferOpen(true)}
              className="flex min-h-16 items-center justify-center gap-3 rounded-2xl border-2 border-slate-950 bg-white px-5 py-4 text-sm font-bold text-slate-950 hover:bg-slate-50"
            >
              <ArrowRightLeft className="h-5 w-5" />
              Transfer to a team
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={CircleDot} label="Current status" value={member.activeStatus} />
        <SummaryCard icon={Route} label="Journey stage" value={titleCase(member.currentStage)} />
        <SummaryCard icon={Building2} label="Owning department" value={titleCase(member.department)} />
        <SummaryCard
          icon={CalendarClock}
          label="Latest contact"
          value={latestCall ? formatDate(latestCall.date) : "Never contacted"}
          detail={latestCall?.staffName ? `By ${latestCall.staffName}` : undefined}
        />
      </section>

      <OneOnOneSessionsPanel
        member={{
          id: member.id,
          fullName: member.fullName,
          memberCode: member.memberCode,
          programType: member.programType,
          oneOnOneSessions: member.oneOnOneSessions || 0,
        }}
        user={user}
        sessions={oneOnOneSessions}
        staffOptions={contactStaffOptions}
      />

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div>
          <h2 className="text-lg font-bold text-slate-950">Latest conversation from every department</h2>
          <p className="mt-1 text-sm text-slate-500">
            These are factual CRM notes. Each department keeps its own latest customer conversation visible here.
          </p>
        </div>

        {latestConversationByDepartment.length > 0 ? (
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {latestConversationByDepartment.map(({ department, communication }) => (
              <article key={department} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-slate-950">{titleCase(department)}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {communication.staffName || "Staff member"} · {formatDate(communication.date)}
                    </p>
                  </div>
                  <span className="rounded-lg bg-white px-2 py-1 text-[10px] font-bold uppercase text-slate-600 shadow-sm">
                    {titleCase(communication.medium)}
                  </span>
                </div>
                <p className="mt-3 text-sm font-bold text-slate-800">{communication.outcome}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                  {communication.notes}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-300 p-7 text-center text-sm text-slate-500">
            No customer conversation has been recorded yet.
          </div>
        )}
      </section>

      <MemberAiBrief
        memberId={member.id}
        analysis={member.aiAnalysis}
        needsRefresh={member.aiAnalysisNeedsRefresh}
        sourceVersion={member.aiAnalysisSourceHash}
      />

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Department status</h2>
            <p className="mt-1 text-sm text-slate-500">Each team owns its update; everyone in scope can see the shared customer journey.</p>
          </div>
          <button
            type="button"
            onClick={() => setDepartmentOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" /> Update {titleCase(user.department)} status
          </button>
        </div>

        {latestByDepartment.length > 0 ? (
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {latestByDepartment.map((update) => (
              <article key={update.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold text-slate-950">{titleCase(update.department)}</p>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_STYLES[update.status] || STATUS_STYLES.not_started}`}>
                    {titleCase(update.status)}
                  </span>
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-800">{update.summary}</p>
                {update.nextStep && <p className="mt-2 text-xs leading-5 text-slate-500">Next: {update.nextStep}</p>}
                <p className="mt-3 text-[11px] text-slate-400">{update.updatedByName} · {formatDate(update.createdAt)}</p>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-300 p-7 text-center text-sm text-slate-500">
            No department status has been added yet.
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Complete customer journey</h2>
            <p className="mt-1 text-sm text-slate-500">Communication, transfers, and department progress in one timeline.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{timeline.length} updates</span>
        </div>

        <div className="space-y-3">
          {timeline.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
              No journey activity yet. Log the first communication above.
            </div>
          ) : timeline.map((item) => (
            <article key={item.id} className="relative rounded-2xl border border-slate-200 p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
                      item.type === "communication"
                        ? "bg-emerald-100 text-emerald-800"
                        : item.type === "transfer"
                          ? "bg-violet-100 text-violet-800"
                          : "bg-blue-100 text-blue-800"
                    }`}>
                      {item.type}
                    </span>
                    {item.department && <span className="text-xs font-semibold capitalize text-slate-500">{item.department}</span>}
                  </div>
                  <h3 className="mt-2 font-bold text-slate-950">{item.title}</h3>
                  {item.body && <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-600">{item.body}</p>}
                  <p className="mt-2 text-xs text-slate-400">{item.meta}</p>
                </div>
                <time className="shrink-0 text-xs font-medium text-slate-400">{formatDate(item.at)}</time>
              </div>
            </article>
          ))}
        </div>
      </section>

      <QuickCommunicationModal
        isOpen={communicationOpen}
        onClose={() => setCommunicationOpen(false)}
        member={member}
        user={user}
        contactStaffOptions={contactStaffOptions}
        onSuccess={refresh}
      />
      <TransferCommunicationModal
        isOpen={transferOpen}
        onClose={() => setTransferOpen(false)}
        member={member}
        departments={departments.filter((department) => department !== user.department.toLowerCase())}
        staffOptions={contactStaffOptions}
        onSuccess={refresh}
      />
      <DepartmentUpdateModal
        isOpen={departmentOpen}
        onClose={() => setDepartmentOpen(false)}
        member={member}
        user={user}
        departments={departments}
        onSuccess={refresh}
      />
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <p className="mt-2 text-sm font-bold text-slate-950">{value}</p>
      {detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}
    </div>
  );
}
