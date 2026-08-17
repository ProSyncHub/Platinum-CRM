"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  MessageSquareText,
  PhoneCall,
  Send,
  X,
} from "lucide-react";
import {
  getStaffDirectory,
  logCallForMember,
} from "@/app/actions/memberActions";
import type { MediumId } from "@/lib/membershipUtils";
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

type Priority = "low" | "medium" | "high" | "urgent";

const MEDIUM_OPTIONS: Array<{ id: MediumId; label: string }> = [
  { id: "phone", label: "Phone call" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "zoom", label: "Zoom 1-on-1" },
  { id: "meet", label: "Google Meet" },
  { id: "email", label: "Email" },
  { id: "sms", label: "SMS" },
  { id: "in_person", label: "In person" },
];

const OUTCOMES = [
  "Connected",
  "Follow-up required",
  "Callback requested",
  "Issue discussed",
  "Information shared",
  "No answer",
  "Resolved",
  "Weekly mentorship check-in completed",
];

const DEPARTMENTS = [
  { id: "ecom", label: "E-Commerce" },
  { id: "sourcing", label: "Sourcing & Brands" },
  { id: "research", label: "Product Research" },
  { id: "brand", label: "Brand Management" },
  { id: "support", label: "Customer Support" },
  { id: "sales", label: "Sales & Accounts" },
  { id: "management", label: "Management" },
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
  const [staffOptions, setStaffOptions] =
    useState<AssignableStaffView[]>(contactStaffOptions);
  const [viewer, setViewer] = useState({
    id: currentUserId || "",
    role: currentUserRole || "employee",
    department: "operations",
  });
  const [medium, setMedium] = useState<MediumId>("phone");
  const [type, setType] = useState<"outbound" | "inbound">("outbound");
  const [outcome, setOutcome] = useState("Connected");
  const [duration, setDuration] = useState(5);
  const [notes, setNotes] = useState("");
  const [healthStatus, setHealthStatus] = useState<
    "healthy" | "warning" | "critical"
  >("healthy");
  const [escalateDepartment, setEscalateDepartment] = useState("none");
  const [escalationReason, setEscalationReason] = useState("");
  const [contactedByUserId, setContactedByUserId] = useState(
    currentUserId || "",
  );
  const [contactedAt, setContactedAt] = useState(() => localDateTime(0));
  const [scheduleFollowUp, setScheduleFollowUp] = useState(false);
  const [followUpOwner, setFollowUpOwner] = useState(currentUserId || "");
  const [followUpDueAt, setFollowUpDueAt] = useState(() => localDateTime(1));
  const [followUpPriority, setFollowUpPriority] =
    useState<Priority>("medium");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    getStaffDirectory().then((result) => {
      if (!active || !result.success) return;
      setStaffOptions(result.users);
      if (result.currentUser) {
        setViewer({
          id: result.currentUser.id,
          role: result.currentUser.role,
          department: result.currentUser.department,
        });
        setContactedByUserId((value) => value || result.currentUser?.id || "");
        setFollowUpOwner((value) => value || result.currentUser?.id || "");
      }
    });
    return () => {
      active = false;
    };
  }, [isOpen]);

  const normalizedRole = viewer.role.trim().toLowerCase();
  const canOverrideAttribution = ["admin", "superadmin"].includes(normalizedRole);
  const availableFollowUpOwners = useMemo(() => {
    if (["admin", "superadmin", "manager"].includes(normalizedRole)) {
      return staffOptions;
    }
    return staffOptions.filter(
      (person) =>
        person.department.trim().toLowerCase() ===
        viewer.department.trim().toLowerCase(),
    );
  }, [normalizedRole, staffOptions, viewer.department]);

  if (!isOpen) return null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!notes.trim()) {
      return toast.error("Add a short note about the communication.");
    }
    if (healthStatus === "critical" && escalateDepartment === "none") {
      return toast.error("Choose a department for the critical issue.");
    }
    if (scheduleFollowUp && (!followUpOwner || !followUpDueAt)) {
      return toast.error("Choose who will follow up and when.");
    }

    setLoading(true);
    try {
      const result = await logCallForMember(
        memberId,
        type,
        outcome,
        notes.trim(),
        undefined,
        medium,
        duration,
        healthStatus,
        escalateDepartment !== "none" ? escalateDepartment : undefined,
        escalationReason.trim() || notes.trim(),
        followupTaskId,
        canOverrideAttribution ? contactedByUserId || undefined : undefined,
        canOverrideAttribution
          ? new Date(contactedAt).toISOString()
          : undefined,
        scheduleFollowUp
          ? {
              assignedToUser: followUpOwner,
              dueAt: new Date(followUpDueAt).toISOString(),
              priority: followUpPriority,
              title: `Call ${memberName} again`,
              instructions: notes.trim(),
            }
          : undefined,
      );

      if (!result.success) {
        return toast.error(result.error || "Could not save communication.");
      }
      toast.success(
        scheduleFollowUp
          ? "Communication saved and next follow-up assigned."
          : "Communication saved.",
      );
      onSuccess();
      onClose();
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="my-6 w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
              <PhoneCall className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-950">
                Log communication
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {memberName}
                {memberPhone ? ` · ${memberPhone}` : ""}
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
              {canOverrideAttribution && staffOptions.length > 0 && (
                <>
                  <Field label="Contacted by">
                    <select
                      required
                      value={contactedByUserId}
                      onChange={(event) =>
                        setContactedByUserId(event.target.value)
                      }
                      className={inputClass}
                    >
                      {staffOptions.map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.name} · {person.department}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Contact date and time">
                    <input
                      required
                      type="datetime-local"
                      value={contactedAt}
                      onChange={(event) => setContactedAt(event.target.value)}
                      className={inputClass}
                    />
                  </Field>
                </>
              )}
              <Field label="Medium">
                <select
                  value={medium}
                  onChange={(event) =>
                    setMedium(event.target.value as MediumId)
                  }
                  className={inputClass}
                >
                  {MEDIUM_OPTIONS.map((option) => (
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
                  <option value="outbound">Outbound - staff contacted member</option>
                  <option value="inbound">Inbound - member contacted us</option>
                </select>
              </Field>
              <Field label="Outcome">
                <select
                  value={outcome}
                  onChange={(event) => {
                    const value = event.target.value;
                    setOutcome(value);
                    if (
                      value === "Follow-up required" ||
                      value === "Callback requested"
                    ) {
                      setScheduleFollowUp(true);
                    }
                  }}
                  className={inputClass}
                >
                  {OUTCOMES.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </Field>
              <Field label="Duration (minutes)">
                <input
                  type="number"
                  min="0"
                  value={duration}
                  onChange={(event) => setDuration(Number(event.target.value))}
                  className={inputClass}
                />
              </Field>
              <Field label="Customer health">
                <select
                  value={healthStatus}
                  onChange={(event) =>
                    setHealthStatus(
                      event.target.value as
                        | "healthy"
                        | "warning"
                        | "critical",
                    )
                  }
                  className={inputClass}
                >
                  <option value="healthy">On track</option>
                  <option value="warning">Needs attention</option>
                  <option value="critical">Critical</option>
                </select>
              </Field>
              {(healthStatus === "warning" ||
                healthStatus === "critical") && (
                <div className="sm:col-span-2">
                  <Field label="Notify department">
                    <select
                      value={escalateDepartment}
                      onChange={(event) =>
                        setEscalateDepartment(event.target.value)
                      }
                      className={inputClass}
                    >
                      <option value="none">No department notification</option>
                      {DEPARTMENTS.map((department) => (
                        <option key={department.id} value={department.id}>
                          {department.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <Field label="What happened and what is the next step?">
                <textarea
                  required
                  rows={8}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Discussion, member response, action taken, and next step..."
                  className={`${inputClass} h-auto py-3`}
                />
              </Field>
              {escalateDepartment !== "none" && (
                <Field label="Issue for the notified department">
                  <textarea
                    rows={3}
                    value={escalationReason}
                    onChange={(event) =>
                      setEscalationReason(event.target.value)
                    }
                    className={`${inputClass} h-auto py-3`}
                  />
                </Field>
              )}

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={scheduleFollowUp}
                    onChange={(event) =>
                      setScheduleFollowUp(event.target.checked)
                    }
                    className="mt-1 h-4 w-4 accent-amber-600"
                  />
                  <span>
                    <span className="block text-sm font-bold text-slate-950">
                      Follow-up required
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-600">
                      Create the next owned call in Overview and Follow-ups.
                    </span>
                  </span>
                </label>
                {scheduleFollowUp && (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Field label="By whom">
                      <select
                        required
                        value={followUpOwner}
                        onChange={(event) =>
                          setFollowUpOwner(event.target.value)
                        }
                        className={inputClass}
                      >
                        <option value="">Select owner</option>
                        {availableFollowUpOwners.map((person) => (
                          <option key={person.id} value={person.id}>
                            {person.id === viewer.id ? "Myself" : person.name} ·{" "}
                            {person.department}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="When">
                      <input
                        required
                        type="datetime-local"
                        value={followUpDueAt}
                        onChange={(event) =>
                          setFollowUpDueAt(event.target.value)
                        }
                        className={inputClass}
                      />
                    </Field>
                    <div className="sm:col-span-2">
                      <Field label="Priority">
                        <select
                          value={followUpPriority}
                          onChange={(event) =>
                            setFollowUpPriority(
                              event.target.value as Priority,
                            )
                          }
                          className={inputClass}
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                          <option value="urgent">Urgent</option>
                        </select>
                      </Field>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between gap-3 border-t border-slate-100 pt-5">
            <div className="hidden items-center gap-2 text-xs text-slate-500 sm:flex">
              <CalendarClock className="h-4 w-4 text-amber-600" />
              Follow-ups include a named owner and exact due time.
            </div>
            <div className="ml-auto flex gap-3">
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
                className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {scheduleFollowUp ? (
                  <Send className="h-4 w-4 text-amber-400" />
                ) : (
                  <MessageSquareText className="h-4 w-4 text-amber-400" />
                )}
                {loading ? "Saving..." : "Save communication"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputClass =
  "h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-950 outline-none focus:border-amber-500 focus:ring-3 focus:ring-amber-100";

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
  if (daysFromNow > 0) date.setHours(10, 0, 0, 0);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
