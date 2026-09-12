"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navigation } from "@/lib/constants/navigation";
import { cn } from "@/lib/utils";
import { useSession } from "next-auth/react";

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role?.trim().toLowerCase();
  const isAdmin = role === "owner" || role === "admin" || role === "superadmin";
  const canManageTeam = isAdmin || role === "manager";
  const [counts, setCounts] = useState({ queries: 0, wati: 0 });
  const [access, setAccess] = useState({ leads: isAdmin, wati: isAdmin });

  useEffect(() => {
    if (!session?.user) return;
    let active = true;
    async function loadCounts() {
      try {
        const response = await fetch("/api/navigation/counts", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as Partial<typeof counts> & {
          access?: Partial<typeof access>;
        };
        if (active) {
          setCounts({
            queries: Number(data.queries || 0),
            wati: Number(data.wati || 0),
          });
          const nextAccess = data.access as Partial<typeof access> | undefined;
          setAccess({
            leads: Boolean(nextAccess?.leads || isAdmin),
            wati: Boolean(nextAccess?.wati || isAdmin),
          });
        }
      } catch {
        // Navigation counts are best-effort only.
      }
    }
    void loadCounts();
    const interval = window.setInterval(loadCounts, 60_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [session?.user, isAdmin]);

  function notificationCount(href: string) {
    if (href === "/queries") return counts.queries;
    if (href === "/wati") return counts.wati;
    return 0;
  }

  return (
    <aside className="w-64 border-r border-slate-200 bg-white flex flex-col justify-between select-none shadow-xs">
      <div>
        {/* Brand Header */}
        <div className="border-b border-slate-100 p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 via-amber-400 to-amber-300 flex items-center justify-center text-slate-950 font-black text-base shadow-sm">
              P
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-1.5">
                ProSync CRM
              </h2>
              <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">
                Platinum & PNP Ops
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1 p-3.5">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isTeam = item.href === "/team";
            const isApproval = item.href === "/approvals";
            const isLeads = item.href === "/leads";
            const isWati = item.href === "/wati";
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));

            if (isTeam && !canManageTeam) return null;
            if (item.adminOnly && !isAdmin) return null;
            if (isLeads && !access.leads) return null;
            if (isWati && !access.wati) return null;
            const badgeCount = notificationCount(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all",
                  isActive
                    ? "bg-slate-900 text-white shadow-sm shadow-slate-900/20"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    size={18}
                    className={cn(
                      "transition-colors",
                      isActive ? "text-amber-400" : "text-slate-400 group-hover:text-slate-600"
                    )}
                  />
                  <span>{item.title}</span>
                </div>
                {(isTeam || isApproval) && isAdmin && (
                  <span
                    className={cn(
                      "rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase",
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-purple-100 text-purple-700"
                    )}
                  >
                      {isApproval ? "Admin" : "Super Admin"}
                  </span>
                )}
                {badgeCount > 0 && !(isTeam || isApproval) && (
                  <span
                    className={cn(
                      "ml-2 min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10px] font-black",
                      isActive
                        ? "bg-amber-400 text-slate-950"
                        : "bg-rose-100 text-rose-700"
                    )}
                  >
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer info badge */}
      <div className="p-3.5 border-t border-slate-100">
        <div className="rounded-2xl bg-slate-50 p-3 text-xs border border-slate-200/80 space-y-1">
          <p className="font-bold text-slate-800 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              ProSync CRM Cloud
            </span>
            <span className="text-[10px] text-amber-600 font-mono font-bold">v2.5</span>
          </p>
          <p className="text-[10px] text-slate-500">Weekly Mentorship & Operations</p>
        </div>
      </div>
    </aside>
  );
}
