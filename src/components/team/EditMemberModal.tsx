"use client";

import { useState, useEffect } from "react";
import { updateTeamMember } from "@/app/actions/userManagement";
import { toast } from "sonner";
import { Edit3, Shield, UserCheck, Briefcase, Key } from "lucide-react";

interface EditMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  user: {
    id: string;
    name: string;
    email: string;
    role: "admin" | "manager" | "employee";
    department: string;
    active: boolean;
  } | null;
  existingDepartments: string[];
}

const COMMON_DEPARTMENTS = [
  "Operations",
  "Sales",
  "Customer Success",
  "Onboarding",
  "Support",
  "Research",
  "Sourcing",
  "Retention",
];

export default function EditMemberModal({
  isOpen,
  onClose,
  onSuccess,
  user,
  existingDepartments,
}: EditMemberModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "manager" | "employee">("employee");
  const [department, setDepartment] = useState("");
  const [active, setActive] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setRole(user.role);
      setDepartment(user.department || "");
      setActive(user.active);
      setPassword("");
    }
  }, [user]);

  if (!isOpen || !user) return null;

  const departmentSuggestions = Array.from(
    new Set([...existingDepartments, ...COMMON_DEPARTMENTS])
  ).filter(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !department.trim()) {
      toast.error("Please fill in all required fields.");
      return;
    }

    if (password && password.length < 6) {
      toast.error("New password must be at least 6 characters.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await updateTeamMember(user.id, {
        name: name.trim(),
        email: email.trim(),
        role,
        department: department.trim(),
        active,
        password: password.trim() ? password.trim() : undefined,
      });

      if (res.success) {
        toast.success(`Updated ${name}'s profile successfully.`);
        onSuccess();
        onClose();
      } else {
        toast.error(res.error || "Failed to update user.");
      }
    } catch (err) {
      console.error(err);
      toast.error("An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
              <Edit3 size={18} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Edit Team Member</h2>
              <p className="text-xs text-slate-500">Update role, department, or status</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Full Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm focus:border-slate-900 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Email Address *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm focus:border-slate-900 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Account Role *
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setRole("employee")}
                className={`flex flex-col items-center justify-center gap-1 rounded-lg border p-3 text-xs font-medium transition-all ${
                  role === "employee"
                    ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
              >
                <UserCheck size={16} />
                <span>Employee</span>
              </button>

              <button
                type="button"
                onClick={() => setRole("manager")}
                className={`flex flex-col items-center justify-center gap-1 rounded-lg border p-3 text-xs font-medium transition-all ${
                  role === "manager"
                    ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
              >
                <Briefcase size={16} />
                <span>Manager</span>
              </button>

              <button
                type="button"
                onClick={() => setRole("admin")}
                className={`flex flex-col items-center justify-center gap-1 rounded-lg border p-3 text-xs font-medium transition-all ${
                  role === "admin"
                    ? "border-purple-600 bg-purple-600 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
              >
                <Shield size={16} />
                <span>Admin</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Department *
            </label>
            <input
              type="text"
              required
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="e.g. Operations, Sales, Retention..."
              className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm focus:border-slate-900 focus:outline-none"
            />
            {departmentSuggestions.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-slate-400">Suggestions:</span>
                {departmentSuggestions.slice(0, 6).map((dept) => (
                  <button
                    key={dept}
                    type="button"
                    onClick={() => setDepartment(dept)}
                    className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-100"
                  >
                    {dept}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Key size={13} className="text-slate-400" />
              Reset Password (Optional)
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave blank to keep existing password"
              className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm focus:border-slate-900 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div>
              <p className="text-xs font-semibold text-slate-900">Account Status</p>
              <p className="text-[11px] text-slate-500">Inactive accounts cannot log into the CRM</p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="peer sr-only"
              />
              <div className="peer h-5 w-9 rounded-full bg-slate-300 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-600 peer-checked:after:translate-x-full peer-focus:outline-none"></div>
            </label>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow hover:bg-slate-800 disabled:opacity-50"
            >
              {isLoading ? "Saving Changes..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
