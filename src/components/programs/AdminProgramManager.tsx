"use client";

import { useState } from "react";
import { FolderPlus, Layers3 } from "lucide-react";
import ProgramManagementModal from "./ProgramManagementModal";

interface AdminProgramManagerProps {
  initialPrograms: Array<{
    id?: string;
    name: string;
    codePrefix: string;
    description?: string | null;
    icon?: string | null;
    color?: string | null;
    badgeColor?: string | null;
    active?: boolean;
  }>;
  compact?: boolean;
}

export default function AdminProgramManager({
  initialPrograms,
  compact = false,
}: AdminProgramManagerProps) {
  const [programs, setPrograms] = useState(initialPrograms);
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={
          compact
            ? "group flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white p-3.5 text-left text-xs transition-colors hover:border-blue-300 hover:bg-blue-50/50"
            : "inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
        }
      >
        {compact ? (
          <>
            <span className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700">
                <Layers3 size={16} />
              </span>
              <span>
                <span className="block font-semibold text-slate-900">Programs & cohorts</span>
                <span className="mt-0.5 block text-[11px] font-normal text-slate-500">
                  {programs.length} active programs · add or configure
                </span>
              </span>
            </span>
            <FolderPlus size={16} className="text-slate-400 group-hover:text-blue-700" />
          </>
        ) : (
          <>
            <FolderPlus size={16} />
            Add or manage programs
          </>
        )}
      </button>

      <ProgramManagementModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        programs={programs}
        onProgramsUpdated={setPrograms}
        currentUserRole="admin"
      />
    </>
  );
}
