"use client";

import { useState } from "react";
import { ArrowRightLeft, Building2, MessageSquareText, X } from "lucide-react";
import { toast } from "sonner";
import { logCallForMember } from "@/app/actions/memberActions";
import {
  addDepartmentUpdate,
  transferWithCommunication,
} from "@/app/actions/workspaceActions";
import type { MediumId } from "@/lib/membershipUtils";

const MEDIA: Array<{ value: MediumId; label: string }> = [
  { value: "phone", label: "Phone call" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "zoom", label: "Zoom" },
  { value: "meet", label: "Google Meet" },
  { value: "in_person", label: "In person" },
  { value: "sms", label: "SMS" },
];

const OUTCOMES = [
  "Connected",
  "Follow-up required",
  "Issue discussed",
  "Information shared",
  "No answer",
  "Callback requested",
  "Resolved",
];

type Priority = "low" | "medium" | "high" | "urgent";

interface StaffOption {
  id: string;
  name: string;
  department: string;
}

interface BaseProps {
  isOpen: boolean;
  onClose: () => void;
  member: { id: string; fullName: string; phone: string };
  onSuccess: () => void;
}

function ModalFrame({
  isOpen,
  onClose,
  icon: Icon,
  title,
  subtitle,
  children,
  wide = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm">
      <div
        className={`my-6 w-full overflow-hidden rounded-2xl bg-white shadow-2xl ${
          wide ? "max-w-5xl" : "max-w-xl"
        }`}
      >
        <div className="flex items-start justify-between border-b border-slate-200 p-5 sm:p-6">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-950">{title}</h2>
              <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function QuickCommunicationModal({
  isOpen,
  onClose,
  member,
  user,
  contactStaffOptions,
  onSuccess,
}: BaseProps & {
  user: { id: string; role: string; department: string };
  contactStaffOptions: StaffOption[];
}) {
  const [loading, setLoading] = useState(false);
  const [medium, setMedium] = useState<MediumId>("phone");
  const [type, setType] = useState<"inbound" | "outbound">("outbound");
  const [health, setHealth] = useState<"healthy" | "warning" | "critical">(
    "healthy",
  );
  const [outcome, setOutcome] = useState("Connected");
  const [contactedBy, setContactedBy] = useState(user.id);
  const [followUpOwner, setFollowUpOwner] = useState(user.id);
  const [followUpDueAt, setFollowUpDueAt] = useState(() => futureDateTime(1));
  const [followUpPriority, setFollowUpPriority] =
    useState<Priority>("medium");

  const normalizedRole = user.role.trim().toLowerCase();
  const canAttribute = ["admin", "superadmin"].includes(normalizedRole);
  const elevated = ["admin", "superadmin", "manager"].includes(normalizedRole);
  const requiresFollowUp =
    outcome === "Follow-up required" || outcome === "Callback requested";
  const assignableStaff = elevated
    ? contactStaffOptions
    : contactStaffOptions.filter(
        (person) =>
          person.department.trim().toLowerCase() ===
          user.department.trim().toLowerCase(),
      );

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const notes = String(form.get("notes") || "").trim();
    if (!notes) return toast.error("Write a short communication note.");
    if (requiresFollowUp && (!followUpOwner || !followUpDueAt)) {
      return toast.error("Choose who will follow up and when.");
    }

    setLoading(true);
    try {
      const response = await logCallForMember(
        member.id,
        type,
        outcome,
        notes,
        undefined,
        medium,
        Number(form.get("duration") || 0),
        health,
        undefined,
        undefined,
        undefined,
        canAttribute ? contactedBy || undefined : undefined,
        undefined,
        requiresFollowUp
          ? {
              assignedToUser: followUpOwner,
              dueAt: new Date(followUpDueAt).toISOString(),
              priority: followUpPriority,
              title: `Call ${member.fullName} again`,
              instructions: notes,
            }
          : undefined,
      );
      if (!response.success) {
        return toast.error(response.error || "Could not log communication.");
      }
      toast.success(
        requiresFollowUp
          ? "Communication saved and follow-up assigned."
          : "Communication added to the customer journey.",
      );
      onClose();
      onSuccess();
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalFrame
      isOpen={isOpen}
      onClose={onClose}
      icon={MessageSquareText}
      title="Log communication"
      subtitle={`${member.fullName} · ${member.phone}`}
      wide
    >
      <form onSubmit={submit} className="max-h-[78vh] overflow-y-auto p-5 sm:p-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="grid content-start gap-4 sm:grid-cols-2">
            {canAttribute && contactStaffOptions.length > 0 && (
              <div className="sm:col-span-2">
                <Select
                  label="Contacted by"
                  value={contactedBy}
                  onChange={setContactedBy}
                >
                  {contactStaffOptions.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name} · {person.department}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            <Select
              label="Medium"
              value={medium}
              onChange={(value) => setMedium(value as MediumId)}
            >
              {MEDIA.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
            <Select
              label="Direction"
              value={type}
              onChange={(value) =>
                setType(value as "inbound" | "outbound")
              }
            >
              <option value="outbound">Outbound - staff contacted member</option>
              <option value="inbound">Inbound - member contacted us</option>
            </Select>
            <label className="space-y-1.5 text-sm font-semibold text-slate-700">
              Outcome
              <select
                value={outcome}
                onChange={(event) => setOutcome(event.target.value)}
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-normal text-slate-950 outline-none focus:border-amber-500"
              >
                {OUTCOMES.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <Select
              label="Customer health"
              value={health}
              onChange={(value) => setHealth(value as typeof health)}
            >
              <option value="healthy">On track</option>
              <option value="warning">Needs attention</option>
              <option value="critical">Critical</option>
            </Select>
            <label className="space-y-1.5 text-sm font-semibold text-slate-700 sm:col-span-2">
              Duration (minutes)
              <input
                name="duration"
                type="number"
                min="0"
                defaultValue="5"
                className="h-11 w-full rounded-lg border border-slate-300 px-3 font-normal outline-none focus:border-amber-500"
              />
            </label>
          </div>

          <div className="space-y-4">
            <NotesField
              name="notes"
              label="What happened and what is the next step?"
              required
              rows={7}
            />
            {requiresFollowUp && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-bold text-slate-950">
                  Follow-up required
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Assign the next call now. It will appear in Overview and
                  Follow-ups.
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="space-y-1.5 text-sm font-semibold text-slate-700">
                    Follow-up owner
                    <select
                      required
                      value={followUpOwner}
                      onChange={(event) => setFollowUpOwner(event.target.value)}
                      className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-normal text-slate-950 outline-none focus:border-amber-500"
                    >
                      <option value="">Select person</option>
                      {assignableStaff.map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.id === user.id ? "Myself" : person.name} ·{" "}
                          {person.department}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1.5 text-sm font-semibold text-slate-700">
                    Follow up on
                    <input
                      required
                      type="datetime-local"
                      value={followUpDueAt}
                      onChange={(event) => setFollowUpDueAt(event.target.value)}
                      className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-normal outline-none focus:border-amber-500"
                    />
                  </label>
                  <label className="space-y-1.5 text-sm font-semibold text-slate-700 sm:col-span-2">
                    Priority
                    <select
                      value={followUpPriority}
                      onChange={(event) =>
                        setFollowUpPriority(event.target.value as Priority)
                      }
                      className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-normal outline-none focus:border-amber-500"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
        <FormButtons
          loading={loading}
          onClose={onClose}
          submitLabel="Save communication"
        />
      </form>
    </ModalFrame>
  );
}

export function TransferCommunicationModal({
  isOpen,
  onClose,
  member,
  departments,
  staffOptions,
  onSuccess,
}: BaseProps & {
  departments: string[];
  staffOptions: StaffOption[];
}) {
  const [loading, setLoading] = useState(false);
  const [medium, setMedium] = useState<MediumId>("phone");
  const [toDepartment, setToDepartment] = useState("");
  const [assignedToUser, setAssignedToUser] = useState("");
  const [dueAt, setDueAt] = useState(() => futureDateTime(1));
  const matchingStaff = staffOptions.filter(
    (person) =>
      person.department.trim().toLowerCase() ===
      toDepartment.trim().toLowerCase(),
  );

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!toDepartment || !assignedToUser || !dueAt) {
      return toast.error("Choose the receiving department, person, and due time.");
    }
    const form = new FormData(event.currentTarget);
    setLoading(true);
    try {
      const response = await transferWithCommunication(member.id, {
        toDepartment,
        assignedToUser,
        dueAt: new Date(dueAt).toISOString(),
        reason: String(form.get("reason") || ""),
        priority: String(form.get("priority") || "medium") as Priority,
        medium,
        type: String(form.get("type") || "outbound") as
          | "inbound"
          | "outbound",
        outcome: String(form.get("outcome") || "Issue discussed"),
        communicationNotes: String(form.get("communicationNotes") || ""),
      });
      if (!response.success) {
        return toast.error(response.error || "Could not transfer the issue.");
      }
      toast.success("Communication logged and timed follow-up transferred.");
      onClose();
      onSuccess();
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalFrame
      isOpen={isOpen}
      onClose={onClose}
      icon={ArrowRightLeft}
      title="Transfer to another team"
      subtitle="The communication, department handoff, owner, and due time are saved together."
      wide
    >
      <form onSubmit={submit} className="max-h-[78vh] overflow-y-auto p-5 sm:p-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="grid content-start gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm font-semibold text-slate-700">
              Receiving department
              <select
                required
                value={toDepartment}
                onChange={(event) => {
                  setToDepartment(event.target.value);
                  setAssignedToUser("");
                }}
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-normal capitalize text-slate-950 outline-none focus:border-amber-500"
              >
                <option value="">Select team</option>
                {departments.map((department) => (
                  <option key={department} value={department}>
                    {department.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5 text-sm font-semibold text-slate-700">
              Specific person
              <select
                required
                value={assignedToUser}
                onChange={(event) => setAssignedToUser(event.target.value)}
                disabled={!toDepartment}
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-normal text-slate-950 outline-none focus:border-amber-500 disabled:bg-slate-100"
              >
                <option value="">Select owner</option>
                {matchingStaff.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name} · {person.department}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5 text-sm font-semibold text-slate-700">
              Follow up on
              <input
                required
                type="datetime-local"
                value={dueAt}
                onChange={(event) => setDueAt(event.target.value)}
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-normal outline-none focus:border-amber-500"
              />
            </label>
            <label className="space-y-1.5 text-sm font-semibold text-slate-700">
              Priority
              <select
                name="priority"
                defaultValue="medium"
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-normal text-slate-950 outline-none focus:border-amber-500"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </label>
            <Select
              label="Medium"
              value={medium}
              onChange={(value) => setMedium(value as MediumId)}
            >
              {MEDIA.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
            <label className="space-y-1.5 text-sm font-semibold text-slate-700">
              Direction
              <select
                name="type"
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-normal text-slate-950 outline-none"
              >
                <option value="outbound">Outbound</option>
                <option value="inbound">Inbound</option>
              </select>
            </label>
            <label className="space-y-1.5 text-sm font-semibold text-slate-700 sm:col-span-2">
              Outcome
              <select
                name="outcome"
                defaultValue="Issue discussed"
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-normal text-slate-950 outline-none"
              >
                {OUTCOMES.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="space-y-4">
            <NotesField
              name="reason"
              label="What should the receiving person handle?"
              required
              rows={5}
            />
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <p className="mb-3 text-sm font-bold text-blue-950">
                Communication saved with this handoff
              </p>
              <NotesField
                name="communicationNotes"
                label="What was discussed with the customer?"
                required
                rows={6}
              />
            </div>
          </div>
        </div>
        <FormButtons
          loading={loading}
          onClose={onClose}
          submitLabel="Log & transfer"
        />
      </form>
    </ModalFrame>
  );
}

export function DepartmentUpdateModal({
  isOpen,
  onClose,
  member,
  user,
  departments,
  onSuccess,
}: BaseProps & {
  user: { role: string; department: string };
  departments: string[];
}) {
  const [loading, setLoading] = useState(false);
  const [department, setDepartment] = useState(user.department.toLowerCase());
  const isAdmin = ["admin", "superadmin"].includes(
    user.role.trim().toLowerCase(),
  );

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoading(true);
    try {
      const response = await addDepartmentUpdate(member.id, {
        department,
        category: String(form.get("category") || ""),
        status: String(form.get("status") || "in_progress"),
        summary: String(form.get("summary") || ""),
        details: String(form.get("details") || ""),
        nextStep: String(form.get("nextStep") || ""),
      });
      if (!response.success) {
        return toast.error(response.error || "Could not save the update.");
      }
      toast.success("Department status updated.");
      onClose();
      onSuccess();
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalFrame
      isOpen={isOpen}
      onClose={onClose}
      icon={Building2}
      title="Update department status"
      subtitle="Add only your team's current progress and next step."
    >
      <form
        onSubmit={submit}
        className="max-h-[78vh] space-y-5 overflow-y-auto p-5 sm:p-6"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {isAdmin ? (
            <Select
              label="Department"
              value={department}
              onChange={setDepartment}
            >
              {departments.map((item) => (
                <option key={item} value={item}>
                  {item.replace(/_/g, " ")}
                </option>
              ))}
            </Select>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Department
              </p>
              <p className="mt-1 font-bold capitalize text-slate-950">
                {department.replace(/_/g, " ")}
              </p>
            </div>
          )}
          <label className="space-y-1.5 text-sm font-semibold text-slate-700">
            Status
            <select
              name="status"
              defaultValue="in_progress"
              className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-normal text-slate-950 outline-none focus:border-amber-500"
            >
              <option value="not_started">Not started</option>
              <option value="in_progress">In progress</option>
              <option value="waiting">Waiting</option>
              <option value="completed">Completed</option>
              <option value="blocked">Blocked</option>
            </select>
          </label>
        </div>
        <label className="space-y-1.5 text-sm font-semibold text-slate-700">
          Work area (optional)
          <input
            name="category"
            placeholder="Amazon account, brand design, GST, sourcing..."
            className="h-11 w-full rounded-lg border border-slate-300 px-3 font-normal outline-none focus:border-amber-500"
          />
        </label>
        <label className="space-y-1.5 text-sm font-semibold text-slate-700">
          Short status update
          <input
            name="summary"
            required
            placeholder="e.g. Amazon documents submitted"
            className="h-11 w-full rounded-lg border border-slate-300 px-3 font-normal outline-none focus:border-amber-500"
          />
        </label>
        <NotesField name="details" label="Useful details (optional)" />
        <label className="space-y-1.5 text-sm font-semibold text-slate-700">
          Next step (optional)
          <input
            name="nextStep"
            placeholder="e.g. Wait for Amazon verification by Friday"
            className="h-11 w-full rounded-lg border border-slate-300 px-3 font-normal outline-none focus:border-amber-500"
          />
        </label>
        <FormButtons
          loading={loading}
          onClose={onClose}
          submitLabel="Save department update"
        />
      </form>
    </ModalFrame>
  );
}

function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-1.5 text-sm font-semibold text-slate-700">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-normal capitalize text-slate-950 outline-none focus:border-amber-500 focus:ring-3 focus:ring-amber-100"
      >
        {children}
      </select>
    </label>
  );
}

function NotesField({
  name,
  label,
  required = false,
  rows = 3,
}: {
  name: string;
  label: string;
  required?: boolean;
  rows?: number;
}) {
  return (
    <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
      {label}
      <textarea
        name={name}
        required={required}
        rows={rows}
        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal text-slate-950 outline-none focus:border-amber-500 focus:ring-3 focus:ring-amber-100"
      />
    </label>
  );
}

function FormButtons({
  loading,
  onClose,
  submitLabel,
}: {
  loading: boolean;
  onClose: () => void;
  submitLabel: string;
}) {
  return (
    <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5">
      <button
        type="button"
        onClick={onClose}
        className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
      >
        Cancel
      </button>
      <button
        disabled={loading}
        className="rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
      >
        {loading ? "Saving..." : submitLabel}
      </button>
    </div>
  );
}

function futureDateTime(daysFromNow: number) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  date.setHours(10, 0, 0, 0);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
