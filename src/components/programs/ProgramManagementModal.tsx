"use client";

import { useState } from "react";
import {
  X,
  Plus,
  Trash2,
  Edit2,
  Sparkles,
  Layers,
  Check,
  AlertCircle,
  FolderPlus,
  ShieldCheck,
} from "lucide-react";
import {
  createProgram,
  updateProgram,
  deleteProgram,
  ProgramInput,
} from "@/app/actions/programActions";
import { useRouter } from "next/navigation";

interface ProgramManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  programs: any[];
  onProgramsUpdated?: (programs: any[]) => void;
  currentUserRole?: string;
}

const ICON_PRESETS = ["👑", "⚡", "🚀", "💎", "📈", "🛍️", "🎯", "💼", "🏆", "🌟", "🔥", "🌐"];

const COLOR_PRESETS = [
  { id: "amber", name: "Gold / Amber", hex: "#b45309", bg: "bg-amber-100 border-amber-300 text-amber-900" },
  { id: "cyan", name: "Cyan / Sky", hex: "#0e7490", bg: "bg-cyan-100 border-cyan-300 text-cyan-950" },
  { id: "purple", name: "Purple / Indigo", hex: "#7e22ce", bg: "bg-purple-100 border-purple-300 text-purple-950" },
  { id: "emerald", name: "Emerald / Green", hex: "#059669", bg: "bg-emerald-100 border-emerald-300 text-emerald-950" },
  { id: "blue", name: "Blue / Royal", hex: "#2563eb", bg: "bg-blue-100 border-blue-300 text-blue-950" },
  { id: "rose", name: "Rose / Ruby", hex: "#e11d48", bg: "bg-rose-100 border-rose-300 text-rose-950" },
  { id: "orange", name: "Orange / Sunset", hex: "#ea580c", bg: "bg-orange-100 border-orange-300 text-orange-950" },
  { id: "slate", name: "Slate / Classic", hex: "#475569", bg: "bg-slate-100 border-slate-300 text-slate-900" },
];

export default function ProgramManagementModal({
  isOpen,
  onClose,
  programs: initialPrograms,
  onProgramsUpdated,
  currentUserRole,
}: ProgramManagementModalProps) {
  const router = useRouter();
  const [programsList, setProgramsList] = useState(initialPrograms);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<ProgramInput>({
    name: "",
    codePrefix: "",
    description: "",
    icon: "🚀",
    color: "#7e22ce",
    badgeColor: "purple",
  });

  if (!isOpen) return null;

  const isAdmin = currentUserRole?.trim().toLowerCase() === "admin";

  const resetForm = () => {
    setFormData({
      name: "",
      codePrefix: "",
      description: "",
      icon: "🚀",
      color: "#7e22ce",
      badgeColor: "purple",
    });
    setEditingId(null);
    setIsCreating(false);
    setError(null);
  };

  const handleNameChange = (name: string) => {
    // Automatically propose a code prefix if user hasn't typed a custom one
    let prefix = formData.codePrefix;
    if (!editingId && (!prefix || prefix.length <= 4)) {
      const words = name.trim().split(/\s+/).filter(Boolean);
      if (words.length > 1) {
        prefix = words.map((w) => w[0].toUpperCase()).join("").slice(0, 4);
      } else if (words.length === 1 && words[0].length >= 3) {
        prefix = words[0].slice(0, 3).toUpperCase();
      }
    }
    setFormData({ ...formData, name, codePrefix: prefix });
  };

  const handleSaveProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (editingId) {
        const res = await updateProgram(editingId, formData);
        if (!res.success) {
          setError(res.error || "Failed to update program");
          setLoading(false);
          return;
        }
        const updatedPrograms = programsList.map((p) =>
          p.id === editingId ? res.program : p
        );
        setProgramsList(updatedPrograms);
        onProgramsUpdated?.(updatedPrograms);
        setSuccess(`Program "${formData.name}" updated successfully!`);
      } else {
        const res = await createProgram(formData);
        if (!res.success) {
          setError(res.error || "Failed to create program");
          setLoading(false);
          return;
        }
        const updatedPrograms = [...programsList, res.program];
        setProgramsList(updatedPrograms);
        onProgramsUpdated?.(updatedPrograms);
        setSuccess(`Program "${formData.name}" created successfully!`);
      }

      router.refresh();
      resetForm();
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProgram = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete the "${name}" program?`)) return;

    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const res = await deleteProgram(id);
      if (!res.success) {
        setError(res.error || "Failed to delete program");
        setLoading(false);
        return;
      }
      const updatedPrograms = programsList.filter((p) => p.id !== id);
      setProgramsList(updatedPrograms);
      onProgramsUpdated?.(updatedPrograms);
      setSuccess(`Program "${name}" deleted successfully.`);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to delete program");
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (prog: any) => {
    setEditingId(prog.id);
    setFormData({
      name: prog.name,
      codePrefix: prog.codePrefix,
      description: prog.description || "",
      icon: prog.icon || "👑",
      color: prog.color || "#b45309",
      badgeColor: prog.badgeColor || "amber",
    });
    setIsCreating(true);
    setError(null);
    setSuccess(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2 text-amber-700 font-bold text-xs uppercase tracking-wider mb-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Program & Course Architecture</span>
            </div>
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-amber-600" />
              Manage CRM Programs & Cohorts
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 font-semibold flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* Create / Edit Form */}
          {isCreating ? (
            <form onSubmit={handleSaveProgram} className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <FolderPlus className="w-4 h-4 text-amber-600" />
                  {editingId ? "Edit Program" : "Add New Program (e.g. Amazon Wealth Shortcut)"}
                </h3>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs text-slate-500 hover:text-slate-800 font-bold"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Program Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="e.g. Amazon Wealth Shortcut"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-semibold text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Code Prefix (for Member ID) *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={formData.codePrefix}
                    onChange={(e) => setFormData({ ...formData, codePrefix: e.target.value.toUpperCase() })}
                    placeholder="e.g. AWS, PLT, PNP"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-black text-sm uppercase focus:outline-none focus:border-amber-500"
                  />
                  <span className="text-[10px] text-slate-500 font-medium">
                    Members will be assigned: <strong className="text-slate-800">{formData.codePrefix || "CODE"}-2026-001</strong>
                  </span>
                </div>
              </div>

              {/* Icon Picker */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Program Icon
                </label>
                <div className="flex flex-wrap gap-2">
                  {ICON_PRESETS.map((icon) => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setFormData({ ...formData, icon })}
                      className={`w-9 h-9 rounded-xl border text-base flex items-center justify-center transition-all cursor-pointer ${
                        formData.icon === icon
                          ? "bg-amber-100 border-amber-400 ring-2 ring-amber-400/40 scale-110 shadow-xs"
                          : "bg-white border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Theme */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Theme Color & Badge Style
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {COLOR_PRESETS.map((col) => (
                    <button
                      key={col.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, badgeColor: col.id, color: col.hex })}
                      className={`p-2 rounded-xl border text-left text-xs font-bold transition-all cursor-pointer flex items-center justify-between ${
                        formData.badgeColor === col.id
                          ? `${col.bg} ring-2 ring-slate-900/20 shadow-xs font-black`
                          : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      <span>{col.name}</span>
                      {formData.badgeColor === col.id && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Description / Subtitle
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g. Fast-paced Amazon scaling & wealth blueprint"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs shadow-xs transition-colors flex items-center gap-1.5"
                >
                  {loading ? "Saving..." : editingId ? "Save Changes" : "Create Program"}
                </button>
              </div>
            </form>
          ) : (
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-600">
                Active Programs ({programsList.length})
              </div>
              {isAdmin && (
                <button
                  onClick={() => setIsCreating(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add New Program</span>
                </button>
              )}
            </div>
          )}

          {/* Program Cards List */}
          <div className="space-y-3">
            {programsList.map((prog) => {
              const col = COLOR_PRESETS.find((c) => c.id === prog.badgeColor) || COLOR_PRESETS[0];
              const isDefault = prog.name === "Platinum" || prog.name === "PNP";

              return (
                <div
                  key={prog.id || prog.name}
                  className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 shadow-2xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-2xl shrink-0 shadow-2xs">
                      {prog.icon || "👑"}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-black text-slate-900">{prog.name}</span>
                        <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black border ${col.bg}`}>
                          ID: {prog.codePrefix}-2026-XXX
                        </span>
                        {isDefault && (
                          <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-md">
                            Core
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {prog.description || "Active CRM Program"}
                      </p>
                    </div>
                  </div>

                  {isAdmin && (
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        onClick={() => startEdit(prog)}
                        className="p-2 rounded-xl text-slate-600 hover:text-slate-950 hover:bg-slate-100 transition-colors cursor-pointer"
                        title="Edit program"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {!isDefault && (
                        <button
                          onClick={() => handleDeleteProgram(prog.id, prog.name)}
                          className="p-2 rounded-xl text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                          title="Delete program"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-amber-600" />
            <span>Admins can create unlimited custom programs and cohorts.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
