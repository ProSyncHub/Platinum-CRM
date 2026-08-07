"use client";

import { useState } from "react";
import { Edit3, X } from "lucide-react";
import { toast } from "sonner";
import { updateCommunicationLog } from "@/app/actions/communicationActions";
import type { AssignableStaffView } from "@/lib/followups";
import {
  normalizeCommunicationMedium,
  type MediumId,
} from "@/lib/membershipUtils";

interface EditableCallLog {
  id: string;
  date: string | Date;
  type: string;
  medium: string;
  outcome: string;
  duration?: number | null;
  notes: string;
  staffUserId?: string | null;
  staffName?: string | null;
  staffEmail?: string | null;
}

interface EditCallLogModalProps {
  log: EditableCallLog;
  memberName: string;
  staff: AssignableStaffView[];
  onClose: () => void;
  onSuccess: () => void;
}

const MEDIUM_OPTIONS: Array<{ value: MediumId; label: string }> = [
  { value: "phone", label: "Phone Call" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "zoom", label: "Zoom 1-on-1" },
  { value: "meet", label: "Google Meet" },
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
  { value: "telegram", label: "Telegram" },
  { value: "in_person", label: "In-Person" },
];

function getEditableMedium(medium: string): MediumId {
  const normalizedMedium = normalizeCommunicationMedium(medium);
  return normalizedMedium && normalizedMedium !== "internal"
    ? normalizedMedium
    : "phone";
}

function toIndiaDateTimeLocal(value: string | Date) {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Kolkata",
  }).formatToParts(date);
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || "";
  return `${getPart("year")}-${getPart("month")}-${getPart("day")}T${getPart("hour")}:${getPart("minute")}`;
}

export default function EditCallLogModal({
  log,
  memberName,
  staff,
  onClose,
  onSuccess,
}: EditCallLogModalProps) {
  const matchingStaff = staff.find(
    (person) =>
      person.id === log.staffUserId ||
      person.email.toLowerCase() === log.staffEmail?.toLowerCase() ||
      person.name.toLowerCase() === log.staffName?.toLowerCase(),
  );
  const [staffUserId, setStaffUserId] = useState(matchingStaff?.id || staff[0]?.id || "");
  const [contactedAt, setContactedAt] = useState(() => toIndiaDateTimeLocal(log.date));
  const [type, setType] = useState<"inbound" | "outbound">(
    log.type === "inbound" ? "inbound" : "outbound",
  );
  const [medium, setMedium] = useState<MediumId>(() => getEditableMedium(log.medium));
  const [outcome, setOutcome] = useState(log.outcome || "");
  const [duration, setDuration] = useState(log.duration || 0);
  const [notes, setNotes] = useState(log.notes || "");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!staffUserId || !outcome.trim() || !notes.trim()) {
      toast.error("Contacted by, outcome, and notes are required.");
      return;
    }

    setLoading(true);
    try {
      const result = await updateCommunicationLog({
        callLogId: log.id,
        contactedAt: new Date(contactedAt).toISOString(),
        type,
        medium,
        outcome,
        duration,
        notes,
        staffUserId,
      });
      if (!result.success) {
        toast.error(result.error || "Unable to update communication");
        return;
      }
      toast.success("Communication history updated");
      onSuccess();
      onClose();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Unable to update communication");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-xs">
      <div className="my-8 w-full max-w-2xl rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-6">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-amber-700">
              <Edit3 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Super Admin Edit</p>
              <h2 className="text-lg font-bold text-slate-900">Edit Communication</h2>
              <p className="mt-0.5 text-xs text-slate-500">Correcting the recorded interaction for {memberName}</p>
            </div>
          </div>
          <button type="button" aria-label="Close communication editor" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="edit-contacted-by" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-700">Contacted by</label>
              <select id="edit-contacted-by" required value={staffUserId} onChange={(event) => setStaffUserId(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm focus:border-amber-500 focus:bg-white focus:outline-none">
                {staff.map((person) => (
                  <option key={person.id} value={person.id}>{person.name} · {person.department}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="edit-contacted-at" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-700">Contact date and time</label>
              <input id="edit-contacted-at" required type="datetime-local" value={contactedAt} onChange={(event) => setContactedAt(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm focus:border-amber-500 focus:bg-white focus:outline-none" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="edit-medium" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-700">Medium</label>
              <select id="edit-medium" value={medium} onChange={(event) => setMedium(event.target.value as MediumId)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-amber-500 focus:outline-none">
                {MEDIUM_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="edit-direction" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-700">Direction</label>
              <select id="edit-direction" value={type} onChange={(event) => setType(event.target.value as typeof type)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-amber-500 focus:outline-none">
                <option value="outbound">Outbound</option>
                <option value="inbound">Inbound</option>
              </select>
            </div>
            <div>
              <label htmlFor="edit-duration" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-700">Duration (minutes)</label>
              <input id="edit-duration" type="number" min={0} max={1440} value={duration} onChange={(event) => setDuration(Number(event.target.value))} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-amber-500 focus:outline-none" />
            </div>
          </div>

          <div>
            <label htmlFor="edit-outcome" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-700">Outcome</label>
            <input id="edit-outcome" required maxLength={200} value={outcome} onChange={(event) => setOutcome(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm focus:border-amber-500 focus:bg-white focus:outline-none" />
          </div>

          <div>
            <label htmlFor="edit-communication-notes" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-700">Communication notes</label>
            <textarea id="edit-communication-notes" required rows={5} maxLength={4000} value={notes} onChange={(event) => setNotes(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm leading-6 focus:border-amber-500 focus:bg-white focus:outline-none" />
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button type="button" onClick={onClose} className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200">Cancel</button>
            <button type="submit" disabled={loading || staff.length === 0} className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50">{loading ? "Saving..." : "Save Communication"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
