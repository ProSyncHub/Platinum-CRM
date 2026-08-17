"use client";

import { useEffect, useState } from "react";
import { ArrowRightLeft, X } from "lucide-react";
import { getStaffDirectory } from "@/app/actions/memberActions";
import { transferWithCommunication } from "@/app/actions/workspaceActions";
import type { MediumId } from "@/lib/membershipUtils";
import { toast } from "sonner";

interface StaffOption {
  id: string;
  name: string;
  email: string;
  department: string;
  role: string;
}

interface TransferQueryModalProps {
  isOpen: boolean;
  onClose: () => void;
  memberId: string;
  memberName: string;
  currentDept?: string;
  onSuccess: () => void;
  staffList?: StaffOption[];
}

type Priority = "low" | "medium" | "high" | "urgent";

const DEPARTMENTS = [
  { id: "ecom", label: "E-Commerce" },
  { id: "sourcing", label: "Sourcing & Brands" },
  { id: "brand", label: "Brand Management" },
  { id: "research", label: "Product Research" },
  { id: "onboarding", label: "Onboarding" },
  { id: "support", label: "Customer Support" },
  { id: "sales", label: "Sales & Accounts" },
  { id: "management", label: "Management" },
];

const MEDIA: Array<{ id: MediumId; label: string }> = [
  { id: "phone", label: "Phone call" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "email", label: "Email" },
  { id: "zoom", label: "Zoom" },
  { id: "meet", label: "Google Meet" },
  { id: "in_person", label: "In person" },
  { id: "sms", label: "SMS" },
];

export default function TransferQueryModal({
  isOpen,
  onClose,
  memberId,
  memberName,
  currentDept,
  onSuccess,
  staffList: initialStaffList = [],
}: TransferQueryModalProps) {
  void currentDept;
  const [staffList, setStaffList] = useState(initialStaffList);
  const [toDepartment, setToDepartment] = useState("");
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueAt, setDueAt] = useState(() => localDateTime(1));
  const [medium, setMedium] = useState<MediumId>("phone");
  const [type, setType] = useState<"outbound" | "inbound">("outbound");
  const [outcome, setOutcome] = useState("Issue discussed");
  const [reason, setReason] = useState("");
  const [communicationNotes, setCommunicationNotes] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || staffList.length > 0) return;
    let active = true;
    getStaffDirectory().then((result) => {
      if (active && result.success) setStaffList(result.users);
    });
    return () => {
      active = false;
    };
  }, [isOpen, staffList.length]);

  if (!isOpen) return null;

  const filteredStaff = staffList.filter(
    (person) =>
      person.department.trim().toLowerCase() ===
      toDepartment.trim().toLowerCase(),
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !toDepartment ||
      !selectedStaffId ||
      !dueAt ||
      !reason.trim() ||
      !communicationNotes.trim()
    ) {
      return toast.error(
        "Choose the department, person, due time, and add both notes.",
      );
    }

    setLoading(true);
    try {
      const result = await transferWithCommunication(memberId, {
        toDepartment,
        assignedToUser: selectedStaffId,
        dueAt: new Date(dueAt).toISOString(),
        reason: reason.trim(),
        priority,
        medium,
        type,
        outcome,
        communicationNotes: communicationNotes.trim(),
      });
      if (!result.success) {
        return toast.error(result.error || "Could not transfer the follow-up.");
      }
      toast.success("Communication logged and follow-up transferred.");
      onSuccess();
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="my-6 w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
              <ArrowRightLeft className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-950">
                Transfer follow-up
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {memberName} · save the communication and handoff together
              </p>
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

        <form
          onSubmit={handleSubmit}
          className="max-h-[80vh] overflow-y-auto p-5 sm:p-6"
        >
          <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="grid content-start gap-4 sm:grid-cols-2">
              <Field label="Receiving department">
                <select
                  required
                  value={toDepartment}
                  onChange={(event) => {
                    setToDepartment(event.target.value);
                    setSelectedStaffId("");
                  }}
                  className={inputClass}
                >
                  <option value="">Select department</option>
                  {DEPARTMENTS.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Specific person">
                <select
                  required
                  value={selectedStaffId}
                  onChange={(event) => setSelectedStaffId(event.target.value)}
                  disabled={!toDepartment}
                  className={inputClass}
                >
                  <option value="">Select owner</option>
                  {filteredStaff.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name} · {person.department}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Follow up on">
                <input
                  required
                  type="datetime-local"
                  value={dueAt}
                  onChange={(event) => setDueAt(event.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Priority">
                <select
                  value={priority}
                  onChange={(event) =>
                    setPriority(event.target.value as Priority)
                  }
                  className={inputClass}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </Field>
              <Field label="Medium">
                <select
                  value={medium}
                  onChange={(event) =>
                    setMedium(event.target.value as MediumId)
                  }
                  className={inputClass}
                >
                  {MEDIA.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Direction">
                <select
                  value={type}
                  onChange={(event) =>
                    setType(event.target.value as "inbound" | "outbound")
                  }
                  className={inputClass}
                >
                  <option value="outbound">Outbound</option>
                  <option value="inbound">Inbound</option>
                </select>
              </Field>
              <div className="sm:col-span-2">
                <Field label="Outcome">
                  <select
                    value={outcome}
                    onChange={(event) => setOutcome(event.target.value)}
                    className={inputClass}
                  >
                    <option>Issue discussed</option>
                    <option>Follow-up required</option>
                    <option>Callback requested</option>
                    <option>Information shared</option>
                    <option>No answer</option>
                  </select>
                </Field>
              </div>
            </div>

            <div className="space-y-4">
              <Field label="What should the receiving person handle?">
                <textarea
                  required
                  rows={6}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className={`${inputClass} h-auto py-3`}
                />
              </Field>
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <Field label="What was discussed with the customer?">
                  <textarea
                    required
                    rows={6}
                    value={communicationNotes}
                    onChange={(event) =>
                      setCommunicationNotes(event.target.value)
                    }
                    className={`${inputClass} h-auto py-3`}
                  />
                </Field>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? "Saving..." : "Log & transfer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputClass =
  "h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-950 outline-none focus:border-violet-500 focus:ring-3 focus:ring-violet-100 disabled:bg-slate-100";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
      {label}
      {children}
    </label>
  );
}

function localDateTime(daysFromNow: number) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  date.setHours(10, 0, 0, 0);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
