"use client";

import { useState } from "react";
import {
  X,
  PhoneCall,
  Calendar,
  Clock,
  MessageSquare,
  Video,
  Mail,
  Smartphone,
  Users,
  Flame,
  Send,
  ShieldAlert,
} from "lucide-react";
import { logCallForMember } from "@/app/actions/memberActions";
import { MediumId } from "@/lib/membershipUtils";
import { toast } from "sonner";
import type { AssignableStaffView } from "@/lib/followups";

interface LogCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  memberId: string;
  memberName: string;
  memberPhone?: string;
  followupTaskId?: string;
  currentUserRole?: string;
  currentUserId?: string;
  contactStaffOptions?: AssignableStaffView[];
  onSuccess: () => void;
}

const MEDIUM_OPTIONS: {
  id: MediumId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}[] = [
  { id: "phone", label: "Phone Call", icon: PhoneCall, color: "emerald" },
  { id: "whatsapp", label: "WhatsApp", icon: MessageSquare, color: "green" },
  { id: "zoom", label: "Zoom 1-on-1", icon: Video, color: "blue" },
  { id: "email", label: "Email", icon: Mail, color: "indigo" },
  { id: "sms", label: "SMS", icon: Smartphone, color: "purple" },
  { id: "in_person", label: "In-Person", icon: Users, color: "amber" },
];

const OUTCOME_PRESETS = [
  "Weekly Mentorship Check-in Conducted",
  "Connected & Discussed Progress",
  "1-on-1 Strategy Session Conducted",
  "Milestone Review Completed",
  "Sourcing / Brand Guidance Provided",
  "Left Voicemail / Followup Sent",
  "Busy / Callback Requested",
  "Critical Blocker / Query Escalated",
];

const NOTE_TEMPLATES = [
  "Weekly follow-up conducted. Member progressing well with listing optimization and ads setup.",
  "Reviewed product research on Helium 10. Guidance provided on brand shortlist validation.",
  "1-on-1 strategy session completed. Advised on brand outreach, invoice approval, and stock planning.",
  "Member facing supplier blocker. Escalating to Sourcing team for direct intervention.",
];

const DEPARTMENTS = [
  { id: "ecom", label: "E-Commerce Team" },
  { id: "sourcing", label: "Sourcing & Brand Approvals" },
  { id: "research", label: "Product & Market Research" },
  { id: "support", label: "Customer Support & Operations" },
  { id: "sales", label: "Sales & Accounts" },
  { id: "management", label: "Executive Management" },
];

export default function LogCallModal({
  isOpen,
  onClose,
  memberId,
  memberName,
  memberPhone,
  followupTaskId,
  currentUserRole,
  currentUserId,
  contactStaffOptions = [],
  onSuccess,
}: LogCallModalProps) {
  const canOverrideAttribution = ["admin", "superadmin"].includes(
    currentUserRole?.trim().toLowerCase() || "",
  );
  const [medium, setMedium] = useState<MediumId>("whatsapp");
  const [type, setType] = useState<"outbound" | "inbound">("outbound");
  const [outcome, setOutcome] = useState("Weekly Mentorship Check-in Conducted");
  const [duration, setDuration] = useState<number>(15);
  const [notes, setNotes] = useState("");
  const [contactedByUserId, setContactedByUserId] = useState(
    contactStaffOptions.some((person) => person.id === currentUserId)
      ? currentUserId || ""
      : contactStaffOptions[0]?.id || "",
  );
  const [contactedAt, setContactedAt] = useState(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60_000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 16);
  });

  // Weekly cadence default: next follow-up in 7 days
  const defaultNextDate = new Date();
  defaultNextDate.setDate(defaultNextDate.getDate() + 7);
  const [nextConnectDate, setNextConnectDate] = useState(defaultNextDate.toISOString().split("T")[0]);

  // Health Rating & Team Escalation
  const [healthStatus, setHealthStatus] = useState<"healthy" | "warning" | "critical">("healthy");
  const [escalateDepartment, setEscalateDepartment] = useState<string>("none");
  const [escalationReason, setEscationReason] = useState("");

  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const setQuickDate = (daysFromNow: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    setNextConnectDate(d.toISOString().split("T")[0]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notes.trim()) {
      toast.error("Please add interaction notes summarizing the discussion.");
      return;
    }

    if (healthStatus === "critical" && escalateDepartment === "none") {
      toast.error("Please select a target department to notify for this critical blocker.");
      return;
    }

    setLoading(true);
    try {
      const res = await logCallForMember(
        memberId,
        type,
        outcome,
        notes,
        nextConnectDate || undefined,
        medium,
        duration,
        healthStatus,
        escalateDepartment !== "none" ? escalateDepartment : undefined,
        escalationReason || notes,
        followupTaskId,
        canOverrideAttribution ? contactedByUserId || undefined : undefined,
        canOverrideAttribution ? new Date(contactedAt).toISOString() : undefined,
      );

      if (res.success) {
        if (healthStatus === "critical" && escalateDepartment !== "none") {
          toast.success(`Weekly check-in logged & Critical Escalation dispatched to ${escalateDepartment.toUpperCase()} team!`);
        } else {
          toast.success("Weekly follow-up interaction logged successfully!");
        }
        onSuccess();
        onClose();
      } else {
        toast.error(res.error || "Failed to log interaction");
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-700 border border-amber-200">
              <PhoneCall className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">Log Follow-Up & Interaction</h2>
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold uppercase border border-amber-200">
                  Weekly Cadence
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Recording communication for <span className="text-slate-900 font-bold">{memberName}</span>
                {memberPhone && ` • ${memberPhone}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {canOverrideAttribution && contactStaffOptions.length > 0 && (
            <div className="grid gap-4 rounded-2xl border border-violet-200 bg-violet-50/60 p-4 sm:grid-cols-2">
              <div>
                <label htmlFor="contacted-by-user" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-violet-800">
                  Contacted by
                </label>
                <select
                  id="contacted-by-user"
                  required
                  value={contactedByUserId}
                  onChange={(event) => setContactedByUserId(event.target.value)}
                  className="w-full rounded-xl border border-violet-200 bg-white px-3.5 py-2.5 text-sm focus:border-violet-500 focus:outline-none"
                >
                  {contactStaffOptions.map((person) => (
                    <option key={person.id} value={person.id}>{person.name} · {person.department}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="contacted-at" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-violet-800">
                  Contact date and time
                </label>
                <input
                  id="contacted-at"
                  required
                  type="datetime-local"
                  value={contactedAt}
                  onChange={(event) => setContactedAt(event.target.value)}
                  className="w-full rounded-xl border border-violet-200 bg-white px-3.5 py-2.5 text-sm focus:border-violet-500 focus:outline-none"
                />
              </div>
              <p className="text-[10px] font-medium text-violet-700 sm:col-span-2">
                Super Admin entry: use the staff member who actually contacted the member.
              </p>
            </div>
          )}

          {/* 1. Medium Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Communication Medium *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {MEDIUM_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isSelected = medium === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setMedium(opt.id)}
                    className={`p-3 rounded-2xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                      isSelected
                        ? "bg-amber-50 border-amber-400 ring-2 ring-amber-400/40 text-amber-900 shadow-xs"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isSelected ? "text-amber-600" : "text-slate-400"}`} />
                    <span className="text-xs font-bold">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Direction & Outcome */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Interaction Direction
              </label>
              <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setType("outbound")}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    type === "outbound"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Outbound (Staff)
                </button>
                <button
                  type="button"
                  onClick={() => setType("inbound")}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    type === "inbound"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Inbound (Member)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Interaction Outcome *
              </label>
              <select
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:border-amber-500 focus:bg-white font-medium"
              >
                {OUTCOME_PRESETS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 3. Duration */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>Call / Session Duration</span>
              </label>
              <span className="text-xs font-mono font-bold text-amber-700">
                {duration} Minutes
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="90"
              step="5"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value))}
              className="w-full accent-amber-500 bg-slate-200 h-2 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>Quick Note (0m)</span>
              <span>15m</span>
              <span>30m</span>
              <span>45m</span>
              <span>60m+ (1-on-1 Session)</span>
            </div>
          </div>

          {/* 4. Student Health & Progress Rating */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
              Student Health & Progression Status
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setHealthStatus("healthy");
                  setEscalateDepartment("none");
                }}
                className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                  healthStatus === "healthy"
                    ? "bg-emerald-50 border-emerald-300 ring-2 ring-emerald-400/40 text-emerald-900 shadow-xs"
                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                <div className="text-base mb-0.5">🟢</div>
                <div className="text-xs font-bold">Healthy</div>
                <div className="text-[10px] text-slate-500">On Track</div>
              </button>

              <button
                type="button"
                onClick={() => setHealthStatus("warning")}
                className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                  healthStatus === "warning"
                    ? "bg-amber-50 border-amber-300 ring-2 ring-amber-400/40 text-amber-900 shadow-xs"
                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                <div className="text-base mb-0.5">🟡</div>
                <div className="text-xs font-bold">Needs Help</div>
                <div className="text-[10px] text-slate-500">Minor Blocker</div>
              </button>

              <button
                type="button"
                onClick={() => setHealthStatus("critical")}
                className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                  healthStatus === "critical"
                    ? "bg-red-50 border-red-300 ring-2 ring-red-400/40 text-red-900 shadow-xs"
                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                <div className="text-base mb-0.5">🔴</div>
                <div className="text-xs font-bold">Critical Blocker</div>
                <div className="text-[10px] text-slate-500">Escalate to Team</div>
              </button>
            </div>

            {/* If Warning or Critical -> Select Department to Notify */}
            {(healthStatus === "critical" || healthStatus === "warning") && (
              <div className="pt-3 border-t border-slate-200 space-y-3 animate-in fade-in">
                <div className="flex items-center gap-2 text-red-700 text-xs font-bold">
                  <ShieldAlert className="w-4 h-4 text-red-600" />
                  <span>Notify & Escalate Query to Related Department:</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Target Department *
                    </label>
                    <select
                      value={escalateDepartment}
                      onChange={(e) => setEscalateDepartment(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs focus:outline-none focus:border-red-500 font-medium"
                    >
                      <option value="none">Select Department...</option>
                      {DEPARTMENTS.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Escalation Priority
                    </label>
                    <div className="px-3 py-2 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs font-bold flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5 text-red-600" />
                      <span>{healthStatus === "critical" ? "URGENT / CRITICAL" : "HIGH PRIORITY"}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Specific Blocker Description for the Team
                  </label>
                  <input
                    type="text"
                    value={escalationReason}
                    onChange={(e) => setEscationReason(e.target.value)}
                    placeholder="e.g. Sourcing approval pending for 8 days; supplier authorization needed"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs placeholder-slate-400 focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 5. Notes & Quick Templates */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Follow-Up & Discussion Notes *
              </label>
              <span className="text-[11px] text-slate-500">Quick Templates:</span>
            </div>

            {/* Preset template chips */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {NOTE_TEMPLATES.map((tmpl, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setNotes(tmpl)}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[10px] text-slate-700 hover:text-slate-900 border border-slate-200 transition-colors cursor-pointer text-left truncate max-w-xs font-medium"
                >
                  {tmpl}
                </button>
              ))}
            </div>

            <textarea
              required
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detail the discussion, milestones reviewed, student queries answered, and next steps..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white text-xs leading-relaxed"
            />
          </div>

          {/* 6. Next Weekly Cadence Scheduler */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-600" />
                <span>Next Follow-Up Date (Weekly Cadence)</span>
              </label>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setQuickDate(7)}
                  className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300 rounded-lg text-[10px] font-bold cursor-pointer transition-colors"
                >
                  Next Week (+7d)
                </button>
                <button
                  type="button"
                  onClick={() => setQuickDate(3)}
                  className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[10px] cursor-pointer transition-colors font-medium"
                >
                  In 3 Days
                </button>
                <button
                  type="button"
                  onClick={() => setQuickDate(1)}
                  className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[10px] cursor-pointer transition-colors font-medium"
                >
                  Tomorrow
                </button>
              </div>
            </div>

            <input
              type="date"
              value={nextConnectDate}
              onChange={(e) => setNextConnectDate(e.target.value)}
              className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:border-amber-500 font-medium"
            />
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5 text-amber-400" />
              <span>{loading ? "Recording..." : "Save & Complete Check-In"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
