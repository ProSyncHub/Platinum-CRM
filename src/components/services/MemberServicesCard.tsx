"use client";

import { useState } from "react";
import { CalendarClock, Gift, Handshake, ReceiptText, Store } from "lucide-react";
import {
  getServiceReferralStatusMeta,
  type MemberServiceReferralView,
  type ServicePartnerView,
} from "@/lib/servicePartners";
import ServiceReferralModal from "@/components/services/ServiceReferralModal";

interface MemberServicesCardProps {
  memberId: string;
  memberName: string;
  partners: ServicePartnerView[];
  referrals: MemberServiceReferralView[];
  onSuccess: () => void;
}

export default function MemberServicesCard({
  memberId,
  memberName,
  partners,
  referrals,
  onSuccess,
}: MemberServicesCardProps) {
  const [selectedPartner, setSelectedPartner] = useState<ServicePartnerView | null>(null);

  return (
    <>
      <section className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs">
        <div className="mb-4 flex items-start gap-3">
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-2 text-indigo-700">
            <Handshake className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
              Third-Party Services & Referrals
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Coordinate specialist services and preserve every handoff in the member journey.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {partners.map((partner) => {
            const referral = referrals.find((item) => item.partnerId === partner.id) || null;
            const statusMeta = getServiceReferralStatusMeta(referral?.status);
            const ServiceIcon = partner.serviceCode === "GST_CONSULTATION" ? ReceiptText : Store;

            return (
              <article key={partner.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl border border-slate-200 bg-white p-2 text-slate-700">
                      <ServiceIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{partner.serviceName}</p>
                      <p className="mt-0.5 text-xs font-semibold text-indigo-700">via {partner.providerName}</p>
                    </div>
                  </div>
                  {referral && (
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${statusMeta.badgeClass}`}>
                      {statusMeta.label}
                    </span>
                  )}
                </div>

                <p className="mt-3 text-xs leading-5 text-slate-600">{partner.description}</p>

                {partner.benefitLabel && (
                  <div className="mt-3 flex items-center gap-1.5 text-[11px] font-bold text-emerald-800">
                    <Gift className="h-3.5 w-3.5" />
                    {partner.benefitLabel}
                  </div>
                )}

                {referral && (
                  <div className="mt-3 space-y-1.5 rounded-xl border border-slate-200 bg-white p-3 text-[11px] text-slate-600">
                    <p>
                      Partner owner: <span className="font-bold text-slate-800">{referral.ownerName || partner.contactPerson || partner.providerName}</span>
                    </p>
                    {referral.scheduledAt && (
                      <p className="flex items-center gap-1.5">
                        <CalendarClock className="h-3.5 w-3.5 text-indigo-600" />
                        {new Date(referral.scheduledAt).toLocaleString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: "Asia/Kolkata",
                        })}
                      </p>
                    )}
                    {referral.notes && <p className="line-clamp-2">{referral.notes}</p>}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedPartner(partner)}
                  className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-slate-800"
                >
                  {referral ? "Update Referral" : "Start Referral"}
                </button>
              </article>
            );
          })}
        </div>
      </section>

      {selectedPartner && (
        <ServiceReferralModal
          key={`${selectedPartner.id}-${referrals.find((item) => item.partnerId === selectedPartner.id)?.updatedAt || "new"}`}
          isOpen
          onClose={() => setSelectedPartner(null)}
          onSuccess={onSuccess}
          memberId={memberId}
          memberName={memberName}
          partner={selectedPartner}
          referral={referrals.find((item) => item.partnerId === selectedPartner.id) || null}
        />
      )}
    </>
  );
}
