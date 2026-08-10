"use client";

import { useState } from "react";
import { CheckCircle2, MessageSquareText, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { registerMember } from "@/app/actions/workspaceActions";
import type { MediumId } from "@/lib/membershipUtils";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  programs: Array<{ id: string; name: string }>;
  userName: string;
  department: string;
  onCreated: (memberId: string) => void;
}

const MEDIA: Array<{ value: MediumId; label: string }> = [
  { value: "phone", label: "Phone call" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "zoom", label: "Zoom" },
  { value: "in_person", label: "In person" },
  { value: "sms", label: "SMS" },
];

export default function RegisterMemberModal({
  isOpen,
  onClose,
  programs,
  userName,
  department,
  onCreated,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [programType, setProgramType] = useState(programs[0]?.name || "Platinum");
  const [medium, setMedium] = useState<MediumId>("phone");

  if (!isOpen) return null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoading(true);
    try {
      const response = await registerMember({
        firstName: String(form.get("firstName") || ""),
        lastName: String(form.get("lastName") || ""),
        phone: String(form.get("phone") || ""),
        email: String(form.get("email") || ""),
        state: String(form.get("state") || ""),
        programType,
        otherProgram: String(form.get("otherProgram") || ""),
        communicationMedium: medium,
        communicationOutcome: String(form.get("communicationOutcome") || ""),
        communicationNotes: String(form.get("communicationNotes") || ""),
      });
      if (!response.success) {
        toast.error(response.error || "Registration failed.");
        if (response.memberId) onCreated(response.memberId);
        return;
      }
      toast.success(
        response.pendingApproval
          ? "Contact registered and sent to Super Admin for approval."
          : "Member registered successfully.",
      );
      onClose();
      onCreated(response.memberId!);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="my-6 w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 p-6">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-950">Register a new contact</h2>
              <p className="mt-1 text-sm text-slate-500">
                Added by {userName} · {department} department
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[78vh] space-y-6 overflow-y-auto p-6">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-950">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-950 text-xs text-white">1</span>
              Basic details
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First name" name="firstName" required />
              <Field label="Last name" name="lastName" />
              <Field label="Phone number" name="phone" required inputMode="tel" />
              <Field label="Email" name="email" required type="email" />
              <Field label="State / location" name="state" />
              <label className="space-y-1.5 text-sm font-semibold text-slate-700">
                Program or service
                <select
                  value={programType}
                  onChange={(event) => setProgramType(event.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 font-normal text-slate-950 outline-none focus:border-amber-500 focus:ring-3 focus:ring-amber-100"
                >
                  {programs.map((program) => (
                    <option key={program.id} value={program.name}>{program.name}</option>
                  ))}
                  <option value="Other">Other (request approval)</option>
                </select>
              </label>
              {programType === "Other" && (
                <Field label="Requested program / service" name="otherProgram" required />
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-950">
              <MessageSquareText className="h-4 w-4 text-amber-600" />
              Log the first communication (optional)
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 text-sm font-semibold text-slate-700">
                Communication medium
                <select
                  value={medium}
                  onChange={(event) => setMedium(event.target.value as MediumId)}
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 font-normal text-slate-950 outline-none focus:border-amber-500"
                >
                  {MEDIA.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
              <Field label="Outcome" name="communicationOutcome" placeholder="Connected / enquiry received" />
              <label className="space-y-1.5 text-sm font-semibold text-slate-700 sm:col-span-2">
                What happened?
                <textarea
                  name="communicationNotes"
                  rows={3}
                  placeholder="Write only the useful facts, request, and next step."
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal text-slate-950 outline-none focus:border-amber-500 focus:ring-3 focus:ring-amber-100"
                />
              </label>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-xl bg-blue-50 p-3 text-xs leading-5 text-blue-900">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            Staff registrations remain usable immediately for communication and department work. A Super Admin approves the final membership/program status.
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
            <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100">
              Cancel
            </button>
            <button disabled={loading} className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60">
              {loading ? "Saving..." : "Register contact"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
  placeholder,
  inputMode,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  inputMode?: "tel";
}) {
  return (
    <label className="space-y-1.5 text-sm font-semibold text-slate-700">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        inputMode={inputMode}
        className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 font-normal text-slate-950 outline-none focus:border-amber-500 focus:ring-3 focus:ring-amber-100"
      />
    </label>
  );
}
