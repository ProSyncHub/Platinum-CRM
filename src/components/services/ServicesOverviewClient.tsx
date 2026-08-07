"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Gift,
  Handshake,
  Search,
  Store,
  Users,
} from "lucide-react";
import {
  SERVICE_REFERRAL_STATUSES,
  getServiceReferralStatusMeta,
  type MemberServiceReferralView,
  type ServicePartnerView,
} from "@/lib/servicePartners";

interface ServiceOverviewReferral extends MemberServiceReferralView {
  member: {
    id: string;
    memberCode: string;
    fullName: string;
    phone: string;
    email: string;
    department?: string | null;
    programType: string;
  };
}

interface ServicesOverviewClientProps {
  partners: ServicePartnerView[];
  referrals: ServiceOverviewReferral[];
}

export default function ServicesOverviewClient({
  partners,
  referrals,
}: ServicesOverviewClientProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [partnerId, setPartnerId] = useState("all");

  const filteredReferrals = useMemo(() => {
    const query = search.trim().toLowerCase();
    return referrals.filter((referral) => {
      if (status !== "all" && referral.status !== status) return false;
      if (partnerId !== "all" && referral.partnerId !== partnerId) return false;
      if (!query) return true;
      return [
        referral.member.fullName,
        referral.member.memberCode,
        referral.member.phone,
        referral.member.email,
        referral.partner.serviceName,
        referral.partner.providerName,
        referral.ownerName,
      ].some((value) => value?.toLowerCase().includes(query));
    });
  }, [partnerId, referrals, search, status]);

  const activeCount = referrals.filter(
    (referral) => !["completed", "cancelled"].includes(referral.status)
  ).length;
  const scheduledCount = referrals.filter(
    (referral) => referral.status === "consultation_scheduled"
  ).length;
  const completedCount = referrals.filter(
    (referral) => referral.status === "completed"
  ).length;

  return (
    <div className="space-y-6 pb-12">
      <header className="flex flex-col justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-xs sm:flex-row sm:items-center">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-700">
            <Handshake className="h-4 w-4" />
            Specialist Partner Network
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
            Partner Services & Referral Pipeline
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage partner handoffs, consultations, owners, progress, and completion from one queue.
          </p>
        </div>
        <Link
          href="/members"
          className="inline-flex items-center gap-2 self-start rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-slate-800"
        >
          Start from a Member
          <ArrowRight className="h-4 w-4 text-amber-400" />
        </Link>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        {partners.map((partner) => (
          <article key={partner.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-2.5 text-indigo-700">
                  <Store className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900">{partner.serviceName}</h2>
                  <p className="text-sm font-semibold text-indigo-700">{partner.providerName}</p>
                </div>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold uppercase text-slate-600">
                {partner.category.replaceAll("_", " ")}
              </span>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-600">{partner.description}</p>
            {partner.benefitLabel && (
              <p className="mt-3 flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                <Gift className="h-4 w-4" />
                {partner.benefitLabel}
              </p>
            )}
          </article>
        ))}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Referrals", value: referrals.length, icon: Users, color: "text-slate-700 bg-slate-50 border-slate-200" },
          { label: "Active Pipeline", value: activeCount, icon: Handshake, color: "text-indigo-700 bg-indigo-50 border-indigo-200" },
          { label: "Consultations Booked", value: scheduledCount, icon: CalendarClock, color: "text-violet-700 bg-violet-50 border-violet-200" },
          { label: "Completed", value: completedCount, icon: CheckCircle2, color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className={`rounded-2xl border p-4 ${item.color}`}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wide">{item.label}</p>
                <Icon className="h-4 w-4" />
              </div>
              <p className="mt-2 text-2xl font-black">{item.value}</p>
            </div>
          );
        })}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Referral Operations Queue</h2>
            <p className="text-xs text-slate-500">Showing {filteredReferrals.length} of {referrals.length} referrals</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                aria-label="Search referrals"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search member or partner"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs focus:border-indigo-500 focus:bg-white focus:outline-none"
              />
            </div>
            <select
              aria-label="Filter by service partner"
              value={partnerId}
              onChange={(event) => setPartnerId(event.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium focus:border-indigo-500 focus:outline-none"
            >
              <option value="all">All services</option>
              {partners.map((partner) => (
                <option key={partner.id} value={partner.id}>{partner.serviceName}</option>
              ))}
            </select>
            <select
              aria-label="Filter by referral status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium focus:border-indigo-500 focus:outline-none"
            >
              <option value="all">All statuses</option>
              {Object.entries(SERVICE_REFERRAL_STATUSES).map(([value, meta]) => (
                <option key={value} value={value}>{meta.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <th className="px-3 py-3">Member</th>
                <th className="px-3 py-3">Service & Partner</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Partner Owner</th>
                <th className="px-3 py-3">Scheduled</th>
                <th className="px-3 py-3">Last Updated</th>
                <th className="px-3 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredReferrals.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-12 text-center text-sm text-slate-500">
                    No referrals match the current filters.
                  </td>
                </tr>
              ) : (
                filteredReferrals.map((referral) => {
                  const statusMeta = getServiceReferralStatusMeta(referral.status);
                  return (
                    <tr key={referral.id} className="hover:bg-slate-50/80">
                      <td className="px-3 py-3.5">
                        <Link href={`/members/${referral.member.id}`} className="font-bold text-slate-900 hover:text-indigo-700">
                          {referral.member.fullName}
                        </Link>
                        <p className="mt-0.5 font-mono text-[10px] text-slate-500">{referral.member.memberCode}</p>
                      </td>
                      <td className="px-3 py-3.5">
                        <p className="font-bold text-slate-800">{referral.partner.serviceName}</p>
                        <p className="mt-0.5 text-[10px] font-semibold text-indigo-700">via {referral.partner.providerName}</p>
                      </td>
                      <td className="px-3 py-3.5">
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${statusMeta.badgeClass}`}>
                          {statusMeta.label}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 font-medium text-slate-700">{referral.ownerName || referral.partner.providerName}</td>
                      <td className="px-3 py-3.5 text-slate-600">
                        {referral.scheduledAt
                          ? new Date(referral.scheduledAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })
                          : "Not scheduled"}
                      </td>
                      <td className="px-3 py-3.5 text-slate-600">
                        {new Date(referral.updatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}
                        {referral.updatedByName && <p className="mt-0.5 text-[10px]">by {referral.updatedByName}</p>}
                      </td>
                      <td className="px-3 py-3.5 text-right">
                        <Link
                          href={`/members/${referral.member.id}`}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 font-bold text-white hover:bg-slate-800"
                        >
                          Open Member
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
