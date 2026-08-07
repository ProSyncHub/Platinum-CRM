import Link from "next/link";
import { ArrowRight, Handshake } from "lucide-react";
import { getServiceReferralStatusMeta } from "@/lib/servicePartners";

interface PipelineReferral {
  id: string;
  status: string;
  ownerName?: string | null;
  member: {
    id: string;
    fullName: string;
    memberCode: string;
  };
  partner: {
    serviceName: string;
    providerName: string;
  };
}
interface PartnerServicePipelineSummaryProps {
  activeCount: number;
  referrals: PipelineReferral[];
}

export default function PartnerServicePipelineSummary({
  activeCount,
  referrals,
}: PartnerServicePipelineSummaryProps) {
  return (
    <section className="rounded-3xl border border-indigo-200 bg-indigo-50/40 p-6 shadow-xs">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-indigo-200 bg-white p-2 text-indigo-700">
            <Handshake className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Partner Service Pipeline</h2>
            <p className="mt-0.5 text-xs text-slate-600">
              Amazon account opening, GST consultations, and specialist handoffs.
            </p>
          </div>
        </div>
        <Link
          href="/services"
          className="inline-flex items-center gap-1.5 self-start rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800"
        >
          Open Pipeline
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[150px_1fr]">
        <div className="rounded-2xl border border-indigo-200 bg-white p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">Active Referrals</p>
          <p className="mt-1 text-3xl font-black text-slate-900">{activeCount}</p>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          {referrals.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-indigo-200 bg-white/70 p-4 text-xs text-slate-600 md:col-span-2">
              No partner referrals have been started yet. Open a member profile to begin one.
            </div>
          ) : (
            referrals.map((referral) => {
              const statusMeta = getServiceReferralStatusMeta(referral.status);
              return (
                <Link
                  key={referral.id}
                  href={`/members/${referral.member.id}`}
                  className="rounded-2xl border border-indigo-100 bg-white p-3 transition-colors hover:border-indigo-300"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-slate-900">{referral.member.fullName}</p>
                      <p className="mt-0.5 text-[10px] font-semibold text-indigo-700">
                        {referral.partner.serviceName} · {referral.partner.providerName}
                      </p>
                    </div>
                    <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${statusMeta.badgeClass}`}>
                      {statusMeta.label}
                    </span>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
