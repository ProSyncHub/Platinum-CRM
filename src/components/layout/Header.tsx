"use client";

import { useSession, signOut } from "next-auth/react";
import { LogOut, Shield, Briefcase, UserCheck, Bell, Sparkles } from "lucide-react";
import Link from "next/link";

export default function Header() {
  const { data: session } = useSession();

  const user = session?.user;
  const role = user?.role;
  const department = user?.department;

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  const getRoleBadge = (role?: string) => {
    switch (role?.toLowerCase()) {
      case "admin":
      case "superadmin":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-[11px] font-bold text-purple-700">
            <Shield size={10} className="text-purple-600" />
            Super Admin
          </span>
        );
      case "manager":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">
            <Briefcase size={10} className="text-amber-600" />
            Manager
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
            <UserCheck size={10} className="text-slate-500" />
            Employee
          </span>
        );
    }
  };

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200/90 bg-white/95 px-6 backdrop-blur-md sticky top-0 z-30 shadow-xs">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-amber-700 uppercase tracking-wider bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-500" />
            ProSync CRM
          </span>
          <span className="text-xs text-slate-300 hidden sm:inline">•</span>
          <span className="text-xs font-semibold text-slate-500 hidden sm:inline">
            Platinum & PNP Operations Center
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Quick Link to Escalations / Followups */}
        <Link
          href="/followups"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-amber-50 text-slate-700 hover:text-amber-800 border border-slate-200 text-xs font-bold transition-all shadow-xs"
          title="Weekly Follow-ups & Escalations"
        >
          <Bell className="w-3.5 h-3.5 text-amber-500" />
          <span className="hidden md:inline">Weekly Follow-Ups</span>
        </Link>

        {user && (
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900">
                  {user.name}
                </span>
                {getRoleBadge(role)}
              </div>
              <span className="text-[11px] text-slate-500 capitalize font-medium">
                {department || "Operations"}
              </span>
            </div>

            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 text-xs font-extrabold text-slate-950 shadow-sm">
              {initials}
            </div>

            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              title="Sign Out"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors cursor-pointer shadow-xs"
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
