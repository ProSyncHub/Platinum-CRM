"use client";

import { useState } from "react";
import { X, ArrowRightCircle, Sparkles, CheckCircle2 } from "lucide-react";
import { advanceMemberStage } from "@/app/actions/memberActions";
import { PLATINUM_STAGES, StageId } from "@/lib/membershipUtils";
import { toast } from "sonner";

interface AdvanceStageModalProps {
  isOpen: boolean;
  onClose: () => void;
  memberId: string;
  memberName: string;
  currentStage: string;
  onSuccess: () => void;
}

export default function AdvanceStageModal({
  isOpen,
  onClose,
  memberId,
  memberName,
  currentStage,
  onSuccess,
}: AdvanceStageModalProps) {
  const [targetStage, setTargetStage] = useState<StageId>(
    (currentStage as StageId) || "onboarding"
  );
  const [transitionNotes, setTransitionNotes] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await advanceMemberStage(memberId, targetStage, transitionNotes);
      if (res.success) {
        toast.success(`Stage updated for ${memberName}!`);
        onSuccess();
        onClose();
      } else {
        toast.error(res.error || "Failed to update stage");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update stage");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 text-slate-900 space-y-5">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-700 border border-amber-200">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Update Journey Stage</h2>
              <p className="text-xs text-slate-500">
                Move <span className="text-amber-700 font-bold">{memberName}</span> along the 5 Milestones
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Select Current Milestone / Stage
            </label>

            <div className="space-y-2">
              {PLATINUM_STAGES.map((s) => {
                const isSelected = targetStage === s.id;
                const isCurrent = currentStage === s.id;

                return (
                  <div
                    key={s.id}
                    onClick={() => setTargetStage(s.id)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? "bg-amber-50 border-amber-400 text-slate-900 shadow-xs ring-2 ring-amber-400/40"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                          isSelected
                            ? "bg-amber-500 text-slate-950"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {s.number.replace("0", "")}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold">{s.name}</span>
                          {isCurrent && (
                            <span className="px-1.5 py-0.5 text-[10px] font-extrabold bg-slate-900 text-white rounded">
                              CURRENT
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">{s.description}</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-semibold text-amber-700">
                        {s.milestone}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Stage Transition Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={transitionNotes}
              onChange={(e) => setTransitionNotes(e.target.value)}
              placeholder="e.g. Completed initial research call. 3 product approvals granted for Havells / Home & Kitchen..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white text-sm font-medium"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs disabled:opacity-50 transition-all cursor-pointer"
            >
              <ArrowRightCircle className="w-4 h-4 text-amber-400" />
              {loading ? "Updating..." : "Update Milestone"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
