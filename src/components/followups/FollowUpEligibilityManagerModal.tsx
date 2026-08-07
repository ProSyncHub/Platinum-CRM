"use client";

import { useMemo, useState } from "react";
import { Search, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { setMemberFollowUpPreference } from "@/app/actions/followupActions";
import {
  isMemberFollowUpEligible,
  normalizeFollowUpPreference,
  type FollowUpPreference,
} from "@/lib/followupEligibility";

interface EligibilityMember {
  id: string;
  fullName: string;
  memberCode: string;
  programType?: string | null;
  activeStatus?: string | null;
  endDate?: string | Date | null;
  followUpPreference?: string | null;
  followUpPreferenceReason?: string | null;
  followUpPreferenceUpdatedBy?: string | null;
}

interface FollowUpEligibilityManagerModalProps {
  members: EligibilityMember[];
  generatedAt: string;
  onClose: () => void;
}

export default function FollowUpEligibilityManagerModal({
  members,
  generatedAt,
  onClose,
}: FollowUpEligibilityManagerModalProps) {
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<"all" | "included" | "excluded">("all");
  const [preferences, setPreferences] = useState<Record<string, FollowUpPreference>>(
    () => Object.fromEntries(
      members.map((member) => [member.id, normalizeFollowUpPreference(member.followUpPreference)]),
    ),
  );
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return members.filter((member) => {
      const effectiveMember = {
        ...member,
        followUpPreference: preferences[member.id],
      };
      const included = isMemberFollowUpEligible(effectiveMember, generatedAt);
      if (scope === "included" && !included) return false;
      if (scope === "excluded" && included) return false;
      if (!query) return true;
      return [member.fullName, member.memberCode, member.programType]
        .some((value) => value?.toLowerCase().includes(query));
    });
  }, [generatedAt, members, preferences, scope, search]);

  const updatePreference = async (memberId: string, preference: FollowUpPreference) => {
    setUpdatingId(memberId);
    try {
      const result = await setMemberFollowUpPreference({ memberId, preference });
      if (!result.success) {
        toast.error(result.error || "Unable to update follow-up eligibility");
        return;
      }
      setPreferences((current) => ({ ...current, [memberId]: preference }));
      toast.success(
        preference === "never"
          ? "Member removed from follow-ups"
          : preference === "always"
            ? "Member will always appear in follow-ups"
            : "Automatic follow-up rules restored",
      );
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Unable to update eligibility");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-6">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl border border-violet-200 bg-violet-50 p-3 text-violet-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-violet-700">Super Admin Control</p>
              <h2 className="text-lg font-bold text-slate-900">Manage Follow-Up Eligibility</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Automatic includes active members and memberships expired within the last two months.
              </p>
            </div>
          </div>
          <button type="button" aria-label="Close follow-up eligibility manager" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-[1fr_auto]">
          <div className="relative">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              aria-label="Search follow-up eligibility members"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search member, code, or program"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-3 text-xs focus:border-violet-500 focus:bg-white focus:outline-none"
            />
          </div>
          <select
            aria-label="Filter follow-up eligibility"
            value={scope}
            onChange={(event) => setScope(event.target.value as typeof scope)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium focus:border-violet-500 focus:outline-none"
          >
            <option value="all">All members</option>
            <option value="included">Included in follow-ups</option>
            <option value="excluded">Excluded from follow-ups</option>
          </select>
        </div>

        <div className="overflow-auto p-4">
          <table className="w-full min-w-[800px] text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <th className="px-3 py-3">Member</th>
                <th className="px-3 py-3">Membership</th>
                <th className="px-3 py-3">Effective Result</th>
                <th className="px-3 py-3">Follow-Up Rule</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMembers.map((member) => {
                const preference = preferences[member.id] || "auto";
                const included = isMemberFollowUpEligible(
                  { ...member, followUpPreference: preference },
                  generatedAt,
                );
                return (
                  <tr key={member.id} className="hover:bg-slate-50/80">
                    <td className="px-3 py-3.5">
                      <p className="font-bold text-slate-900">{member.fullName}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-slate-500">{member.memberCode} · {member.programType || "Program"}</p>
                    </td>
                    <td className="px-3 py-3.5">
                      <p className="font-medium text-slate-700">{member.activeStatus || "Unknown"}</p>
                      <p className="mt-0.5 text-[10px] text-slate-500">
                        {member.endDate
                          ? `Ends ${new Date(member.endDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}`
                          : "No expiry recorded"}
                      </p>
                    </td>
                    <td className="px-3 py-3.5">
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${included ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-600"}`}>
                        {included ? "Included" : "Not followed"}
                      </span>
                    </td>
                    <td className="px-3 py-3.5">
                      <select
                        aria-label={`Follow-up rule for ${member.fullName}`}
                        disabled={updatingId === member.id}
                        value={preference}
                        onChange={(event) => updatePreference(member.id, event.target.value as FollowUpPreference)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold focus:border-violet-500 focus:outline-none disabled:opacity-50"
                      >
                        <option value="auto">Automatic eligibility</option>
                        <option value="always">Always follow</option>
                        <option value="never">Do not follow</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
