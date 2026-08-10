"use client";

import { useState } from "react";
import { X, Edit3, DollarSign } from "lucide-react";
import { updateMember, toggleMemberHold, deleteOrArchiveMember } from "@/app/actions/memberActions";
import { toast } from "sonner";

interface EditMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: EditableMember;
  onSuccess: () => void;
  executives?: string[];
  isAdmin?: boolean;
  canManagePayments?: boolean;
  programs?: ProgramOption[];
}

type HealthStatus = "healthy" | "needs_attention" | "warning" | "critical";
type PaymentStatus = "paid" | "partial" | "unpaid" | "unknown";

interface EditableMember {
  id: string;
  memberCode: string;
  fullName: string;
  programType?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  state?: string | null;
  plan?: string | null;
  enrollingDate?: string | Date | null;
  endDate?: string | Date | null;
  allotedTo?: string | null;
  businessType?: string | null;
  brandCollaborations?: string | null;
  salesData?: string | null;
  budgetAvailable?: string | null;
  healthStatus?: HealthStatus | null;
  paymentStatus?: PaymentStatus | null;
  paymentNotes?: string | null;
  notes?: string | null;
  activeStatus: string;
}

interface ProgramOption {
  name: string;
  codePrefix: string;
  icon?: string | null;
  badgeColor?: string | null;
}

export default function EditMemberModal({
  isOpen,
  onClose,
  member,
  onSuccess,
  executives = [
    "Samyak",
    "Mayank",
    "Jaanvi",
    "Muskaan",
    "Jaspreet",
    "Sumit",
    "Dhruv",
    "Abdul Barr",
    "Dev Rathore",
    "Aditya Bairagi",
    "Savneet Singh",
    "Ritika Behl",
    "Harshita Prajapati",
    "Nishkarsh Gupta",
    "Janvi Arora",
    "Arshdeep Kaur",
    "Tushar Panchal",
    "Hemant Bhandari",
  ],
  canManagePayments = false,
  programs = [
    { name: "Platinum", codePrefix: "PLT", icon: "👑", badgeColor: "amber" },
    { name: "PNP", codePrefix: "PNP", icon: "⚡", badgeColor: "cyan" },
    { name: "Amazon Wealth Shortcut", codePrefix: "AWS", icon: "🚀", badgeColor: "purple" },
  ],
}: EditMemberModalProps) {
  const [formData, setFormData] = useState({
    programType: member?.programType || (member?.memberCode?.startsWith("PNP") ? "PNP" : "Platinum"),
    firstName: member?.firstName || "",
    lastName: member?.lastName || "",
    email: member?.email || "",
    phone: member?.phone || "",
    state: member?.state || "",
    plan: member?.plan || "6 Months",
    enrollingDate: member?.enrollingDate
      ? new Date(member.enrollingDate).toISOString().split("T")[0]
      : "",
    endDate: member?.endDate
      ? new Date(member.endDate).toISOString().split("T")[0]
      : "",
    allotedTo: member?.allotedTo || "Samyak",
    businessType: member?.businessType || "Reseller",
    brandCollaborations: member?.brandCollaborations || "",
    salesData: member?.salesData || "",
    budgetAvailable: member?.budgetAvailable || "",
    healthStatus: member?.healthStatus || "healthy",
    paymentStatus: member?.paymentStatus || "paid",
    paymentNotes: member?.paymentNotes || "",
  });
  const [loading, setLoading] = useState(false);

  if (!isOpen || !member) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await updateMember(member.id, formData);
      if (res.success) {
        toast.success("Member updated successfully!");
        onSuccess();
        onClose();
      } else {
        toast.error(res.error || "Failed to update member");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update member");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleHold = async () => {
    const isHold = member.activeStatus === "On Hold";
    const res = await toggleMemberHold(
      member.id,
      isHold ? undefined : "Put on hold via member editor"
    );
    if (res.success) {
      toast.success(
        isHold ? "Membership resumed to Active" : "Membership placed on Hold"
      );
      onSuccess();
      onClose();
    } else {
      toast.error(res.error || "Failed to change hold status");
    }
  };

  const handleArchive = async () => {
    if (confirm("Are you sure you want to mark this member as Quit / Dropped Out?")) {
      const res = await deleteOrArchiveMember(member.id, "quit");
      if (res.success) {
        toast.success("Member status updated to Quit.");
        onSuccess();
        onClose();
      } else {
        toast.error(res.error || "Failed to update");
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 text-slate-900">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-700 border border-amber-200">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Edit Member: {member.fullName}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-mono text-xs text-amber-700 font-bold">
                  {member.memberCode}
                </span>
                <span className="text-xs text-slate-500 font-medium">• Program: {formData.programType}</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close member editor"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick status bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 mb-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-600 font-medium">Current Status:</span>
            <span
              className={`px-2.5 py-1 rounded-md font-bold ${
                member.activeStatus === "Active"
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                  : member.activeStatus === "On Hold"
                  ? "bg-amber-100 text-amber-800 border border-amber-200"
                  : "bg-red-100 text-red-800 border border-red-200"
              }`}
            >
              {member.activeStatus}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleHold}
              className={`px-3 py-1.5 rounded-xl border font-bold transition-colors cursor-pointer ${
                member.activeStatus === "On Hold"
                  ? "bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100"
                  : "bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100"
              }`}
            >
              {member.activeStatus === "On Hold" ? "Resume Membership" : "Put On Hold"}
            </button>
            <button
              type="button"
              onClick={handleArchive}
              className="px-3 py-1.5 rounded-xl bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 font-bold transition-colors cursor-pointer"
            >
              Mark Dropped Out
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Program Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Membership Program Tier
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {programs.map((p) => {
                const isSelected = formData.programType.toLowerCase() === p.name.toLowerCase();
                return (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => setFormData({ ...formData, programType: p.name })}
                    className={`p-3 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                      isSelected
                        ? "bg-amber-50 border-amber-400 ring-2 ring-amber-400/40 text-amber-900 shadow-xs"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    <span className="text-2xl shrink-0">{p.icon || "🎯"}</span>
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-slate-900 truncate">{p.name}</div>
                      <div className="text-[10px] text-slate-500 font-medium">
                        Prefix: {p.codePrefix}-2026-XXX
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                First Name
              </label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-amber-500 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Last Name
              </label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-amber-500 focus:bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Phone Number
              </label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-amber-500 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-amber-500 focus:bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                State / Location
              </label>
              <input
                type="text"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-amber-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Enrollment Date
              </label>
              <input
                type="date"
                value={formData.enrollingDate}
                onChange={(e) => setFormData({ ...formData, enrollingDate: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-amber-500 focus:bg-white font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Expiration / End Date
              </label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-amber-500 focus:bg-white font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Plan
              </label>
              <select
                value={formData.plan}
                onChange={(e) => setFormData({ ...formData, plan: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-amber-500 focus:bg-white font-medium"
              >
                <option value="6 Months">6 Months</option>
                <option value="Yearly">Yearly</option>
                <option value="Lifetime">Lifetime</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Assigned Executive
              </label>
              <select
                value={formData.allotedTo}
                onChange={(e) => setFormData({ ...formData, allotedTo: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-amber-500 focus:bg-white font-medium"
              >
                {executives.map((ex) => (
                  <option key={ex} value={ex}>
                    {ex}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Health Status
              </label>
              <select
                value={formData.healthStatus}
                onChange={(e) => setFormData({ ...formData, healthStatus: e.target.value as HealthStatus })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-amber-500 focus:bg-white font-medium"
              >
                <option value="healthy">Healthy (Active & On Track)</option>
                <option value="needs_attention">Needs Attention</option>
                <option value="warning">Warning (Follow-up Overdue)</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          {canManagePayments && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-700" />
                <div>
                  <p className="text-sm font-bold text-slate-900">Payment status</p>
                  <p className="text-xs text-slate-500">Visible and editable only to managers and administrators.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="payment-status" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Collection status
                  </label>
                  <select
                    id="payment-status"
                    value={formData.paymentStatus}
                    onChange={(e) => setFormData({ ...formData, paymentStatus: e.target.value as PaymentStatus })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:border-amber-500 focus:outline-none"
                  >
                    <option value="paid">Paid in full</option>
                    <option value="partial">Partially paid</option>
                    <option value="unpaid">Unpaid</option>
                    <option value="unknown">Not confirmed</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="payment-notes" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Payment note
                  </label>
                  <input
                    id="payment-notes"
                    type="text"
                    value={formData.paymentNotes}
                    onChange={(e) => setFormData({ ...formData, paymentNotes: e.target.value })}
                    placeholder="For example: balance payment pending"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Brand Collaborations / PL Brand
              </label>
              <input
                type="text"
                value={formData.brandCollaborations}
                onChange={(e) => setFormData({ ...formData, brandCollaborations: e.target.value })}
                placeholder="e.g. Havells, Portronics, Own Brand"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-amber-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Sales Revenue Data
              </label>
              <input
                type="text"
                value={formData.salesData}
                onChange={(e) => setFormData({ ...formData, salesData: e.target.value })}
                placeholder="e.g. 50k, 1.5L, 30L"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-amber-500 focus:bg-white"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4">
            <div className="mb-2">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                Automated Member Notes & Background
              </label>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Built automatically from the latest verified communication and each department&apos;s latest status. Update the journey instead of editing this summary.
              </p>
            </div>
            <textarea
              rows={9}
              readOnly
              aria-readonly="true"
              value={member.notes || "No verified communication or department update has been recorded yet."}
              className="w-full resize-y rounded-xl border border-blue-200 bg-white px-3.5 py-2.5 font-mono text-xs leading-5 text-slate-700 outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs disabled:opacity-50 transition-all cursor-pointer"
            >
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
