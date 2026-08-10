"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  LayoutDashboard,
  Search,
  ShieldCheck,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { searchWorkspaceMembers } from "@/app/actions/workspaceActions";
import RegisterMemberModal from "@/components/workspace/RegisterMemberModal";

interface SearchResult {
  id: string;
  memberCode: string;
  fullName: string;
  phone: string;
  email: string;
  programType: string;
  activeStatus: string;
  approvalStatus: string;
  department: string | null;
  currentStage: string;
  healthStatus: string;
  lastConnectDate: string | null;
  lastContactStaff: string | null;
  suggestedByName?: boolean;
}

interface Props {
  programs: Array<{ id: string; name: string }>;
  userName: string;
  department: string;
  isAdmin: boolean;
  pendingApprovals: number;
}

export default function MemberWorkspaceClient({
  programs,
  userName,
  department,
  isAdmin,
  pendingApprovals,
}: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [message, setMessage] = useState("");
  const [searched, setSearched] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const searchTerm = query.trim();
    if (searchTerm.length < 3) return;

    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        const response = await searchWorkspaceMembers(searchTerm);
        if (!active) return;
        setSuggestions(
          response.success ? (response.members as SearchResult[]).slice(0, 6) : [],
        );
      } catch {
        if (active) setSuggestions([]);
      } finally {
        if (active) setIsSuggesting(false);
      }
    }, 300);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    setSuggestionsOpen(false);
    startTransition(async () => {
      const response = await searchWorkspaceMembers(query);
      setSearched(true);
      setResults(response.members as SearchResult[]);
      if (!response.success) setMessage(response.error || "Search failed.");
      else if (response.members.length === 0) {
        setMessage("No matching member is visible to your department.");
      }
    });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-700">
              <UsersRound className="h-4 w-4" />
              Member workspace
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">
              Find a customer. See the whole journey.
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Search by phone number or email, then log the conversation or transfer the issue to the right team.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isAdmin && (
              <Link
                href="/approvals"
                className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-semibold text-violet-800 hover:bg-violet-100"
              >
                <ShieldCheck className="h-4 w-4" />
                Approvals {pendingApprovals > 0 && `(${pendingApprovals})`}
              </Link>
            )}
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <LayoutDashboard className="h-4 w-4" />
              Open overview
            </Link>
            <button
              type="button"
              onClick={() => setRegisterOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              <UserPlus className="h-4 w-4 text-amber-400" />
              Register new member
            </button>
          </div>
        </div>

        <form onSubmit={handleSearch} className="mt-7 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus
              value={query}
              onChange={(event) => {
                const value = event.target.value;
                setQuery(value);
                setMessage("");
                setSuggestionsOpen(value.trim().length >= 3);
                setIsSuggesting(value.trim().length >= 3);
                if (value.trim().length < 3) setSuggestions([]);
              }}
              onFocus={() => {
                if (query.trim().length >= 3) setSuggestionsOpen(true);
              }}
              placeholder="Phone number, email, member code, or name"
              autoComplete="off"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={suggestionsOpen}
              aria-controls="member-search-suggestions"
              className="h-14 w-full rounded-2xl border border-slate-300 bg-slate-50 pl-12 pr-4 text-base text-slate-950 outline-none transition focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-100"
            />
            {isSuggesting && suggestionsOpen && (
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                Finding...
              </span>
            )}

            {suggestionsOpen && !isSuggesting && suggestions.length > 0 && (
              <div
                id="member-search-suggestions"
                role="listbox"
                className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-40 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl"
              >
                <p className="px-3 pb-2 pt-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  Suggested members
                </p>
                {suggestions.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    role="option"
                    aria-selected="false"
                    onClick={() => {
                      setSuggestionsOpen(false);
                      router.push(`/workspace/${member.id}`);
                    }}
                    className="flex w-full items-center justify-between gap-4 rounded-xl px-3 py-3 text-left hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-950">{member.fullName}</span>
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                          {member.programType}
                        </span>
                        {member.approvalStatus === "pending" && (
                          <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                            Pending approval
                          </span>
                        )}
                        {member.suggestedByName && (
                          <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-800">
                            Possible name match
                          </span>
                        )}
                      </div>
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {member.phone} · {member.email}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
                  </button>
                ))}
                <button
                  type="submit"
                  className="mt-1 w-full rounded-xl border-t border-slate-100 px-3 py-2.5 text-left text-xs font-bold text-amber-700 hover:bg-amber-50"
                >
                  Show all matching results
                </button>
              </div>
            )}

            {suggestionsOpen && !isSuggesting && suggestions.length === 0 && (
              <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-40 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
                <p className="text-sm font-semibold text-slate-800">No matching member found.</p>
                <button
                  type="button"
                  onClick={() => {
                    setSuggestionsOpen(false);
                    setRegisterOpen(true);
                  }}
                  className="mt-1 text-xs font-bold text-amber-700 hover:underline"
                >
                  Register this person
                </button>
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="h-14 rounded-2xl bg-amber-500 px-7 text-sm font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-60"
          >
            {isPending ? "Searching..." : "Search member"}
          </button>
        </form>
      </section>

      {searched && (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Search results</h2>
              <p className="text-sm text-slate-500">Open a member to view the complete journey.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {results.length} found
            </span>
          </div>

          {message && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              {message}
              {results.length === 0 && (
                <button
                  type="button"
                  onClick={() => setRegisterOpen(true)}
                  className="ml-2 font-bold underline underline-offset-2"
                >
                  Register this person
                </button>
              )}
            </div>
          )}

          <div className="divide-y divide-slate-100">
            {results.map((member) => (
              <button
                key={member.id}
                type="button"
                onClick={() => router.push(`/workspace/${member.id}`)}
                className="flex w-full items-center justify-between gap-4 rounded-2xl px-3 py-4 text-left transition hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-slate-950">{member.fullName}</p>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                      {member.programType}
                    </span>
                    {member.approvalStatus === "pending" && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                        <Clock3 className="h-3 w-3" /> Pending approval
                      </span>
                    )}
                    {member.suggestedByName && (
                      <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-800">
                        Possible name match
                      </span>
                    )}
                    {member.approvalStatus === "approved" && (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    )}
                  </div>
                  <p className="mt-1 truncate text-sm text-slate-600">
                    {member.phone} · {member.email}
                  </p>
                  <p className="mt-1 text-xs capitalize text-slate-400">
                    {member.memberCode} · Owner: {member.department || "operations"}
                    {member.lastContactStaff ? ` · Last contacted by ${member.lastContactStaff}` : ""}
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 shrink-0 text-slate-400" />
              </button>
            ))}
          </div>
        </section>
      )}

      {!searched && (
        <section className="grid gap-4 md:grid-cols-3">
          {[
            ["1", "Search", "Use a phone number or email to locate the right customer."],
            ["2", "Review journey", "See communication, transfers, and every department's latest update."],
            ["3", "Take action", "Log the conversation or transfer the issue with one clear form."],
          ].map(([number, title, text]) => (
            <div key={number} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-slate-950 text-sm font-bold text-amber-400">
                {number}
              </div>
              <h2 className="font-bold text-slate-950">{title}</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">{text}</p>
            </div>
          ))}
        </section>
      )}

      <RegisterMemberModal
        isOpen={registerOpen}
        onClose={() => setRegisterOpen(false)}
        programs={programs}
        userName={userName}
        department={department}
        onCreated={(memberId) => router.push(`/workspace/${memberId}`)}
      />
    </div>
  );
}
