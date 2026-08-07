"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  MessageSquare,
  Search,
  ExternalLink,
  Edit2,
} from "lucide-react";
import { getMediumMeta, getProgramMeta } from "@/lib/membershipUtils";
import EditCallLogModal from "@/components/members/EditCallLogModal";
import type { AssignableStaffView } from "@/lib/followups";

interface CallsExplorerLog {
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
  staffDepartment?: string | null;
  member?: {
    id: string;
    fullName: string;
    memberCode: string;
    phone?: string | null;
    programType?: string | null;
  } | null;
}

interface CallsExplorerClientProps {
  initialLogs: CallsExplorerLog[];
  stats: {
    totalCalls: number;
    whatsappCount: number;
    phoneCount: number;
    zoomCount: number;
    connectedCount: number;
    connectedRate: number;
  };
  currentUserRole?: string;
  contactStaffOptions?: AssignableStaffView[];
}

export default function CallsExplorerClient({
  initialLogs,
  stats,
  currentUserRole,
  contactStaffOptions = [],
}: CallsExplorerClientProps) {
  const [search, setSearch] = useState("");
  const [selectedMedium, setSelectedMedium] = useState("all");
  const [selectedProgram, setSelectedProgram] = useState("all");
  const [selectedOutcome, setSelectedOutcome] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [editingLog, setEditingLog] = useState<CallsExplorerLog | null>(null);
  const isSuperAdmin = ["admin", "superadmin"].includes(
    currentUserRole?.trim().toLowerCase() || "",
  );

  const filteredLogs = useMemo(() => {
    return initialLogs.filter((log) => {
      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const memberName = (log.member?.fullName || "").toLowerCase();
        const memberCode = (log.member?.memberCode || "").toLowerCase();
        const staffName = (log.staffName || "").toLowerCase();
        const notes = (log.notes || "").toLowerCase();
        const outcome = (log.outcome || "").toLowerCase();
        if (
          !memberName.includes(q) &&
          !memberCode.includes(q) &&
          !staffName.includes(q) &&
          !notes.includes(q) &&
          !outcome.includes(q)
        ) {
          return false;
        }
      }

      // Medium filter
      if (selectedMedium !== "all") {
        const med = (log.medium || "phone").toLowerCase();
        if (selectedMedium === "whatsapp" && !med.includes("whatsapp")) return false;
        if (selectedMedium === "phone" && !med.includes("phone")) return false;
        if (selectedMedium === "zoom" && !med.includes("zoom") && !med.includes("meet")) return false;
        if (selectedMedium === "email" && !med.includes("email")) return false;
      }

      // Program filter
      if (selectedProgram !== "all") {
        const pType = (log.member?.programType || "Platinum").toLowerCase();
        if (selectedProgram === "pnp" && !pType.includes("pnp")) return false;
        if (selectedProgram === "platinum" && !pType.includes("plat")) return false;
      }

      // Outcome filter
      if (selectedOutcome !== "all") {
        const out = (log.outcome || "").toLowerCase();
        if (selectedOutcome === "connected" && !out.includes("connect") && !out.includes("conduct")) return false;
        if (selectedOutcome === "no_answer" && !out.includes("no answer") && !out.includes("busy") && !out.includes("unanswered")) return false;
        if (selectedOutcome === "scheduled" && !out.includes("schedul")) return false;
      }

      // Direction type (inbound vs outbound)
      if (selectedType !== "all") {
        if (log.type !== selectedType) return false;
      }

      return true;
    });
  }, [initialLogs, search, selectedMedium, selectedProgram, selectedOutcome, selectedType]);

  return (
    <div className="space-y-6">
      {/* High-Level KPI Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Total Logged
          </div>
          <div className="mt-1 text-2xl font-black text-slate-900">
            {stats.totalCalls}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
            WhatsApp
          </div>
          <div className="mt-1 text-2xl font-black text-emerald-900">
            {stats.whatsappCount}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
            Phone Calls
          </div>
          <div className="mt-1 text-2xl font-black text-amber-900">
            {stats.phoneCount}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-blue-800">
            Zoom 1-on-1s
          </div>
          <div className="mt-1 text-2xl font-black text-blue-900">
            {stats.zoomCount}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-200 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-purple-800">
            Connected
          </div>
          <div className="mt-1 text-2xl font-black text-purple-900">
            {stats.connectedCount}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-cyan-50/60 border border-cyan-200 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-cyan-800">
            Connect Rate
          </div>
          <div className="mt-1 text-2xl font-black text-cyan-900">
            {stats.connectedRate}%
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-5 rounded-3xl bg-white border border-slate-200/90 shadow-2xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Box */}
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search member, code, staff, or notes..."
              className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-xs font-medium focus:outline-none focus:border-amber-500 focus:bg-white transition-colors"
            />
          </div>

          {/* Medium */}
          <div>
            <select
              value={selectedMedium}
              onChange={(e) => setSelectedMedium(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs font-medium focus:outline-none focus:border-amber-500 focus:bg-white cursor-pointer transition-colors"
            >
              <option value="all">All Mediums</option>
              <option value="whatsapp">💬 WhatsApp</option>
              <option value="phone">📞 Phone Call</option>
              <option value="zoom">🎥 Zoom 1-on-1</option>
              <option value="email">✉️ Email</option>
            </select>
          </div>

          {/* Program */}
          <div>
            <select
              value={selectedProgram}
              onChange={(e) => setSelectedProgram(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs font-medium focus:outline-none focus:border-amber-500 focus:bg-white cursor-pointer transition-colors"
            >
              <option value="all">All Programs</option>
              <option value="platinum">👑 Platinum Elite</option>
              <option value="pnp">⚡ PNP (Plug & Play)</option>
            </select>
          </div>

          {/* Outcome */}
          <div>
            <select
              value={selectedOutcome}
              onChange={(e) => setSelectedOutcome(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs font-medium focus:outline-none focus:border-amber-500 focus:bg-white cursor-pointer transition-colors"
            >
              <option value="all">All Outcomes</option>
              <option value="connected">🟢 Connected / Conducted</option>
              <option value="no_answer">🔴 Busy / No Answer</option>
              <option value="scheduled">🟡 Next Call Scheduled</option>
            </select>
          </div>
        </div>

        {/* Results Counter */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100 font-medium">
          <div>
            Showing <span className="font-bold text-slate-900">{filteredLogs.length}</span> of{" "}
            <span className="font-bold text-slate-900">{initialLogs.length}</span> communication records
          </div>
          {(search || selectedMedium !== "all" || selectedProgram !== "all" || selectedOutcome !== "all") && (
            <button
              onClick={() => {
                setSearch("");
                setSelectedMedium("all");
                setSelectedProgram("all");
                setSelectedOutcome("all");
                setSelectedType("all");
              }}
              className="text-xs font-bold text-amber-700 hover:underline cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Logs Table */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-2xs overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <th className="py-3 px-3">Date & Time</th>
              <th className="py-3 px-3">Member & Program</th>
              <th className="py-3 px-3">Medium & Direction</th>
              <th className="py-3 px-3">Outcome</th>
              <th className="py-3 px-3">Staff / Caller</th>
              <th className="py-3 px-3">Summary & Notes</th>
              <th className="py-3 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs font-medium">
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400">
                  No communication records found matching your filters.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => {
                const medMeta = getMediumMeta(log.medium);
                const progMeta = getProgramMeta(
                  log.member?.programType ||
                    (log.member?.memberCode?.startsWith("PNP") ? "PNP" : "Platinum")
                );

                const cleanPhone = (log.member?.phone || "").replace(/[^0-9+]/g, "");
                const whatsappUrl = `https://wa.me/${cleanPhone.replace("+", "")}?text=${encodeURIComponent(
                  `Hello ${log.member?.fullName}, this is regarding your ${progMeta.name} account ${log.member?.memberCode}.`
                )}`;

                return (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition-colors group">
                    {/* Date */}
                    <td className="py-3.5 px-3 whitespace-nowrap text-slate-700 font-mono text-[11px]">
                      <div>{new Date(log.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}</div>
                      <div className="text-[10px] text-slate-400">
                        {new Date(log.date).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })}
                      </div>
                    </td>

                    {/* Member */}
                    <td className="py-3.5 px-3">
                      {log.member ? (
                        <div>
                          <div className="flex items-center gap-1.5">
                            <Link
                              href={`/members/${log.member.id}`}
                              className="font-bold text-slate-900 hover:text-amber-700 transition-colors"
                            >
                              {log.member.fullName}
                            </Link>
                            <span
                              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase border ${progMeta.badgeClass}`}
                            >
                              <span>{progMeta.icon}</span>
                              <span>{progMeta.shortLabel}</span>
                            </span>
                          </div>
                          <div className="font-mono text-[10px] text-slate-400 mt-0.5">
                            {log.member.memberCode}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400">Deleted Member</span>
                      )}
                    </td>

                    {/* Medium & Type */}
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${medMeta.badgeClass}`}
                        >
                          <span>{medMeta.icon}</span>
                          <span>{medMeta.label}</span>
                        </span>
                        <span className="text-[10px] text-slate-500 capitalize">
                          {log.type}
                        </span>
                      </div>
                    </td>

                    {/* Outcome */}
                    <td className="py-3.5 px-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                        {log.outcome}
                      </span>
                    </td>

                    {/* Staff */}
                    <td className="py-3.5 px-3">
                      <div className="font-bold text-slate-900">
                        {log.staffName || "Staff Member"}
                      </div>
                      {log.staffDepartment && (
                        <div className="text-[10px] text-slate-500 uppercase font-semibold">
                          {log.staffDepartment}
                        </div>
                      )}
                    </td>

                    {/* Notes */}
                    <td className="py-3.5 px-3 max-w-xs text-slate-700 line-clamp-2">
                      {log.notes || "—"}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {cleanPhone && (
                          <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                            title="Chat on WhatsApp"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {log.member && (
                          <Link
                            href={`/members/${log.member.id}`}
                            className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:text-amber-700 hover:bg-slate-200 transition-colors"
                            title="View Full Profile"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                        )}
                        {isSuperAdmin && (
                          <button
                            type="button"
                            onClick={() => setEditingLog(log)}
                            className="rounded-lg border border-amber-200 bg-amber-50 p-1.5 text-amber-700 transition-colors hover:bg-amber-100"
                            title="Edit communication"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {editingLog && isSuperAdmin && (
        <EditCallLogModal
          log={editingLog}
          memberName={editingLog.member?.fullName || "Member"}
          staff={contactStaffOptions}
          onClose={() => setEditingLog(null)}
          onSuccess={() => window.location.reload()}
        />
      )}
    </div>
  );
}
