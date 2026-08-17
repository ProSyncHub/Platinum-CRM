"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Copy,
  RefreshCw,
  RotateCcw,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  cancelOneOnOneSession,
  rescheduleOneOnOneSession,
  scheduleOneOnOneSession,
  syncOneOnOneSession,
} from "@/app/actions/oneOnOneActions";

export interface OneOnOneSessionView {
  id: string;
  sessionNumber: number;
  sequence: number;
  status: string;
  scheduledStart: string;
  plannedDuration: number;
  actualStart?: string | null;
  actualEnd?: string | null;
  verifiedMinutes?: number | null;
  attendanceStatus: string;
  attendanceMatchMethod?: string | null;
  memberQuestions?: string | null;
  preparationNotes?: string | null;
  coordinatorUserId?: string | null;
  coordinatorName: string;
  coordinatorEmail: string;
  zoomMeetingId?: string | null;
  joinUrl?: string | null;
  transcriptStatus: string;
  aiStatus: string;
  aiSummary?: string | null;
  lastError?: string | null;
  cancellationReason?: string | null;
  completedAt?: string | null;
}

interface Props {
  member: {
    id: string;
    fullName: string;
    memberCode: string;
    programType: string;
    oneOnOneSessions: number;
  };
  user: { id: string; name: string; role: string; department: string };
  sessions: OneOnOneSessionView[];
  staffOptions: Array<{
    id: string;
    name: string;
    email: string;
    department: string;
  }>;
}

const STATUS_STYLES: Record<string, string> = {
  completed: "border-emerald-200 bg-emerald-50 text-emerald-800",
  scheduled: "border-blue-200 bg-blue-50 text-blue-800",
  started: "border-violet-200 bg-violet-50 text-violet-800",
  processing: "border-amber-200 bg-amber-50 text-amber-800",
  review_required: "border-orange-200 bg-orange-50 text-orange-800",
  cancelled: "border-slate-200 bg-slate-50 text-slate-600",
  failed: "border-red-200 bg-red-50 text-red-800",
  scheduling: "border-blue-200 bg-blue-50 text-blue-800",
};

function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value?: string | null) {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

function toLocalInput(value?: string | null) {
  const date = value ? new Date(value) : new Date(Date.now() + 24 * 60 * 60 * 1_000);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
    timeZone: "Asia/Kolkata",
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function indiaLocalToIso(value: string) {
  if (!value) return "";
  return new Date(`${value}:00+05:30`).toISOString();
}

export default function OneOnOneSessionsPanel({
  member,
  user,
  sessions,
  staffOptions,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<{
    sessionNumber: number;
    session?: OneOnOneSessionView;
  } | null>(null);

  const latestBySlot = useMemo(() => {
    const map = new Map<number, OneOnOneSessionView>();
    for (const session of [...sessions].sort((left, right) => right.sequence - left.sequence)) {
      if (!map.has(session.sessionNumber)) map.set(session.sessionNumber, session);
    }
    return map;
  }, [sessions]);

  const verifiedCompleted = new Set(
    sessions
      .filter((session) => session.status === "completed")
      .map((session) => session.sessionNumber),
  ).size;
  const completed = Math.max(member.oneOnOneSessions || 0, verifiedCompleted);
  const role = user.role.trim().toLowerCase();
  const canManage =
    ["admin", "superadmin", "manager"].includes(role) ||
    user.department.trim().toLowerCase() === "management";
  const eligible =
    member.programType.toLowerCase().includes("platinum") ||
    member.memberCode.toUpperCase().startsWith("PLT");

  function run(action: () => Promise<{ success: boolean; error?: string }>, message: string) {
    startTransition(async () => {
      const result = await action();
      if (!result.success) toast.error(result.error || "The operation could not be completed.");
      else {
        toast.success(message);
        setEditing(null);
        router.refresh();
      }
    });
  }

  async function copyJoinLink(joinUrl: string) {
    await navigator.clipboard.writeText(joinUrl);
    toast.success("Member Zoom link copied.");
  }

  function cancel(session: OneOnOneSessionView) {
    const reason = window.prompt("Why is this 1-on-1 being cancelled?");
    if (!reason?.trim()) return;
    run(
      () => cancelOneOnOneSession(session.id, reason),
      `Session ${session.sessionNumber} cancelled.`,
    );
  }

  if (!eligible) return null;

  return (
    <section className="rounded-3xl border border-indigo-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-indigo-100 p-2 text-indigo-700">
              <Video className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-950">Platinum 1-on-1 sessions</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                Zoom attendance, minutes, transcript and CRM documentation are synchronized automatically.
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-slate-950 px-4 py-3 text-white">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Verified entitlement</p>
          <p className="mt-1 text-xl font-black">{Math.min(6, completed)} of 6 completed</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => index + 1).map((sessionNumber) => {
          const session = latestBySlot.get(sessionNumber);
          const legacyCompleted = !session && sessionNumber <= (member.oneOnOneSessions || 0);
          const status = session?.status || (legacyCompleted ? "completed" : "available");
          const active = legacyCompleted || Boolean(session && !["cancelled", "failed"].includes(session.status));
          return (
            <article key={sessionNumber} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Session {sessionNumber} of 6
                  </p>
                  <p className="mt-1 font-bold text-slate-950">
                    {session
                      ? formatDate(session.scheduledStart)
                      : legacyCompleted
                        ? "Recorded before Zoom automation"
                        : "Available to schedule"}
                  </p>
                </div>
                <span
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                    STATUS_STYLES[status] || "border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  {titleCase(status)}
                </span>
              </div>

              {session && (
                <div className="mt-3 space-y-1 text-xs text-slate-500">
                  <p>Coordinator: <strong className="text-slate-700">{session.coordinatorName}</strong></p>
                  {session.verifiedMinutes ? (
                    <p className="flex items-center gap-1.5 text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <strong>{session.verifiedMinutes} verified overlap minutes</strong>
                    </p>
                  ) : (
                    <p className="flex items-center gap-1.5">
                      <Clock3 className="h-3.5 w-3.5" /> Planned for {session.plannedDuration} minutes
                    </p>
                  )}
                  {session.transcriptStatus === "ready" && <p>Transcript captured automatically</p>}
                  {session.aiStatus === "ready" && <p>Claude notes completed</p>}
                </div>
              )}
              {legacyCompleted && (
                <p className="mt-3 text-xs leading-5 text-slate-500">
                  This completed entitlement was carried forward from the existing CRM count. New sessions will include verified Zoom attendance and automated notes.
                </p>
              )}

              {session?.aiSummary && (
                <p className="mt-3 line-clamp-4 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                  {session.aiSummary}
                </p>
              )}
              {session?.lastError && ["failed", "review_required"].includes(session.status) && (
                <p className="mt-3 flex gap-2 rounded-xl bg-red-50 p-3 text-xs leading-5 text-red-700">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {session.lastError}
                </p>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                {canManage && !active && (
                  <button
                    type="button"
                    onClick={() => setEditing({ sessionNumber })}
                    disabled={pending}
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    <CalendarClock className="h-3.5 w-3.5" /> Schedule
                  </button>
                )}
                {canManage && session?.status === "scheduled" && (
                  <>
                    <button
                      type="button"
                      onClick={() => setEditing({ sessionNumber, session })}
                      disabled={pending}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Reschedule
                    </button>
                    <button
                      type="button"
                      onClick={() => cancel(session)}
                      disabled={pending}
                      className="rounded-xl border border-red-200 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </>
                )}
                {session?.joinUrl && session.status === "scheduled" && (
                  <button
                    type="button"
                    onClick={() => copyJoinLink(session.joinUrl!)}
                    className="inline-flex items-center gap-2 rounded-xl border border-blue-200 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50"
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy member link
                  </button>
                )}
                {canManage && session?.zoomMeetingId && !["scheduled", "cancelled", "failed"].includes(session.status) && (
                  <button
                    type="button"
                    onClick={() => run(() => syncOneOnOneSession(session.id), "Zoom data synchronized.")}
                    disabled={pending}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`} /> Sync Zoom
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {!canManage && (
        <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
          Everyone can see the verified session journey. Scheduling is limited to management, managers and administrators.
        </p>
      )}

      {editing && (
        <ScheduleSessionModal
          member={member}
          user={user}
          staffOptions={staffOptions}
          sessionNumber={editing.sessionNumber}
          session={editing.session}
          pending={pending}
          onClose={() => setEditing(null)}
          onSubmit={(values) => {
            if (editing.session) {
              run(
                () =>
                  rescheduleOneOnOneSession({
                    sessionId: editing.session!.id,
                    scheduledStart: indiaLocalToIso(values.scheduledStart),
                    plannedDuration: values.plannedDuration,
                  }),
                `Session ${editing.sessionNumber} rescheduled.`,
              );
              return;
            }
            run(
              () =>
                scheduleOneOnOneSession({
                  memberId: member.id,
                  sessionNumber: editing.sessionNumber,
                  scheduledStart: indiaLocalToIso(values.scheduledStart),
                  plannedDuration: values.plannedDuration,
                  memberQuestions: values.memberQuestions,
                  preparationNotes: values.preparationNotes,
                  coordinatorUserId: values.coordinatorUserId,
                }),
              `Session ${editing.sessionNumber} scheduled in Zoom.`,
            );
          }}
        />
      )}
    </section>
  );
}

function ScheduleSessionModal({
  member,
  user,
  staffOptions,
  sessionNumber,
  session,
  pending,
  onClose,
  onSubmit,
}: {
  member: Props["member"];
  user: Props["user"];
  staffOptions: Props["staffOptions"];
  sessionNumber: number;
  session?: OneOnOneSessionView;
  pending: boolean;
  onClose: () => void;
  onSubmit: (values: {
    scheduledStart: string;
    plannedDuration: number;
    memberQuestions: string;
    preparationNotes: string;
    coordinatorUserId: string;
  }) => void;
}) {
  const [scheduledStart, setScheduledStart] = useState(toLocalInput(session?.scheduledStart));
  const [plannedDuration, setPlannedDuration] = useState(session?.plannedDuration || 60);
  const [memberQuestions, setMemberQuestions] = useState(session?.memberQuestions || "");
  const [preparationNotes, setPreparationNotes] = useState(session?.preparationNotes || "");
  const [coordinatorUserId, setCoordinatorUserId] = useState(
    session?.coordinatorUserId || user.id,
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="one-on-one-schedule-title"
        className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-slate-200 p-5 sm:p-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-indigo-600">
              Session {sessionNumber} of 6
            </p>
            <h3 id="one-on-one-schedule-title" className="mt-1 text-xl font-bold text-slate-950">
              {session ? "Reschedule Zoom 1-on-1" : "Schedule Zoom 1-on-1"}
            </h3>
            <p className="mt-1 text-sm text-slate-500">{member.fullName} · {member.memberCode}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close scheduler" className="rounded-xl p-2 text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit({
              scheduledStart,
              plannedDuration,
              memberQuestions,
              preparationNotes,
              coordinatorUserId,
            });
          }}
          className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[0.8fr_1.2fr]"
        >
          <div className="space-y-4">
            <label className="block text-sm font-bold text-slate-700">
              Date and time
              <input
                type="datetime-local"
                required
                value={scheduledStart}
                onChange={(event) => setScheduledStart(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 font-medium outline-none focus:border-indigo-500"
              />
            </label>
            <label className="block text-sm font-bold text-slate-700">
              Planned duration
              <select
                value={plannedDuration}
                onChange={(event) => setPlannedDuration(Number(event.target.value))}
                className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 outline-none focus:border-indigo-500"
              >
                {[30, 45, 60, 75, 90, 120].map((minutes) => (
                  <option key={minutes} value={minutes}>{minutes} minutes</option>
                ))}
              </select>
            </label>
            {!session && (
              <label className="block text-sm font-bold text-slate-700">
                Assigned coordinator
                <select
                  required
                  value={coordinatorUserId}
                  onChange={(event) => setCoordinatorUserId(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 outline-none focus:border-indigo-500"
                >
                  {staffOptions.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.name} — {titleCase(staff.department)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="rounded-2xl bg-indigo-50 p-4 text-xs leading-5 text-indigo-900">
              Zoom will create a unique meeting under Amar Sir. After the meeting, attendance, verified minutes, transcript and CRM notes are synchronized automatically.
            </div>
          </div>

          <div className="space-y-4">
            <label className="block text-sm font-bold text-slate-700">
              What does the member want to discuss?
              <textarea
                value={memberQuestions}
                onChange={(event) => setMemberQuestions(event.target.value)}
                disabled={Boolean(session)}
                rows={5}
                placeholder="Member's questions, priorities and expected outcomes"
                className="mt-2 w-full resize-y rounded-xl border border-slate-300 px-3 py-3 font-normal outline-none focus:border-indigo-500 disabled:bg-slate-50"
              />
            </label>
            <label className="block text-sm font-bold text-slate-700">
              Internal preparation notes
              <textarea
                value={preparationNotes}
                onChange={(event) => setPreparationNotes(event.target.value)}
                disabled={Boolean(session)}
                rows={5}
                placeholder="Previous commitments, business context, blockers or documents to review"
                className="mt-2 w-full resize-y rounded-xl border border-slate-300 px-3 py-3 font-normal outline-none focus:border-indigo-500 disabled:bg-slate-50"
              />
            </label>
            <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
              <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100">
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending || !scheduledStart}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {pending && <RefreshCw className="h-4 w-4 animate-spin" />}
                {session ? "Save new time" : "Create Zoom meeting"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
