"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Clock,
  PhoneCall,
  ArrowRight,
  PauseCircle,
  MessageSquare,
  Flame,
  ChevronRight,
} from "lucide-react";
import {
  getMediumMeta,
  getProgramMeta,
  PLATINUM_STAGES,
} from "@/lib/membershipUtils";
import LogCallModal from "@/components/members/LogCallModal";

interface AttentionTableClientProps {
  initialMembers: any[];
}

export default function AttentionTableClient({
  initialMembers,
}: AttentionTableClientProps) {
  const [activeLogMember, setActiveLogMember] = useState<any | null>(null);

  return (
    <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Members Requiring Managerial & Team Attention
            </h3>
            <p className="text-xs text-slate-500">
              Approaching expiry dates, overdue follow-ups, or uncontacted students
            </p>
          </div>
        </div>

        <Link
          href="/followups"
          className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 hover:text-amber-800 transition-colors"
        >
          <span>Open Full Follow-Up Queue</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50/50">
              <th className="py-3 px-3">Member & Program</th>
              <th className="py-3 px-3">Status / Expiry</th>
              <th className="py-3 px-3">Follow-up Urgency</th>
              <th className="py-3 px-3">Last Reached Via</th>
              <th className="py-3 px-3">Assigned Staff</th>
              <th className="py-3 px-3 text-right">Quick Contact Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {initialMembers.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-500">
                  🎉 No members currently require urgent attention. All memberships healthy!
                </td>
              </tr>
            ) : (
              initialMembers.map((m) => {
                const progMeta = getProgramMeta(
                  m.programType || (m.memberCode?.startsWith("PNP") ? "PNP" : "Platinum")
                );
                const medMeta = getMediumMeta(m.lastContactMedium);

                const cleanPhone = (m.phone || "").replace(/[^0-9+]/g, "");
                const whatsappUrl = `https://wa.me/${cleanPhone.replace(
                  "+",
                  ""
                )}?text=${encodeURIComponent(
                  `Hello ${m.fullName}, this is regarding your ProSync ${progMeta.name} account ${m.memberCode}.`
                )}`;

                return (
                  <tr
                    key={m.id}
                    className="hover:bg-slate-50/80 transition-colors group"
                  >
                    {/* Member Name + Program */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/members/${m.id}`}
                          className="font-bold text-slate-900 hover:text-amber-600 transition-colors"
                        >
                          {m.fullName}
                        </Link>
                        <span
                          className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase border ${progMeta.badgeClass}`}
                        >
                          <span>{progMeta.icon}</span>
                          <span>{progMeta.shortLabel}</span>
                        </span>
                      </div>
                      <div className="font-mono text-[10px] text-slate-500 mt-0.5 font-medium">
                        {m.memberCode}
                      </div>
                    </td>

                    {/* Expiration status */}
                    <td className="py-3 px-3">
                      {m.statusInfo.isExpiringSoon ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[10px] bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
                          <Clock className="w-3 h-3 text-amber-600" />
                          Expiring ({m.statusInfo.daysLeft}d left)
                        </span>
                      ) : m.statusInfo.isExpired ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[10px] bg-red-100 text-red-800 border border-red-200">
                          <AlertTriangle className="w-3 h-3 text-red-600" />
                          Expired
                        </span>
                      ) : m.statusInfo.status === "On Hold" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[10px] bg-blue-100 text-blue-800 border border-blue-200">
                          <PauseCircle className="w-3 h-3 text-blue-600" />
                          On Hold
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Active
                        </span>
                      )}
                    </td>

                    {/* Followup urgency */}
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[10px] border ${m.contactStatus.badgeClass}`}
                      >
                        {m.contactStatus.urgency === "urgent" && <Flame className="w-3 h-3 text-red-600" />}
                        {m.contactStatus.label}
                      </span>
                    </td>

                    {/* Last Reached Medium */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${medMeta.badgeClass}`}>
                          {medMeta.shortLabel}
                        </span>
                        <span className="text-[10px] text-slate-600 font-medium truncate max-w-[100px]">
                          by {m.lastContactStaff || m.allotedTo || "Staff"}
                        </span>
                      </div>
                    </td>

                    {/* Assigned staff */}
                    <td className="py-3 px-3">
                      <span className="text-slate-800 font-semibold">
                        {m.allotedTo || "Unassigned"}
                      </span>
                    </td>

                    {/* Quick Instant Action */}
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {cleanPhone && (
                          <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noreferrer"
                            title="Chat on WhatsApp"
                            className="p-1.5 rounded-lg bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 transition-colors"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </a>
                        )}

                        <button
                          type="button"
                          onClick={() => setActiveLogMember(m)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg shadow-xs transition-all cursor-pointer"
                        >
                          <PhoneCall className="w-3 h-3" />
                          <span>Log Call</span>
                        </button>

                        <Link
                          href={`/members/${m.id}`}
                          className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors"
                          title="View Profile"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Log Call Modal */}
      {activeLogMember && (
        <LogCallModal
          isOpen={!!activeLogMember}
          onClose={() => setActiveLogMember(null)}
          memberId={activeLogMember.id}
          memberName={activeLogMember.fullName}
          memberPhone={activeLogMember.phone}
          onSuccess={() => window.location.reload()}
        />
      )}
    </div>
  );
}
