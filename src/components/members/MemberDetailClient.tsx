"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  PauseCircle,
  PhoneCall,
  SendHorizontal,
  ArrowRightCircle,
  Edit2,
  Briefcase,
  DollarSign,
  TrendingUp,
  Tag,
  Shield,
  UserCheck,
  Building2,
  FileText,
  Sparkles,
  MessageSquare,
  Video,
  Smartphone,
  ExternalLink,
  Flame,
} from "lucide-react";
import LogCallModal from "./LogCallModal";
import TransferQueryModal from "./TransferQueryModal";
import AdvanceStageModal from "./AdvanceStageModal";
import EditMemberModal from "./EditMemberModal";
import ResolveQueryModal from "./ResolveQueryModal";
import EditCallLogModal from "./EditCallLogModal";
import MemberServicesCard from "@/components/services/MemberServicesCard";
import type { ServicePartnerView } from "@/lib/servicePartners";
import type { AssignableStaffView } from "@/lib/followups";
import {
  PLATINUM_STAGES,
  formatINR,
  getMediumMeta,
  getContactAttentionStatus,
  getProgramMeta,
} from "@/lib/membershipUtils";

interface MemberDetailClientProps {
  member: any;
  userRole?: string;
  userDepartment?: string;
  currentUserId?: string;
  availableServicePartners?: ServicePartnerView[];
  contactStaffOptions?: AssignableStaffView[];
}

const CRM_TIME_ZONE = "Asia/Kolkata";

function formatCrmDate(value: string | number | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: CRM_TIME_ZONE,
  }).format(date);
}

function formatCrmDateTime(value: string | number | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: CRM_TIME_ZONE,
  }).format(date);
}

export default function MemberDetailClient({
  member: initialMember,
  userRole = "employee",
  userDepartment = "operations",
  currentUserId,
  availableServicePartners = [],
  contactStaffOptions = [],
}: MemberDetailClientProps) {
  const [member, setMember] = useState(initialMember);
  const normalizedRole = userRole.trim().toLowerCase();
  const isSuperAdmin = normalizedRole === "admin" || normalizedRole === "superadmin";
  const isElevatedUser = isSuperAdmin || normalizedRole === "manager";

  // Modals state
  const [isLogCallOpen, setIsLogCallOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [isAdvanceStageOpen, setIsAdvanceStageOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [resolvingTransfer, setResolvingTransfer] = useState<any | null>(null);
  const [editingCallLog, setEditingCallLog] = useState<any | null>(null);

  const progMeta = getProgramMeta(
    member.programType || (member.memberCode?.startsWith("PNP") ? "PNP" : "Platinum")
  );

  const status = member.statusInfo?.status || member.activeStatus;
  const daysLeft = member.statusInfo?.daysLeft;

  const contactStatus =
    member.contactStatus ||
    getContactAttentionStatus(member.lastConnectDate, member.nextConnectDate);

  const lastMedium = getMediumMeta(member.lastContactMedium);

  const currentStageIndex = PLATINUM_STAGES.findIndex(
    (s) => s.id === member.currentStage
  );
  const currentStageObj =
    PLATINUM_STAGES[currentStageIndex >= 0 ? currentStageIndex : 0];

  const reloadData = () => {
    window.location.reload();
  };

  const cleanPhone = (member.phone || "").replace(/[^0-9+]/g, "");
  const whatsappUrl = `https://wa.me/${cleanPhone.replace("+", "")}?text=${encodeURIComponent(
    `Hello ${member.fullName}, this is from ProSync ${progMeta.name} Support regarding your account ${member.memberCode}.`
  )}`;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Breadcrumb & Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/members"
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Members Registry
        </Link>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-extrabold uppercase border shadow-2xs ${progMeta.badgeClass}`}
          >
            <span>{progMeta.icon}</span>
            <span>{progMeta.name}</span>
          </span>
          <span className="font-mono text-xs text-slate-800 font-bold bg-slate-100 px-3 py-1 rounded-xl border border-slate-200">
            {member.memberCode}
          </span>
        </div>
      </div>

      {/* Main Header Card */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${progMeta.gradient} flex items-center justify-center text-slate-950 font-black text-2xl shadow-xs shrink-0`}>
              {member.firstName?.[0] || progMeta.icon}
              {member.lastName?.[0] || ""}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
                  {member.fullName}
                </h1>

                {/* Program Badge */}
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-extrabold uppercase border ${progMeta.badgeClass}`}
                >
                  <span>{progMeta.icon}</span>
                  <span>{progMeta.shortLabel}</span>
                </span>

                {/* Expiration Status Badge */}
                {status === "Active" && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Active ({daysLeft !== null ? `${daysLeft}d left` : "Active"})
                  </span>
                )}
                {status === "Expiring Soon" && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    Expiring Soon ({daysLeft}d remaining)
                  </span>
                )}
                {status === "Expired" && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                    Membership Expired
                  </span>
                )}
                {status === "On Hold" && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                    <PauseCircle className="w-3.5 h-3.5 text-blue-600" />
                    On Hold {member.holdReason ? `(${member.holdReason})` : ""}
                  </span>
                )}

                {(member.paymentStatus === "partial" || member.paymentStatus === "unpaid") && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-bold text-rose-800">
                    Payment due · {member.paymentStatus === "partial" ? "Partially paid" : "Unpaid"}
                  </span>
                )}

                {/* Contact Recency / Urgency Pill */}
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${contactStatus.badgeClass}`}>
                  {contactStatus.urgency === "urgent" && <Flame className="w-3 h-3" />}
                  {contactStatus.urgency === "due_soon" && <Clock className="w-3 h-3" />}
                  {contactStatus.urgency === "healthy" && <CheckCircle2 className="w-3 h-3" />}
                  {contactStatus.label}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 font-medium">
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-amber-600" />
                  <span className="font-mono text-slate-900 font-semibold">{member.phone}</span>
                </span>
                {member.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>{member.email}</span>
                  </span>
                )}
                {member.state && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{member.state}</span>
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    Enrolled:{" "}
                    {member.enrollingDate
                      ? formatCrmDate(member.enrollingDate)
                      : "—"}
                  </span>
                </span>
                {member.endDate && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      Expires: {formatCrmDate(member.endDate)}
                    </span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setIsLogCallOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <PhoneCall className="w-4 h-4 text-amber-400" />
              Log Communication
            </button>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-all"
            >
              <MessageSquare className="w-4 h-4 text-emerald-600" />
              WhatsApp
            </a>

            <button
              onClick={() => setIsTransferOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold text-purple-800 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl transition-all cursor-pointer"
            >
              <SendHorizontal className="w-4 h-4 text-purple-600" />
              Transfer Query
            </button>

            {isElevatedUser && (
              <>
                <button
                  onClick={() => setIsAdvanceStageOpen(true)}
                  className="flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-all cursor-pointer"
                >
                  <ArrowRightCircle className="w-4 h-4 text-blue-600" />
                  Update Stage
                </button>

                <button
                  onClick={() => setIsEditOpen(true)}
                  className="flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-all cursor-pointer"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit Profile
                </button>
              </>
            )}
          </div>
        </div>

        {/* 5-Stage Visual Stepper */}
        <div className="pt-4 border-t border-slate-100">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
            5-Stage Roadmap Progress
          </p>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2.5">
            {PLATINUM_STAGES.map((s, idx) => {
              const isPast = idx < (currentStageIndex >= 0 ? currentStageIndex : 0);
              const isCurrent = idx === currentStageIndex;

              return (
                <div
                  key={s.id}
                  onClick={isElevatedUser ? () => setIsAdvanceStageOpen(true) : undefined}
                  className={`p-3.5 rounded-2xl border transition-all ${
                    isElevatedUser ? "cursor-pointer" : "cursor-default"
                  } ${
                    isCurrent
                      ? "bg-amber-50 border-amber-400 shadow-xs ring-2 ring-amber-400/40"
                      : isPast
                      ? "bg-slate-50 border-emerald-300"
                      : "bg-slate-50/50 border-slate-200 opacity-70 hover:opacity-100"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                        isCurrent
                          ? "bg-amber-500 text-slate-950"
                          : isPast
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      Stage {idx + 1}
                    </span>
                    {isPast && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                    {isCurrent && <Sparkles className="w-3.5 h-3.5 text-amber-600" />}
                  </div>
                  <h4 className="text-xs font-bold text-slate-900">{s.name}</h4>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 font-medium">
                    {s.milestone}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Profile Metrics & Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Business Specs & Journey Notes */}
        <div className="lg:col-span-2 space-y-6">
          {/* Business & Brand Details */}
          <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-amber-600" />
              Business, Sourcing & Strategy Dossier
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-slate-500 block text-[11px] font-medium">Business Model</span>
                <span className="text-sm font-bold text-slate-900">
                  {member.businessType || "Reseller"}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-slate-500 block text-[11px] font-medium">Assigned Executive</span>
                <span className="text-sm font-bold text-amber-700">
                  {member.allotedTo || "Unassigned"}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-slate-500 block text-[11px] font-medium">1-on-1 Sessions</span>
                <span className="text-sm font-bold text-blue-700">
                  {member.oneOnOneSessions || 0} Sessions Conducted
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1 sm:col-span-2">
                <span className="text-slate-500 block text-[11px] font-medium">Brand Collaborations / PL Brand</span>
                <span className="text-sm font-bold text-slate-900">
                  {member.brandCollaborations || member.plBrand || member.resellingBrand || "None specified"}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-slate-500 block text-[11px] font-medium">Sales Revenue Recorded</span>
                <span className="text-sm font-bold text-emerald-700">
                  {member.salesData ? member.salesData : "₹0 recorded"}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-slate-500 block text-[11px] font-medium">Budget Available</span>
                <span className="text-sm font-bold text-slate-800">
                  {member.budgetAvailable || "₹50k - ₹1L"}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-slate-500 block text-[11px] font-medium">Last Contact Medium</span>
                <span className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${lastMedium.badgeClass}`}>
                    {lastMedium.label}
                  </span>
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-slate-500 block text-[11px] font-medium">Last Staff Reachout</span>
                <span className="text-sm font-bold text-amber-700">
                  {member.lastContactStaff || member.allotedTo || "Staff"}
                </span>
              </div>
            </div>

            {/* Notes Section */}
            {member.notes && (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Onboarding & Journey Dossier
                </span>
                <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap font-medium">
                  {member.notes}
                </p>
              </div>
            )}
          </div>

          <MemberServicesCard
            memberId={member.id}
            memberName={member.fullName}
            partners={availableServicePartners}
            referrals={member.serviceReferrals || []}
            onSuccess={reloadData}
          />

          {/* Interaction & Call Logs Feed */}
          <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <PhoneCall className="w-4 h-4 text-emerald-600" />
                  Communication & Call Connect Timeline ({member.callLogs?.length || 0})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Recorded outreach via Phone, WhatsApp, Zoom 1:1, Email & SMS
                </p>
              </div>
              <button
                onClick={() => setIsLogCallOpen(true)}
                className="text-xs text-slate-900 hover:text-amber-700 font-bold bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl border border-slate-200 transition-colors cursor-pointer"
              >
                + Log Communication
              </button>
            </div>

            <div className="space-y-3">
              {member.callLogs && member.callLogs.length > 0 ? (
                member.callLogs.map((log: any) => {
                  const mediumMeta = getMediumMeta(log.medium);
                  return (
                    <div
                      key={log.id}
                      className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-2 hover:border-slate-300 transition-colors"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Medium Badge */}
                          <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase border ${mediumMeta.badgeClass}`}>
                            {mediumMeta.label}
                          </span>

                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              log.type === "inbound"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {log.type}
                          </span>

                          <span className="font-bold text-slate-800">
                            {log.outcome}
                          </span>

                          {log.duration ? (
                            <span className="text-[10px] font-mono text-slate-600 bg-slate-200 px-1.5 py-0.5 rounded font-bold">
                              {log.duration} min
                            </span>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-2 text-slate-500 text-[11px] font-medium">
                          {log.staffName && (
                            <span className="text-amber-700 font-bold">
                              By {log.staffName}
                            </span>
                          )}
                          <span>•</span>
                          <span>{formatCrmDateTime(log.date)}</span>
                          {isSuperAdmin && (
                            <button
                              type="button"
                              onClick={() => setEditingCallLog(log)}
                              className="ml-1 inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700 hover:bg-amber-100"
                            >
                              <Edit2 className="h-3 w-3" />
                              Edit
                            </button>
                          )}
                        </div>
                      </div>

                      <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">
                        {log.notes}
                      </p>
                      {log.editedAt && (
                        <p className="text-[10px] font-medium text-slate-400">
                          Corrected by {log.editedByName || "Super Admin"} · {formatCrmDateTime(log.editedAt)}
                        </p>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center text-slate-500 text-xs">
                  No communication logs recorded yet. Click "Log Communication" above to record a conversation.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Cross-Department Queries & Quick Contact */}
        <div className="space-y-6">
          {/* Quick Contact & Action Card */}
          <div className="p-6 rounded-3xl bg-amber-50/50 border border-amber-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-amber-800 font-bold text-xs uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>Instant Contact Channels</span>
            </div>

            <p className="text-xs text-slate-700">
              Direct connect channels for <span className="font-bold text-slate-900">{member.fullName}</span>:
            </p>

            <div className="space-y-2">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
              >
                <MessageSquare className="w-4 h-4" />
                Launch WhatsApp Chat
              </a>

              <a
                href={`tel:${cleanPhone}`}
                className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-center font-bold text-xs flex items-center justify-center gap-2 transition-colors"
              >
                <Phone className="w-4 h-4 text-amber-600" />
                Call Phone ({member.phone})
              </a>

              {member.email && (
                <a
                  href={`mailto:${member.email}?subject=${encodeURIComponent(
                    `ProSync Platinum Support - ${member.memberCode}`
                  )}`}
                  className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-center font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
                >
                  <Mail className="w-4 h-4 text-indigo-600" />
                  Send Email ({member.email})
                </a>
              )}
            </div>
          </div>

          {/* Query Transfers Feed */}
          <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <SendHorizontal className="w-4 h-4 text-purple-600" />
                  Department Queries ({member.queryTransfers?.length || 0})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Cross-department routing
                </p>
              </div>
              <button
                onClick={() => setIsTransferOpen(true)}
                className="text-xs text-purple-700 hover:text-purple-900 font-bold bg-purple-50 hover:bg-purple-100 px-2.5 py-1 rounded-xl border border-purple-200 transition-colors cursor-pointer"
              >
                + Transfer
              </button>
            </div>

            <div className="space-y-3">
              {member.queryTransfers && member.queryTransfers.length > 0 ? (
                member.queryTransfers.map((t: any) => {
                  const isResolved = t.status === "resolved";
                  const canResolve =
                    isElevatedUser ||
                    t.toDepartment?.trim().toLowerCase() === userDepartment.trim().toLowerCase();
                  return (
                    <div
                      key={t.id}
                      className={`p-4 rounded-2xl border space-y-2 ${
                        isResolved
                          ? "bg-slate-50 border-slate-200 opacity-85"
                          : "bg-purple-50/40 border-purple-200"
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-purple-800 uppercase text-[10px] bg-purple-100 px-2 py-0.5 rounded">
                            To {t.toDepartment}
                          </span>
                          {t.priority && (
                            <span
                              className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                t.priority === "urgent"
                                  ? "bg-red-100 text-red-800 animate-pulse font-extrabold"
                                  : t.priority === "high"
                                  ? "bg-amber-100 text-amber-800 font-bold"
                                  : "bg-slate-200 text-slate-700"
                              }`}
                            >
                              {t.priority}
                            </span>
                          )}
                        </div>

                        <span className="text-slate-500 text-[10px] font-medium">
                          {formatCrmDate(t.createdAt)}
                        </span>
                      </div>

                      {t.assignedToName && (
                        <div className="text-[11px] text-slate-600 font-medium">
                          Assigned to:{" "}
                          <span className="text-amber-700 font-bold">
                            {t.assignedToName}
                          </span>
                        </div>
                      )}

                      <p className="text-xs text-slate-800 leading-relaxed font-medium">
                        {t.reason}
                      </p>

                      {isResolved ? (
                        <div className="pt-2 border-t border-slate-200 text-[11px] text-emerald-700 space-y-0.5">
                          <div className="font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Resolved
                          </div>
                          {t.resolutionNotes && (
                            <p className="text-slate-600 text-[11px] font-medium">{t.resolutionNotes}</p>
                          )}
                          {t.resolutionMedium && (
                            <p className="text-slate-500 text-[10px]">
                              Resolved via {getMediumMeta(t.resolutionMedium).label}
                              {t.resolvedByName ? ` by ${t.resolvedByName}` : ""}
                            </p>
                          )}
                        </div>
                      ) : canResolve ? (
                        <div className="pt-2 border-t border-purple-200 flex justify-end">
                          <button
                            onClick={() => setResolvingTransfer(t)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300 text-[11px] font-bold transition-colors cursor-pointer"
                          >
                            Mark Resolved
                          </button>
                        </div>
                      ) : (
                        <div className="border-t border-purple-200 pt-2 text-right text-[11px] font-semibold text-slate-500">
                          Awaiting {t.toDepartment} department
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center text-slate-500 text-xs">
                  No cross-department query transfers logged.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <LogCallModal
        isOpen={isLogCallOpen}
        onClose={() => setIsLogCallOpen(false)}
        memberId={member.id}
        memberName={member.fullName}
        memberPhone={member.phone}
        currentUserRole={userRole}
        currentUserId={currentUserId}
        contactStaffOptions={contactStaffOptions}
        onSuccess={reloadData}
      />

      <TransferQueryModal
        isOpen={isTransferOpen}
        onClose={() => setIsTransferOpen(false)}
        memberId={member.id}
        memberName={member.fullName}
        currentDept={userDepartment}
        onSuccess={reloadData}
      />

      {isElevatedUser && (
        <>
          <AdvanceStageModal
            isOpen={isAdvanceStageOpen}
            onClose={() => setIsAdvanceStageOpen(false)}
            memberId={member.id}
            memberName={member.fullName}
            currentStage={member.currentStage}
            onSuccess={reloadData}
          />

          <EditMemberModal
            isOpen={isEditOpen}
            onClose={() => setIsEditOpen(false)}
            member={member}
            onSuccess={reloadData}
            isAdmin={isSuperAdmin}
            canManagePayments={isElevatedUser}
          />
        </>
      )}

      {resolvingTransfer && (
        <ResolveQueryModal
          isOpen={!!resolvingTransfer}
          onClose={() => setResolvingTransfer(null)}
          transferId={resolvingTransfer.id}
          memberName={member.fullName}
          transferReason={resolvingTransfer.reason}
          toDepartment={resolvingTransfer.toDepartment}
          onSuccess={reloadData}
        />
      )}

      {editingCallLog && isSuperAdmin && (
        <EditCallLogModal
          log={editingCallLog}
          memberName={member.fullName}
          staff={contactStaffOptions}
          onClose={() => setEditingCallLog(null)}
          onSuccess={reloadData}
        />
      )}
    </div>
  );
}
