import Link from "next/link";
import { ArrowRight, CheckCircle2, SendHorizontal } from "lucide-react";

interface PendingQuery {
  id: string;
  memberId: string;
  fromDepartment: string;
  toDepartment: string;
  reason: string;
  priority?: string | null;
  createdAt: Date | string;
  member: {
    fullName: string;
    memberCode: string;
  };
}

interface PendingQueryQueueProps {
  queries: PendingQuery[];
  title?: string;
}

export default function PendingQueryQueue({
  queries,
  title = "Unresolved Department Queries",
}: PendingQueryQueueProps) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-purple-200 bg-purple-50 p-2 text-purple-700">
            <SendHorizontal className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">{title}</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Review the original issue, open the member journey, and record the resolution medium and outcome.
            </p>
          </div>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700">
          {queries.length} open
        </span>
      </div>

      {queries.length === 0 ? (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          <CheckCircle2 className="h-4 w-4" />
          No unresolved department queries.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {queries.map((query) => (
            <article key={query.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-slate-900">{query.member.fullName}</p>
                  <p className="mt-0.5 font-mono text-[11px] font-semibold text-slate-500">
                    {query.member.memberCode}
                  </p>
                </div>
                <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800">
                  {query.priority || "medium"}
                </span>
              </div>

              <p className="mt-3 line-clamp-3 text-xs leading-5 text-slate-700">{query.reason}</p>

              <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-200 pt-3">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  {query.fromDepartment} → {query.toDepartment}
                </span>
                <Link
                  href={`/members/${query.memberId}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-slate-800"
                >
                  Open & Resolve
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
