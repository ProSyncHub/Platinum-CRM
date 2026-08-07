"use client";

import { useState } from "react";
import { X, CheckCircle2 } from "lucide-react";
import { resolveQueryTransfer } from "@/app/actions/memberActions";
import { toast } from "sonner";
import { COMMUNICATION_MEDIUMS, MediumId } from "@/lib/membershipUtils";

interface ResolveQueryModalProps {
  isOpen: boolean;
  onClose: () => void;
  transferId: string;
  memberName: string;
  transferReason: string;
  toDepartment: string;
  onSuccess: () => void;
}

export default function ResolveQueryModal({
  isOpen,
  onClose,
  transferId,
  memberName,
  transferReason,
  toDepartment,
  onSuccess,
}: ResolveQueryModalProps) {
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [resolutionMedium, setResolutionMedium] = useState<MediumId>("phone");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolutionNotes.trim()) {
      toast.error("Please provide resolution notes explaining the solution.");
      return;
    }

    setLoading(true);
    try {
      const res = await resolveQueryTransfer(transferId, resolutionNotes, resolutionMedium);
      if (res.success) {
        toast.success("Query resolved and logged successfully!");
        onSuccess();
        onClose();
        setResolutionNotes("");
      } else {
        toast.error(res.error || "Failed to resolve query");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to resolve query");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 text-slate-900 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Resolve Department Query
              </h2>
              <p className="text-xs text-slate-500">
                Member: <span className="text-amber-700 font-bold">{memberName}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close resolution form"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Transferred Reason Box */}
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-purple-200 space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-purple-700 font-bold uppercase">Original Inquiry</span>
            <span className="text-slate-500 font-semibold uppercase">{toDepartment}</span>
          </div>
          <p className="text-xs text-slate-700 leading-relaxed font-medium">{transferReason}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="resolution-medium" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Resolution contact medium *
            </label>
            <select
              required
              id="resolution-medium"
              value={resolutionMedium}
              onChange={(event) => setResolutionMedium(event.target.value as MediumId)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none"
            >
              {Object.values(COMMUNICATION_MEDIUMS)
                .filter((medium) => medium.id !== "internal")
                .map((medium) => (
                  <option key={medium.id} value={medium.id}>{medium.label}</option>
                ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-500">
              Select how the member was actually contacted while resolving this issue.
            </p>
          </div>

          <div>
            <label htmlFor="resolution-notes" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Resolution Action & Guidance Provided *
            </label>
            <textarea
              required
              id="resolution-notes"
              rows={4}
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              placeholder="Explain how this issue was resolved, advice given to student/member, or documentation shared..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white text-sm leading-relaxed font-medium"
            />
          </div>

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
              className="px-5 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs disabled:opacity-50 transition-all cursor-pointer"
            >
              {loading ? "Resolving..." : "Complete & Close Query"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
