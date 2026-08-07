"use client";

import { useState } from "react";
import { X, UserPlus, Calendar, Phone, Mail, MapPin, DollarSign, Tag, Briefcase } from "lucide-react";
import { createMember } from "@/app/actions/memberActions";
import { toast } from "sonner";

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  executives?: string[];
  programs?: any[];
}

export default function AddMemberModal({
  isOpen,
  onClose,
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
  programs = [
    { name: "Platinum", codePrefix: "PLT", icon: "👑", badgeColor: "amber" },
    { name: "PNP", codePrefix: "PNP", icon: "⚡", badgeColor: "cyan" },
    { name: "Amazon Wealth Shortcut", codePrefix: "AWS", icon: "🚀", badgeColor: "purple" },
  ],
}: AddMemberModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    programType: programs[0]?.name || "Platinum",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    state: "",
    enrollingDate: new Date().toISOString().split("T")[0],
    plan: "6 Months",
    allotedTo: executives[0] || "Samyak",
    businessType: "Reseller",
    brandCollaborations: "",
    plBrand: "",
    resellingBrand: "",
    salesData: "",
    budgetAvailable: "50k-1L",
    currentStage: "onboarding" as const,
    notes: "",
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.firstName.trim() || !formData.phone.trim()) {
      toast.error("Please fill in required fields (First Name & Phone).");
      return;
    }

    setLoading(true);
    try {
      const res = await createMember(formData);
      if (res.success) {
        toast.success(`${formData.programType} Member enrolled successfully!`);
        onSuccess();
        onClose();
      } else {
        toast.error(res.error || "Failed to add member");
      }
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 text-slate-900">
        <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-700 border border-amber-200">
              <UserPlus className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Enroll New Member</h2>
              <p className="text-xs text-slate-500">
                Enroll into Platinum, PNP, Amazon Wealth Shortcut, or custom cohort with automated code generation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Program Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Select Membership Program *
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
                First Name *
              </label>
              <input
                type="text"
                required
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                placeholder="e.g. Rahul"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white text-sm"
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
                placeholder="e.g. Sharma"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Phone Number *
              </label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="rahul@example.com"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white text-sm"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                State / Location
              </label>
              <div className="relative">
                <MapPin className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  placeholder="e.g. Maharashtra"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Enrollment Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="date"
                  value={formData.enrollingDate}
                  onChange={(e) => setFormData({ ...formData, enrollingDate: e.target.value })}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white text-sm font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Membership Plan
              </label>
              <select
                value={formData.plan}
                onChange={(e) => setFormData({ ...formData, plan: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white text-sm font-medium"
              >
                <option value="6 Months">6 Months Plan (180 Days)</option>
                <option value="Yearly">Yearly Plan (365 Days)</option>
                <option value="Lifetime">Lifetime Access</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Assigned Executive
              </label>
              <select
                value={formData.allotedTo}
                onChange={(e) => setFormData({ ...formData, allotedTo: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white text-sm font-medium"
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
                Business Type
              </label>
              <select
                value={formData.businessType}
                onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white text-sm font-medium"
              >
                <option value="Reseller">Reseller</option>
                <option value="PL">Private Label (PL)</option>
                <option value="Both">Both (PL + Reselling)</option>
                <option value="Brand Collaboration">Brand Collaboration</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Starting Stage
              </label>
              <select
                value={formData.currentStage}
                onChange={(e: any) => setFormData({ ...formData, currentStage: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white text-sm font-medium"
              >
                <option value="onboarding">Stage 1: Decision & Onboarding</option>
                <option value="research">Stage 2: Product Research</option>
                <option value="sourcing">Stage 3: Sourcing & Brand Approval</option>
                <option value="approval">Stage 4: Sample & Testing</option>
                <option value="growth">Stage 5: Live & Growth Scaling</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Brand Collaborations / PL Brand Name
              </label>
              <input
                type="text"
                value={formData.brandCollaborations}
                onChange={(e) => setFormData({ ...formData, brandCollaborations: e.target.value })}
                placeholder="e.g. Havells, Portronics, Own Brand"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Current Sales / Target
              </label>
              <input
                type="text"
                value={formData.salesData}
                onChange={(e) => setFormData({ ...formData, salesData: e.target.value })}
                placeholder="e.g. 50k, 1.5L, 30L"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Initial Connect / Notes
            </label>
            <textarea
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Add details from onboarding call, special requirements, or business goals..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white text-sm leading-relaxed"
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
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs disabled:opacity-50 transition-all cursor-pointer"
            >
              {loading ? "Adding..." : "Enroll Member"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
