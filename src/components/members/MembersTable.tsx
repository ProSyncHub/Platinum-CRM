"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  Filter,
  PhoneCall,
  SendHorizontal,
  ArrowRightCircle,
  MoreVertical,
  Edit2,
  Calendar,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Building2,
  DollarSign,
  UserCheck,
  TrendingUp,
  Download,
  Flame,
  PauseCircle,
  Sparkles,
  MessageSquare,
  Video,
  Mail,
  Phone,
  Layers,
} from "lucide-react";
import AddMemberModal from "./AddMemberModal";
import EditMemberModal from "./EditMemberModal";
import LogCallModal from "./LogCallModal";
import TransferQueryModal from "./TransferQueryModal";
import AdvanceStageModal from "./AdvanceStageModal";
import ProgramManagementModal from "@/components/programs/ProgramManagementModal";
import {
  PLATINUM_STAGES,
  formatINR,
  getMediumMeta,
  getContactAttentionStatus,
  getProgramMeta,
  PROGRAM_CONFIGS,
} from "@/lib/membershipUtils";

interface MembersTableProps {
  initialMembers: any[];
  stats: any;
  userRole?: string;
  userDepartment?: string;
  initialPrograms?: any[];
}

export default function MembersTable({
  initialMembers,
  stats,
  userRole = "employee",
  userDepartment = "operations",
  initialPrograms = [
    { name: "Platinum", codePrefix: "PLT", icon: "👑", badgeColor: "amber" },
    { name: "PNP", codePrefix: "PNP", icon: "⚡", badgeColor: "cyan" },
    { name: "Amazon Wealth Shortcut", codePrefix: "AWS", icon: "🚀", badgeColor: "purple" },
  ],
}: MembersTableProps) {
  const [members, setMembers] = useState(initialMembers);
  const [programsList, setProgramsList] = useState(initialPrograms);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProgram, setSelectedProgram] = useState("all");
  const [selectedStage, setSelectedStage] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedMedium, setSelectedMedium] = useState("all");
  const [selectedUrgency, setSelectedUrgency] = useState("all");
  const [selectedExecutive, setSelectedExecutive] = useState("all");
  const [selectedState, setSelectedState] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isProgramModalOpen, setIsProgramModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<any | null>(null);
  const [callLoggingMember, setCallLoggingMember] = useState<any | null>(null);
  const [transferringMember, setTransferringMember] = useState<any | null>(null);
  const [stageAdvancingMember, setStageAdvancingMember] = useState<any | null>(null);
  const isAdmin = userRole?.trim().toLowerCase() === "admin";
  const canManagePayments = ["admin", "manager"].includes(
    userRole?.trim().toLowerCase() || ""
  );

  // Dynamic program counts
  const dynamicProgramCounts = useMemo(() => {
    const counts: Record<string, number> = {
      Platinum: 0,
      PNP: 0,
      "Amazon Wealth Shortcut": 0,
    };

    programsList.forEach((p) => {
      if (p.name && counts[p.name] === undefined) {
        counts[p.name] = 0;
      }
    });

    members.forEach((m) => {
      const raw = m.programType || "Platinum";
      let key = raw;
      if (raw.toLowerCase().includes("pnp") || raw.toLowerCase().includes("plug")) {
        key = "PNP";
      } else if (raw.toLowerCase().includes("plat")) {
        key = "Platinum";
      } else if (
        raw.toLowerCase().includes("amazon") ||
        raw.toLowerCase().includes("wealth") ||
        raw.toLowerCase().includes("aws") ||
        raw.toLowerCase().includes("shortcut")
      ) {
        key = "Amazon Wealth Shortcut";
      }
      counts[key] = (counts[key] || 0) + 1;
    });

    return counts;
  }, [members, programsList]);

  // Filtered members calculation
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      // Program filter
      if (selectedProgram !== "all") {
        const prog = (m.programType || "Platinum").toLowerCase();
        const sel = selectedProgram.toLowerCase();
        if (sel === "pnp" && !(prog.includes("pnp") || prog.includes("plug"))) return false;
        if ((sel === "platinum" || sel === "plat") && !prog.includes("plat")) return false;
        if (
          (sel.includes("amazon") || sel.includes("wealth") || sel === "aws" || sel.includes("shortcut")) &&
          !(prog.includes("amazon") || prog.includes("wealth") || prog.includes("aws") || prog.includes("shortcut"))
        ) {
          return false;
        }
        if (sel !== "pnp" && sel !== "platinum" && !sel.includes("amazon") && prog !== sel) {
          return false;
        }
      }

      // Search
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matchesName = m.fullName?.toLowerCase().includes(q);
        const matchesPhone = m.phone?.includes(q);
        const matchesCode = m.memberCode?.toLowerCase().includes(q);
        const matchesProgram = m.programType?.toLowerCase().includes(q);
        const matchesBrand =
          m.plBrand?.toLowerCase().includes(q) ||
          m.resellingBrand?.toLowerCase().includes(q) ||
          m.brandCollaborations?.toLowerCase().includes(q);
        const matchesStaff = m.allotedTo?.toLowerCase().includes(q);
        const matchesNotes = m.notes?.toLowerCase().includes(q);

        if (
          !matchesName &&
          !matchesPhone &&
          !matchesCode &&
          !matchesProgram &&
          !matchesBrand &&
          !matchesStaff &&
          !matchesNotes
        ) {
          return false;
        }
      }

      // Stage filter
      if (selectedStage !== "all" && m.currentStage !== selectedStage) {
        return false;
      }

      // Status filter
      if (selectedStatus !== "all") {
        if (
          selectedStatus === "active" &&
          m.statusInfo?.status !== "Active" &&
          m.statusInfo?.status !== "Expiring Soon"
        )
          return false;
        if (selectedStatus === "expiring_soon" && !m.statusInfo?.isExpiringSoon)
          return false;
        if (
          selectedStatus === "expired" &&
          !m.statusInfo?.isExpired &&
          m.statusInfo?.status !== "Expired"
        )
          return false;
        if (selectedStatus === "on_hold" && m.statusInfo?.status !== "On Hold")
          return false;
      }

      // Medium filter
      if (selectedMedium !== "all") {
        const med = (m.lastContactMedium || "phone").toLowerCase();
        if (med !== selectedMedium.toLowerCase()) return false;
      }

      // Urgency filter
      if (selectedUrgency !== "all") {
        const cStatus =
          m.contactStatus ||
          getContactAttentionStatus(m.lastConnectDate, m.nextConnectDate);
        if (cStatus.urgency !== selectedUrgency) return false;
      }

      // Executive filter
      if (
        selectedExecutive !== "all" &&
        m.allotedTo?.toLowerCase() !== selectedExecutive.toLowerCase()
      ) {
        return false;
      }

      // State filter
      if (selectedState !== "all" && m.state !== selectedState) {
        return false;
      }

      return true;
    });
  }, [
    members,
    searchTerm,
    selectedProgram,
    selectedStage,
    selectedStatus,
    selectedMedium,
    selectedUrgency,
    selectedExecutive,
    selectedState,
  ]);

  const pageCount = Math.max(1, Math.ceil(filteredMembers.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const visibleMembers = filteredMembers.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      "Member Code",
      "Program",
      "Full Name",
      "Phone",
      "Email",
      "State",
      "Enrollment Date",
      "End Date",
      "Days Left",
      "Status",
      "Stage",
      "Assigned To",
      "Last Medium",
      "Last Contacted By",
      "Business Type",
      "Brands",
      "Sales",
      "Notes",
    ];

    const rows = filteredMembers.map((m) => [
      `"${m.memberCode}"`,
      `"${m.programType || "Platinum"}"`,
      `"${m.fullName}"`,
      `"${m.phone}"`,
      `"${m.email || ""}"`,
      `"${m.state || ""}"`,
      `"${m.enrollingDate ? new Date(m.enrollingDate).toLocaleDateString() : ""}"`,
      `"${m.endDate ? new Date(m.endDate).toLocaleDateString() : ""}"`,
      `"${m.statusInfo?.daysLeft ?? ""}"`,
      `"${m.statusInfo?.status || m.activeStatus}"`,
      `"${m.currentStage || "Onboarding"}"`,
      `"${m.allotedTo || ""}"`,
      `"${m.lastContactMedium || "phone"}"`,
      `"${m.lastContactStaff || ""}"`,
      `"${m.businessType || ""}"`,
      `"${(m.brandCollaborations || m.plBrand || "").replace(/"/g, '""')}"`,
      `"${m.salesData || ""}"`,
      `"${(m.notes || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `ProSync_Members_${selectedProgram}_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const reloadData = () => {
    window.location.reload();
  };

  const platinumCount = stats?.platinumCount ?? members.filter((m) => !(m.programType || "").toLowerCase().includes("pnp")).length;
  const pnpCount = stats?.pnpCount ?? members.filter((m) => (m.programType || "").toLowerCase().includes("pnp")).length;

  return (
    <div className="space-y-6">
      {/* Top Banner & KPI Stat Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Total Registry
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-slate-900">
              {stats?.totalMembers || members.length}
            </span>
            <span className="text-xs text-slate-500 font-medium">All Members</span>
          </div>
        </div>

        {/* Platinum Members KPI */}
        <div
          onClick={() => setSelectedProgram(selectedProgram === "Platinum" ? "all" : "Platinum")}
          className={`p-4 rounded-2xl border shadow-xs cursor-pointer transition-all ${
            selectedProgram === "Platinum"
              ? "bg-amber-50 border-amber-300 ring-2 ring-amber-400/40"
              : "bg-white border-slate-200 hover:border-amber-300"
          }`}
        >
          <p className="text-xs font-bold text-amber-700 uppercase tracking-wider flex items-center justify-between">
            <span>👑 Platinum</span>
            {selectedProgram === "Platinum" && (
              <span className="text-[10px] bg-amber-500 text-slate-950 px-1.5 py-0.2 rounded font-extrabold">Active Filter</span>
            )}
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-slate-900">
              {platinumCount}
            </span>
            <span className="text-xs text-amber-700 font-medium">VIP Tier</span>
          </div>
        </div>

        {/* PNP Members KPI */}
        <div
          onClick={() => setSelectedProgram(selectedProgram === "PNP" ? "all" : "PNP")}
          className={`p-4 rounded-2xl border shadow-xs cursor-pointer transition-all ${
            selectedProgram === "PNP"
              ? "bg-cyan-50 border-cyan-300 ring-2 ring-cyan-400/40"
              : "bg-white border-slate-200 hover:border-cyan-300"
          }`}
        >
          <p className="text-xs font-bold text-cyan-700 uppercase tracking-wider flex items-center justify-between">
            <span>⚡ PNP Stores</span>
            {selectedProgram === "PNP" && (
              <span className="text-[10px] bg-cyan-600 text-white px-1.5 py-0.2 rounded font-extrabold">Active Filter</span>
            )}
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-slate-900">
              {pnpCount}
            </span>
            <span className="text-xs text-cyan-700 font-medium">Plug & Play</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs">
          <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
            Active Status
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-slate-900">
              {stats?.activeCount || 0}
            </span>
            <span className="text-xs text-emerald-700 font-medium">Enrolled</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs">
          <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">
            Expiring Soon
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-slate-900">
              {stats?.expiringSoonCount || 0}
            </span>
            <span className="text-xs text-amber-700 font-medium">&lt;30 days</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs">
          <p className="text-xs font-bold text-purple-700 uppercase tracking-wider">
            Total Revenue
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-purple-700">
              {formatINR(stats?.totalRevenue || 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Program Selector Tabs Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-1.5 rounded-2xl bg-white border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setSelectedProgram("all")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedProgram === "all"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>All Programs ({members.length})</span>
          </button>

          <button
            onClick={() => setSelectedProgram("Platinum")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedProgram === "Platinum"
                ? "bg-amber-500 text-slate-950 font-extrabold shadow-xs"
                : "text-amber-700 hover:text-amber-800 hover:bg-amber-50"
            }`}
          >
            <span>👑 Platinum Elite ({dynamicProgramCounts["Platinum"] ?? 0})</span>
          </button>

          <button
            onClick={() => setSelectedProgram("PNP")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedProgram === "PNP"
                ? "bg-cyan-600 text-white font-extrabold shadow-xs"
                : "text-cyan-700 hover:text-cyan-800 hover:bg-cyan-50"
            }`}
          >
            <span>⚡ PNP ({dynamicProgramCounts["PNP"] ?? 0})</span>
          </button>

          <button
            onClick={() => setSelectedProgram("Amazon Wealth Shortcut")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedProgram.toLowerCase().includes("amazon") || selectedProgram.toLowerCase().includes("wealth") || selectedProgram.toLowerCase().includes("aws")
                ? "bg-purple-600 text-white font-extrabold shadow-xs"
                : "text-purple-700 hover:text-purple-800 hover:bg-purple-50"
            }`}
          >
            <span>🚀 Amazon Wealth Shortcut ({dynamicProgramCounts["Amazon Wealth Shortcut"] ?? 0})</span>
          </button>

          {/* Custom Programs */}
          {programsList
            .filter(
              (p) =>
                p.name !== "Platinum" &&
                p.name !== "PNP" &&
                p.name !== "Amazon Wealth Shortcut"
            )
            .map((p) => {
              const isSelected = selectedProgram.toLowerCase() === p.name.toLowerCase();
              const count = dynamicProgramCounts[p.name] ?? 0;
              return (
                <button
                  key={p.id || p.name}
                  onClick={() => setSelectedProgram(p.name)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isSelected
                      ? "bg-slate-800 text-white font-extrabold shadow-xs"
                      : "text-slate-700 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  <span>{p.icon || "🎯"}</span>
                  <span>{p.name} ({count})</span>
                </button>
              );
            })}
        </div>

        {/* Admin Manage Programs Trigger */}
        {isAdmin && (
          <button
            onClick={() => setIsProgramModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 font-bold text-xs transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Manage Programs</span>
          </button>
        )}
      </div>

      {/* Main Table Card */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-5">
        {/* Top Controls: Search, Add Member, Export */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, phone, code, program, brand, staff or note..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white text-xs transition-colors font-medium"
            />
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs border border-slate-200 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 text-amber-400" />
              <span>Enroll Member</span>
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2 border-t border-slate-100">
          {/* Status Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Membership Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs focus:outline-none focus:border-amber-500 focus:bg-white cursor-pointer font-medium"
            >
              <option value="all">All Statuses ({members.length})</option>
              <option value="active">Active ({stats?.activeCount || 0})</option>
              <option value="expiring_soon">Expiring Soon (&lt;30d)</option>
              <option value="expired">Expired ({stats?.expiredCount || 0})</option>
              <option value="on_hold">On Hold ({stats?.onHoldCount || 0})</option>
            </select>
          </div>

          {/* Stage Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              5-Stage Journey
            </label>
            <select
              value={selectedStage}
              onChange={(e) => setSelectedStage(e.target.value)}
              className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs focus:outline-none focus:border-amber-500 focus:bg-white cursor-pointer font-medium"
            >
              <option value="all">All Stages</option>
              {PLATINUM_STAGES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.number}: {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Contact Medium Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Contact Channel
            </label>
            <select
              value={selectedMedium}
              onChange={(e) => setSelectedMedium(e.target.value)}
              className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs focus:outline-none focus:border-amber-500 focus:bg-white cursor-pointer font-medium"
            >
              <option value="all">All Mediums</option>
              <option value="phone">📞 Phone Call</option>
              <option value="whatsapp">💬 WhatsApp</option>
              <option value="zoom">🎥 Zoom 1-on-1</option>
              <option value="email">📧 Email</option>
              <option value="sms">📱 SMS</option>
            </select>
          </div>

          {/* Contact Urgency Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Follow-Up Urgency
            </label>
            <select
              value={selectedUrgency}
              onChange={(e) => setSelectedUrgency(e.target.value)}
              className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs focus:outline-none focus:border-amber-500 focus:bg-white cursor-pointer font-medium"
            >
              <option value="all">All Follow-ups</option>
              <option value="urgent">🔥 Overdue / Inactive</option>
              <option value="due_soon">⚠️ Due Soon / Today</option>
              <option value="healthy">🟢 Healthy / Contacted</option>
            </select>
          </div>

          {/* Executive Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Assigned Executive
            </label>
            <select
              value={selectedExecutive}
              onChange={(e) => setSelectedExecutive(e.target.value)}
              className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs focus:outline-none focus:border-amber-500 focus:bg-white cursor-pointer font-medium"
            >
              <option value="all">All Executives</option>
              {stats?.executives?.map((exec: string) => (
                <option key={exec} value={exec}>
                  {exec}
                </option>
              ))}
            </select>
          </div>

          {/* State Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              State / Location
            </label>
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs focus:outline-none focus:border-amber-500 focus:bg-white cursor-pointer font-medium"
            >
              <option value="all">All States</option>
              {stats?.states?.map((st: string) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Members Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50/50">
                <th className="py-3 px-3">Member & Code</th>
                <th className="py-3 px-3">Status / Expiry</th>
                <th className="py-3 px-3">Contact Recency</th>
                <th className="py-3 px-3">Journey Stage</th>
                <th className="py-3 px-3">Assigned Staff</th>
                <th className="py-3 px-3">Brand & Sales</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    No members matched the selected filters.
                  </td>
                </tr>
              ) : (
                visibleMembers.map((m) => {
                  const stageObj =
                    PLATINUM_STAGES.find((s) => s.id === m.currentStage) ||
                    PLATINUM_STAGES[0];

                  const cStatus =
                    m.contactStatus ||
                    getContactAttentionStatus(m.lastConnectDate, m.nextConnectDate);

                  const medMeta = getMediumMeta(m.lastContactMedium);
                  const progMeta = getProgramMeta(m.programType || (m.memberCode?.startsWith("PNP") ? "PNP" : "Platinum"));

                  const cleanPhone = (m.phone || "").replace(/[^0-9+]/g, "");
                  const whatsappUrl = `https://wa.me/${cleanPhone.replace(
                    "+",
                    ""
                  )}?text=${encodeURIComponent(
                    `Hello ${m.fullName}, this is from ProSync ${progMeta.name} Support regarding your account ${m.memberCode}.`
                  )}`;

                  return (
                    <tr
                      key={m.id}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* Member Info */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/members/${m.id}`}
                            className="font-bold text-slate-900 hover:text-amber-600 transition-colors text-sm"
                          >
                            {m.fullName}
                          </Link>
                          <span
                            className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[9px] font-extrabold uppercase border shadow-2xs ${progMeta.badgeClass}`}
                          >
                            <span>{progMeta.icon}</span>
                            <span>{progMeta.shortLabel}</span>
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-[10px] text-slate-500 font-medium">
                            {m.memberCode}
                          </span>
                          {m.state && (
                            <span className="text-[10px] text-slate-500">
                              • {m.state}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status / Expiration */}
                      <td className="py-3 px-3">
                        {m.statusInfo?.isExpiringSoon ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
                            <Clock className="w-3 h-3 text-amber-600" />
                            {m.statusInfo.daysLeft}d left
                          </span>
                        ) : m.statusInfo?.isExpired ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
                            <AlertTriangle className="w-3 h-3 text-red-600" />
                            Expired
                          </span>
                        ) : m.statusInfo?.status === "On Hold" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                            <PauseCircle className="w-3 h-3 text-blue-600" />
                            On Hold
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Active ({m.statusInfo?.daysLeft ? `${m.statusInfo.daysLeft}d` : "6M"})
                          </span>
                        )}
                        {(m.paymentStatus === "partial" || m.paymentStatus === "unpaid") && (
                          <div className="mt-1">
                            <span className="inline-flex rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                              Payment due
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Contact Recency & Last Medium */}
                      <td className="py-3 px-3 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${cStatus.badgeClass}`}
                          >
                            {cStatus.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-slate-600">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${medMeta.badgeClass}`}
                          >
                            {medMeta.shortLabel}
                          </span>
                          <span className="truncate max-w-[110px] font-medium">
                            by {m.lastContactStaff || m.allotedTo || "Staff"}
                          </span>
                        </div>
                      </td>

                      {/* Journey Stage */}
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 font-semibold text-[11px] block truncate max-w-[130px]">
                          {stageObj.number}: {stageObj.name}
                        </span>
                        <span className="text-[10px] text-slate-500 truncate block mt-0.5 max-w-[130px]">
                          {m.currentMilestone || stageObj.milestone}
                        </span>
                      </td>

                      {/* Assigned Staff */}
                      <td className="py-3 px-3">
                        <span className="font-semibold text-slate-800">
                          {m.allotedTo || "Unassigned"}
                        </span>
                        <div className="text-[10px] text-blue-600 font-mono font-medium">
                          {m.oneOnOneSessions || 0} 1:1 Sessions
                        </div>
                      </td>

                      {/* Brand & Sales */}
                      <td className="py-3 px-3">
                        <div className="text-slate-800 font-medium truncate max-w-[130px]">
                          {m.brandCollaborations || m.plBrand || "—"}
                        </div>
                        <div className="text-[10px] font-bold text-emerald-600">
                          {m.salesData ? m.salesData : "₹0"}
                        </div>
                      </td>

                      {/* Quick Actions Row */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Quick Dial */}
                          <a
                            href={`tel:${cleanPhone}`}
                            title={`Call ${m.phone}`}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>

                          {/* Quick WhatsApp */}
                          <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noreferrer"
                            title="Chat on WhatsApp"
                            className="p-1.5 rounded-lg bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 transition-colors"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </a>

                          {/* Log Communication Modal Launcher */}
                          <button
                            onClick={() => setCallLoggingMember(m)}
                            title="Log Communication / Call"
                            className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors cursor-pointer"
                          >
                            <PhoneCall className="w-3.5 h-3.5" />
                          </button>

                          {/* Transfer Query */}
                          <button
                            onClick={() => setTransferringMember(m)}
                            title="Transfer Query to Department"
                            className="p-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 transition-colors cursor-pointer"
                          >
                            <SendHorizontal className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit Member */}
                          <button
                            onClick={() => setEditingMember(m)}
                            title="Edit Member Profile"
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {filteredMembers.length > pageSize && (
          <div className="flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-500">
            <span>
              Showing {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filteredMembers.length)} of {filteredMembers.length} members
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safePage === 1}
                onClick={() => setPage(Math.max(1, safePage - 1))}
                className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <span className="font-medium text-slate-700">Page {safePage} of {pageCount}</span>
              <button
                type="button"
                disabled={safePage === pageCount}
                onClick={() => setPage(Math.min(pageCount, safePage + 1))}
                className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <AddMemberModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={reloadData}
        programs={programsList}
      />

      {editingMember && (
        <EditMemberModal
          isOpen={!!editingMember}
          onClose={() => setEditingMember(null)}
          member={editingMember}
          onSuccess={reloadData}
          isAdmin={isAdmin}
          canManagePayments={canManagePayments}
          programs={programsList}
        />
      )}

      {/* Admin Program Management Modal */}
      <ProgramManagementModal
        isOpen={isProgramModalOpen}
        onClose={() => setIsProgramModalOpen(false)}
        programs={programsList}
        onProgramsUpdated={(updated) => setProgramsList(updated)}
        currentUserRole={userRole}
      />

      {callLoggingMember && (
        <LogCallModal
          isOpen={!!callLoggingMember}
          onClose={() => setCallLoggingMember(null)}
          memberId={callLoggingMember.id}
          memberName={callLoggingMember.fullName}
          memberPhone={callLoggingMember.phone}
          onSuccess={reloadData}
        />
      )}

      {transferringMember && (
        <TransferQueryModal
          isOpen={!!transferringMember}
          onClose={() => setTransferringMember(null)}
          memberId={transferringMember.id}
          memberName={transferringMember.fullName}
          currentDept={userDepartment}
          onSuccess={reloadData}
        />
      )}

      {stageAdvancingMember && (
        <AdvanceStageModal
          isOpen={!!stageAdvancingMember}
          onClose={() => setStageAdvancingMember(null)}
          memberId={stageAdvancingMember.id}
          memberName={stageAdvancingMember.fullName}
          currentStage={stageAdvancingMember.currentStage}
          onSuccess={reloadData}
        />
      )}
    </div>
  );
}
