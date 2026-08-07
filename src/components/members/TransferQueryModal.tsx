"use client";

import { useState, useEffect } from "react";
import {
  X,
  SendHorizontal,
  Building2,
  UserCheck,
  AlertTriangle,
  Flame,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { transferQuery, getStaffDirectory } from "@/app/actions/memberActions";
import { toast } from "sonner";

interface TransferQueryModalProps {
  isOpen: boolean;
  onClose: () => void;
  memberId: string;
  memberName: string;
  currentDept?: string;
  onSuccess: () => void;
  staffList?: { id: string; name: string; email: string; department: string; role: string }[];
}

const DEPARTMENTS = [
  { id: "ecom", label: "E-Commerce", desc: "Listings, Amazon/Flipkart ops" },
  { id: "sourcing", label: "Sourcing & Brands", desc: "Supplier quotes, samples, authorization" },
  { id: "brand", label: "Brand Management", desc: "Brand approvals, collaborations" },
  { id: "research", label: "Product Research", desc: "Helium 10, Black Box, Niche validation" },
  { id: "onboarding", label: "Onboarding", desc: "Induction, welcome calls, access setup" },
  { id: "support", label: "Customer Support", desc: "General tickets & student help" },
  { id: "sales", label: "Sales & Upgrades", desc: "Renewal, upgrades & courses" },
  { id: "management", label: "Operations & Admin", desc: "Senior escalations" },
];

export default function TransferQueryModal({
  isOpen,
  onClose,
  memberId,
  memberName,
  currentDept = "operations",
  onSuccess,
  staffList: initialStaffList = [],
}: TransferQueryModalProps) {
  const [toDepartment, setToDepartment] = useState("sourcing");
  const [staffList, setStaffList] = useState(initialStaffList);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (staffList.length === 0 && isOpen) {
      getStaffDirectory().then((res) => {
        if (res.success && res.users) {
          setStaffList(res.users);
        }
      });
    }
  }, [isOpen, staffList.length]);

  if (!isOpen) return null;

  const filteredStaff = staffList.filter((s) => {
    if (!toDepartment) return true;
    const sDept = (s.department || "").toLowerCase();
    const target = toDepartment.toLowerCase();
    return sDept.includes(target) || target.includes(sDept);
  });

  const selectedStaffObj = staffList.find((s) => s.id === selectedStaffId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error("Please explain the reason for the query transfer.");
      return;
    }

    setLoading(true);
    try {
      const res = await transferQuery(
        memberId,
        currentDept,
        toDepartment,
        selectedStaffId || undefined,
        reason,
        priority,
        selectedStaffObj?.name || undefined,
        selectedStaffObj?.email || undefined
      );

      if (res.success) {
        toast.success(
          `Query transferred to ${toDepartment.toUpperCase()}${
            selectedStaffObj ? ` (${selectedStaffObj.name})` : ""
          }`
        );
        onSuccess();
        onClose();
        setReason("");
        setSelectedStaffId("");
      } else {
        toast.error(res.error || "Failed to transfer query");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to transfer query");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 text-slate-900 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-purple-50 text-purple-700 border border-purple-200">
              <SendHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Cross-Department Query Transfer
              </h2>
              <p className="text-xs text-slate-500">
                Route member inquiry for{" "}
                <span className="text-amber-700 font-bold">{memberName}</span>
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
          {/* Target Department Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Select Target Department *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {DEPARTMENTS.map((dept) => {
                const isSelected = toDepartment === dept.id;
                return (
                  <button
                    key={dept.id}
                    type="button"
                    onClick={() => {
                      setToDepartment(dept.id);
                      setSelectedStaffId("");
                    }}
                    className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? "bg-purple-50 border-purple-400 text-purple-900 shadow-xs ring-2 ring-purple-400/40 font-bold"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <div className="text-xs font-bold">{dept.label}</div>
                    <div className="text-[10px] text-slate-500 truncate mt-0.5">{dept.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Priority & Assignee Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Priority Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Priority Level
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {(
                  [
                    { id: "low", label: "Low", color: "bg-slate-100 text-slate-700 border-slate-200" },
                    { id: "medium", label: "Medium", color: "bg-blue-50 text-blue-800 border-blue-200 font-bold" },
                    { id: "high", label: "High", color: "bg-amber-50 text-amber-800 border-amber-300 font-bold" },
                    { id: "urgent", label: "Urgent", color: "bg-red-50 text-red-800 border-red-300 font-bold animate-pulse" },
                  ] as const
                ).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPriority(p.id)}
                    className={`py-2 px-2 text-[11px] rounded-xl border transition-all text-center cursor-pointer ${
                      priority === p.id
                        ? `${p.color} ring-2 ring-slate-400/30 shadow-xs font-bold`
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Specific Employee Assignment */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Assign Specific Employee (Optional)
              </label>
              <div className="relative">
                <UserCheck className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <select
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-purple-500 focus:bg-white text-xs cursor-pointer font-medium"
                >
                  <option value="">-- Any Available Executive in {toDepartment.toUpperCase()} --</option>
                  {filteredStaff.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.name} ({staff.role || "Executive"} - {staff.email})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Issue Context & Transfer Reason */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Issue Context & Action Required *
            </label>
            <textarea
              required
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Member needs assistance with Helium 10 keyword analysis for kitchen niche. Please connect with member and assist in validating search volume."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:bg-white text-sm leading-relaxed font-medium"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
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
              className="px-6 py-2.5 text-sm font-bold text-white bg-purple-700 hover:bg-purple-800 rounded-xl shadow-xs disabled:opacity-50 transition-all cursor-pointer"
            >
              {loading ? "Routing Query..." : "Transfer Query"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
