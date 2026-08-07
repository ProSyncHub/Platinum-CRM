"use client";

import { useState } from "react";
import { CalendarClock, Handshake, X } from "lucide-react";
import { toast } from "sonner";
import { saveMemberServiceReferral } from "@/app/actions/serviceActions";
import {
  SERVICE_REFERRAL_STATUSES,
  type MemberServiceReferralView,
  type ServicePartnerView,
  type ServiceReferralStatus,
} from "@/lib/servicePartners";

interface ServiceReferralModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  memberId: string;
  memberName: string;
  partner: ServicePartnerView;
  referral?: MemberServiceReferralView | null;
}

function toDateTimeLocal(value?: string | Date | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Kolkata",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value || "";

  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

export default function ServiceReferralModal({
  isOpen,
  onClose,
  onSuccess,
  memberId,
  memberName,
  partner,
  referral,
}: ServiceReferralModalProps) {
  const [status, setStatus] = useState<ServiceReferralStatus>(
    (referral?.status as ServiceReferralStatus) || "referred"
  );
  const [ownerName, setOwnerName] = useState(
    referral?.ownerName || partner.contactPerson || partner.providerName
  );
  const [scheduledAt, setScheduledAt] = useState(
    toDateTimeLocal(referral?.scheduledAt)
  );
  const [notes, setNotes] = useState(referral?.notes || "");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const result = await saveMemberServiceReferral({
        memberId,
        partnerId: partner.id,
        status,
        ownerName,
        scheduledAt: scheduledAt || undefined,
        notes,
      });

      if (!result.success) {
        toast.error(result.error || "Unable to save referral");
        return;
      }

      toast.success(referral ? "Service referral updated" : "Service referral created");
      onSuccess();
      onClose();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Unable to save referral");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-3 text-indigo-700">
              <Handshake className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">{referral ? "Update" : "Start"} Partner Service</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {partner.serviceName} for <span className="font-bold text-slate-800">{memberName}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close service referral form"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-5 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-indigo-700">Service partner</p>
          <p className="mt-1 text-base font-bold text-slate-900">{partner.providerName}</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">{partner.description}</p>
          {partner.benefitLabel && (
            <span className="mt-3 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
              {partner.benefitLabel}
            </span>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="service-status" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-700">
                Referral status
              </label>
              <select
                id="service-status"
                value={status}
                onChange={(event) => setStatus(event.target.value as ServiceReferralStatus)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-medium focus:border-indigo-500 focus:bg-white focus:outline-none"
              >
                {Object.entries(SERVICE_REFERRAL_STATUSES).map(([value, meta]) => (
                  <option key={value} value={value}>{meta.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="service-owner" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-700">
                Partner owner
              </label>
              <input
                id="service-owner"
                value={ownerName}
                onChange={(event) => setOwnerName(event.target.value)}
                maxLength={120}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="service-schedule" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-700">
              Consultation / follow-up date
            </label>
            <div className="relative">
              <CalendarClock className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input
                id="service-schedule"
                type="datetime-local"
                value={scheduledAt}
                onChange={(event) => setScheduledAt(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3.5 text-sm focus:border-indigo-500 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="service-notes" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-700">
              Coordination notes
            </label>
            <textarea
              id="service-notes"
              rows={4}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={2000}
              placeholder="Record documents requested, consultation outcome, blockers, or next step."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm leading-6 focus:border-indigo-500 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
            >
              {loading ? "Saving..." : referral ? "Save Update" : "Create Referral"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
