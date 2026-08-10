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
}: {
  isOpen: boolean;
  onClose: () => void;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="my-6 w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 p-5 sm:p-6">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-950">{title}</h2>
              <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
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
  user: { id: string; role: string };
  contactStaffOptions: Array<{ id: string; name: string; department: string }>;
}) {
  const [loading, setLoading] = useState(false);
  const [medium, setMedium] = useState<MediumId>("phone");
  const [type, setType] = useState<"inbound" | "outbound">("outbound");
  const [health, setHealth] = useState<"healthy" | "warning" | "critical">("healthy");
  const [contactedBy, setContactedBy] = useState(user.id);
  const canAttribute = ["admin", "superadmin"].includes(user.role);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const outcome = String(form.get("outcome") || "Connected");
    const notes = String(form.get("notes") || "").trim();
    if (!notes) return toast.error("Write a short communication note.");

    setLoading(true);
    try {
      const response = await logCallForMember(
        member.id,
        type,
        outcome,
        notes,
        String(form.get("nextConnectDate") || "") || undefined,
        medium,
        Number(form.get("duration") || 0),
        health,
        undefined,
        undefined,
        undefined,
        canAttribute ? contactedBy || undefined : undefined,
      );
      if (!response.success) return toast.error(response.error || "Could not log communication.");
      toast.success("Communication added to the customer journey.");
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
    >
      <form onSubmit={submit} className="max-h-[78vh] space-y-5 overflow-y-auto p-5 sm:p-6">
        {canAttribute && contactStaffOptions.length > 0 && (
          <Select label="Contacted by" value={contactedBy} onChange={setContactedBy}>
            {contactStaffOptions.map((person) => (
              <option key={person.id} value={person.id}>{person.name} · {person.department}</option>
            ))}
          </Select>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Medium" value={medium} onChange={(value) => setMedium(value as MediumId)}>
            {MEDIA.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </Select>
          <Select label="Direction" value={type} onChange={(value) => setType(value as "inbound" | "outbound")}>
            <option value="outbound">Outbound · staff contacted member</option>
            <option value="inbound">Inbound · member contacted us</option>
          </Select>
          <label className="space-y-1.5 text-sm font-semibold text-slate-700">
            Outcome
            <select name="outcome" className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 font-normal text-slate-950 outline-none focus:border-amber-500">
              {OUTCOMES.map((outcome) => <option key={outcome}>{outcome}</option>)}
            </select>
          </label>
          <Select label="Customer health" value={health} onChange={(value) => setHealth(value as typeof health)}>
            <option value="healthy">On track</option>
            <option value="warning">Needs attention</option>
            <option value="critical">Critical</option>
          </Select>
          <label className="space-y-1.5 text-sm font-semibold text-slate-700">
            Duration (minutes)
            <input name="duration" type="number" min="0" defaultValue="5" className="h-11 w-full rounded-xl border border-slate-300 px-3 font-normal outline-none focus:border-amber-500" />
          </label>
          <label className="space-y-1.5 text-sm font-semibold text-slate-700">
            Next follow-up (optional)
            <input name="nextConnectDate" type="date" className="h-11 w-full rounded-xl border border-slate-300 px-3 font-normal outline-none focus:border-amber-500" />
          </label>
        </div>
        <NotesField name="notes" label="What happened and what is the next step?" required />
        <FormButtons loading={loading} onClose={onClose} submitLabel="Save communication" />
      </form>
    </ModalFrame>
  );
}

export function TransferCommunicationModal({
  isOpen,
  onClose,
  member,
  departments,
  onSuccess,
}: BaseProps & { departments: string[] }) {
  const [loading, setLoading] = useState(false);
  const [medium, setMedium] = useState<MediumId>("phone");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoading(true);
    try {
      const response = await transferWithCommunication(member.id, {
        toDepartment: String(form.get("toDepartment") || ""),
        reason: String(form.get("reason") || ""),
        priority: String(form.get("priority") || "medium") as "low" | "medium" | "high" | "urgent",
        medium,
        type: String(form.get("type") || "outbound") as "inbound" | "outbound",
        outcome: String(form.get("outcome") || "Issue discussed"),
        communicationNotes: String(form.get("communicationNotes") || ""),
      });
      if (!response.success) return toast.error(response.error || "Could not transfer the issue.");
      toast.success("Communication logged and issue transferred.");
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
      subtitle="The customer communication and internal handoff are saved together."
    >
      <form onSubmit={submit} className="max-h-[78vh] space-y-5 overflow-y-auto p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm font-semibold text-slate-700">
            Transfer to
            <select name="toDepartment" required className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 font-normal capitalize text-slate-950 outline-none focus:border-amber-500">
              <option value="">Select team</option>
              {departments.map((department) => <option key={department} value={department}>{department.replace(/_/g, " ")}</option>)}
            </select>
          </label>
          <label className="space-y-1.5 text-sm font-semibold text-slate-700">
            Priority
            <select name="priority" defaultValue="medium" className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 font-normal text-slate-950 outline-none focus:border-amber-500">
              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option>
            </select>
          </label>
        </div>
        <NotesField name="reason" label="What issue should the receiving team handle?" required />
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <p className="mb-3 text-sm font-bold text-blue-950">Communication being logged with this transfer</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Medium" value={medium} onChange={(value) => setMedium(value as MediumId)}>
              {MEDIA.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </Select>
            <label className="space-y-1.5 text-sm font-semibold text-slate-700">
              Direction
              <select name="type" className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 font-normal text-slate-950 outline-none">
                <option value="outbound">Outbound</option><option value="inbound">Inbound</option>
              </select>
            </label>
            <label className="space-y-1.5 text-sm font-semibold text-slate-700 sm:col-span-2">
              Outcome
              <select name="outcome" defaultValue="Issue discussed" className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 font-normal text-slate-950 outline-none">
                {OUTCOMES.map((outcome) => <option key={outcome}>{outcome}</option>)}
              </select>
            </label>
            <div className="sm:col-span-2"><NotesField name="communicationNotes" label="What was discussed with the customer?" required /></div>
          </div>
        </div>
        <FormButtons loading={loading} onClose={onClose} submitLabel="Log & transfer" />
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
  const isAdmin = ["admin", "superadmin"].includes(user.role);

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
      if (!response.success) return toast.error(response.error || "Could not save the update.");
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
      <form onSubmit={submit} className="max-h-[78vh] space-y-5 overflow-y-auto p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {isAdmin ? (
            <Select label="Department" value={department} onChange={setDepartment}>
              {departments.map((item) => <option key={item} value={item}>{item.replace(/_/g, " ")}</option>)}
            </Select>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Department</p>
              <p className="mt-1 font-bold capitalize text-slate-950">{department.replace(/_/g, " ")}</p>
            </div>
          )}
          <label className="space-y-1.5 text-sm font-semibold text-slate-700">
            Status
            <select name="status" defaultValue="in_progress" className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 font-normal text-slate-950 outline-none focus:border-amber-500">
              <option value="not_started">Not started</option><option value="in_progress">In progress</option><option value="waiting">Waiting</option><option value="completed">Completed</option><option value="blocked">Blocked</option>
            </select>
          </label>
        </div>
        <label className="space-y-1.5 text-sm font-semibold text-slate-700">
          Work area (optional)
          <input name="category" placeholder="Amazon account, brand design, GST, sourcing..." className="h-11 w-full rounded-xl border border-slate-300 px-3 font-normal outline-none focus:border-amber-500" />
        </label>
        <label className="space-y-1.5 text-sm font-semibold text-slate-700">
          Short status update
          <input name="summary" required placeholder="e.g. Amazon documents submitted" className="h-11 w-full rounded-xl border border-slate-300 px-3 font-normal outline-none focus:border-amber-500" />
        </label>
        <NotesField name="details" label="Useful details (optional)" />
        <label className="space-y-1.5 text-sm font-semibold text-slate-700">
          Next step (optional)
          <input name="nextStep" placeholder="e.g. Wait for Amazon verification by Friday" className="h-11 w-full rounded-xl border border-slate-300 px-3 font-normal outline-none focus:border-amber-500" />
        </label>
        <FormButtons loading={loading} onClose={onClose} submitLabel="Save department update" />
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
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 font-normal capitalize text-slate-950 outline-none focus:border-amber-500 focus:ring-3 focus:ring-amber-100">
        {children}
      </select>
    </label>
  );
}

function NotesField({ name, label, required = false }: { name: string; label: string; required?: boolean }) {
  return (
    <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
      {label}
      <textarea name={name} required={required} rows={3} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal text-slate-950 outline-none focus:border-amber-500 focus:ring-3 focus:ring-amber-100" />
    </label>
  );
}

function FormButtons({ loading, onClose, submitLabel }: { loading: boolean; onClose: () => void; submitLabel: string }) {
  return (
    <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
      <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
      <button disabled={loading} className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60">
        {loading ? "Saving..." : submitLabel}
      </button>
    </div>
  );
}
