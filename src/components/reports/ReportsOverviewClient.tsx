"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  BarChart3,
  TrendingUp,
  Users,
  Clock,
  AlertTriangle,
  CheckCircle2,
  PhoneCall,
  MessageSquare,
  Video,
  Shield,
  Layers,
  ArrowRight,
  Settings2,
} from "lucide-react";
import ProgramManagementModal from "@/components/programs/ProgramManagementModal";
import {
  PLATINUM_STAGES,
  PROGRAM_CONFIGS,
  formatINR,
  getMediumMeta,
  getProgramMeta,
} from "@/lib/membershipUtils";

interface ReportsOverviewClientProps {
  members: any[];
  stats: any;
  totalCallLogs: number;
  queryTransfers: any[];
  currentUserRole?: string;
  availablePrograms?: any[];
}

function normalizeProgram(value?: string | null) {
  const normalized = (value || "Platinum").trim().toLowerCase();
  if (normalized.includes("pnp") || normalized.includes("plug")) return "pnp";
  if (normalized.includes("plat")) return "platinum";
  if (
    normalized.includes("amazon") ||
    normalized.includes("wealth") ||
    normalized === "aws" ||
    normalized.includes("shortcut")
  ) return "amazon wealth shortcut";
  return normalized;
}

export default function ReportsOverviewClient({
  members,
  stats,
  totalCallLogs,
  queryTransfers,
  currentUserRole,
  availablePrograms = [],
}: ReportsOverviewClientProps) {
  const [selectedProgram, setSelectedProgram] = useState("all");
  const [programsList, setProgramsList] = useState(availablePrograms);
  const [isProgramModalOpen, setIsProgramModalOpen] = useState(false);
  const isAdmin = currentUserRole?.trim().toLowerCase() === "admin";

  const programOptions = useMemo(() => {
    const byKey = new Map<string, any>();
    programsList.filter((program) => program.active !== false).forEach((program) => {
      byKey.set(normalizeProgram(program.name), program);
    });
    members.forEach((member) => {
      const name = member.programType || "Platinum";
      const key = normalizeProgram(name);
      if (!byKey.has(key)) byKey.set(key, { name, icon: getProgramMeta(name).icon });
    });
    return Array.from(byKey.values());
  }, [members, programsList]);

  // Dynamic calculation of program counts from real member data
  const dynamicProgramCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    programOptions.forEach((program) => { counts[normalizeProgram(program.name)] = 0; });

    members.forEach((m) => {
      const key = normalizeProgram(m.programType);
      counts[key] = (counts[key] || 0) + 1;
    });

    return counts;
  }, [members, programOptions]);

  const filteredMembers = useMemo(() => {
    if (selectedProgram === "all") return members;
    return members.filter((m) => {
      return normalizeProgram(m.programType) === normalizeProgram(selectedProgram);
    });
  }, [members, selectedProgram]);

  // Expiration Cohorts
  const expirationCohorts = useMemo(() => {
    let exp0to15 = 0;
    let exp16to30 = 0;
    let exp31to60 = 0;
    let exp60plus = 0;
    let expired = 0;

    filteredMembers.forEach((m) => {
      if (m.statusInfo?.isExpired) {
        expired++;
      } else if (m.statusInfo?.daysLeft !== null && m.statusInfo?.daysLeft !== undefined) {
        const days = m.statusInfo.daysLeft;
        if (days <= 15) exp0to15++;
        else if (days <= 30) exp16to30++;
        else if (days <= 60) exp31to60++;
        else exp60plus++;
      }
    });

    return { exp0to15, exp16to30, exp31to60, exp60plus, expired };
  }, [filteredMembers]);

  // Stage distribution
  const stageStats = useMemo(() => {
    return PLATINUM_STAGES.map((s) => {
      const count = filteredMembers.filter((m) => m.currentStage === s.id).length;
      const pct = filteredMembers.length > 0 ? Math.round((count / filteredMembers.length) * 100) : 0;
      return { ...s, count, pct };
    });
  }, [filteredMembers]);

  // Contact medium distribution
  const mediumStats = useMemo(() => {
    const counts: Record<string, number> = {
      whatsapp: 0,
      phone: 0,
      zoom: 0,
      email: 0,
    };

    filteredMembers.forEach((m) => {
      const med = (m.lastContactMedium || "phone").toLowerCase();
      if (med.includes("whatsapp")) counts.whatsapp++;
      else if (med.includes("zoom") || med.includes("meet")) counts.zoom++;
      else if (med.includes("email")) counts.email++;
      else counts.phone++;
    });

    const total = filteredMembers.length || 1;
    return [
      { id: "whatsapp", label: "WhatsApp Chat", count: counts.whatsapp, pct: Math.round((counts.whatsapp / total) * 100), color: "bg-emerald-500", icon: "💬" },
      { id: "phone", label: "Voice Phone Calls", count: counts.phone, pct: Math.round((counts.phone / total) * 100), color: "bg-amber-500", icon: "📞" },
      { id: "zoom", label: "Zoom / Meet 1-on-1", count: counts.zoom, pct: Math.round((counts.zoom / total) * 100), color: "bg-blue-500", icon: "🎥" },
      { id: "email", label: "Email Outreach", count: counts.email, pct: Math.round((counts.email / total) * 100), color: "bg-purple-500", icon: "✉️" },
    ];
  }, [filteredMembers]);

  return (
    <div className="space-y-8">
      {/* Program Selector Filter */}
      <div className="p-4 rounded-3xl bg-white border border-slate-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Scope Analytics By Program:
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setSelectedProgram("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedProgram === "all"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200"
              }`}
            >
              All Programs ({members.length})
            </button>
            {programOptions.map((p) => {
                const key = normalizeProgram(p.name);
                const isSelected = normalizeProgram(selectedProgram) === key;
                const count = dynamicProgramCounts[key] ?? 0;
                return (
                  <button
                    key={p.id || p.name}
                    onClick={() => setSelectedProgram(p.name)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isSelected
                        ? "bg-cyan-700 text-white shadow-xs font-black"
                        : "bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200"
                    }`}
                  >
                    <span>{p.icon || "🎯"} {p.name} ({count})</span>
                  </button>
                );
              })}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs text-slate-500 font-medium">
            Showing metrics for <strong className="text-slate-900 font-bold">{filteredMembers.length}</strong> enrolled members
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setIsProgramModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900 transition-colors hover:bg-amber-100"
            >
              <Settings2 className="h-3.5 w-3.5" />
              Manage Programs
            </button>
          )}
        </div>
      </div>

      <ProgramManagementModal
        isOpen={isProgramModalOpen}
        onClose={() => setIsProgramModalOpen(false)}
        programs={programsList}
        onProgramsUpdated={setProgramsList}
        currentUserRole={currentUserRole}
      />

      {/* Expiration Timeline Section */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-2xs space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-600" />
              6-Month Expiration & Retention Forecast
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Automated lifecycle clock based on 180-day membership enrollment validity
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-center">
            <div className="text-[11px] font-bold text-red-800 uppercase">
              🔥 &lt; 15 Days
            </div>
            <div className="text-2xl font-black text-red-900 mt-1">
              {expirationCohorts.exp0to15}
            </div>
            <div className="text-[10px] text-red-600 mt-0.5 font-semibold">Urgent Renewal</div>
          </div>

          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-center">
            <div className="text-[11px] font-bold text-amber-800 uppercase">
              ⚠️ 15–30 Days
            </div>
            <div className="text-2xl font-black text-amber-900 mt-1">
              {expirationCohorts.exp16to30}
            </div>
            <div className="text-[10px] text-amber-700 mt-0.5 font-semibold">Prepare Retention</div>
          </div>

          <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-center">
            <div className="text-[11px] font-bold text-blue-800 uppercase">
              📅 30–60 Days
            </div>
            <div className="text-2xl font-black text-blue-900 mt-1">
              {expirationCohorts.exp31to60}
            </div>
            <div className="text-[10px] text-blue-700 mt-0.5 font-semibold">Active Mid-Term</div>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
            <div className="text-[11px] font-bold text-emerald-800 uppercase">
              🟢 60+ Days
            </div>
            <div className="text-2xl font-black text-emerald-900 mt-1">
              {expirationCohorts.exp60plus}
            </div>
            <div className="text-[10px] text-emerald-700 mt-0.5 font-semibold">Healthy Runway</div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200 text-center">
            <div className="text-[11px] font-bold text-slate-700 uppercase">
              ❌ Expired
            </div>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {expirationCohorts.expired}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5 font-semibold">Past Expiration</div>
          </div>
        </div>
      </div>

      {/* Two Column Grid: Stage Progression Funnel & Cross-Channel Outreach */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stage Progression Funnel */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-2xs space-y-4">
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-amber-600" />
            5-Stage Mentorship Journey Funnel
          </h2>
          <p className="text-xs text-slate-500">
            Current member distribution across milestone stages
          </p>

          <div className="space-y-3 pt-2">
            {stageStats.map((st) => (
              <div key={st.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800">
                    {st.number}: {st.name}
                  </span>
                  <span className="font-bold text-slate-900">
                    {st.count} members ({st.pct}%)
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(st.pct, 4)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cross-Channel Contact Medium Breakdown */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-2xs space-y-4">
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-emerald-600" />
            Communication Channels Used
          </h2>
          <p className="text-xs text-slate-500">
            Last contact channel breakdown across WhatsApp, Calls & Zoom sessions
          </p>

          <div className="space-y-3 pt-2">
            {mediumStats.map((m) => (
              <div key={m.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <span>{m.icon}</span>
                    <span>{m.label}</span>
                  </span>
                  <span className="font-bold text-slate-900">
                    {m.count} members ({m.pct}%)
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                  <div
                    className={`h-full ${m.color} rounded-full transition-all duration-500`}
                    style={{ width: `${Math.max(m.pct, 4)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
