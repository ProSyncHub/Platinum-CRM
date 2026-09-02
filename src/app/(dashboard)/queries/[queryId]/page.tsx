import Link from "next/link";
import { ArrowLeft, CircleAlert } from "lucide-react";
import { getQueryTicket } from "@/app/actions/queryActions";
import { QueryTicketCard } from "@/components/queries/QueryDeskClient";

export const dynamic = "force-dynamic";

export default async function QueryDetailPage({ params }: { params: Promise<{ queryId: string }> }) {
  const { queryId } = await params;
  const response = await getQueryTicket(queryId);
  if (!response.success || !response.ticket || !response.viewer) {
    return <div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-red-50 p-6 text-sm font-semibold text-red-700">{response.error || "Query not found."}</div>;
  }
  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-12">
      <Link href="/queries" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950"><ArrowLeft className="h-4 w-4" /> Back to Query Desk</Link>
      <section className="rounded-3xl border border-violet-200 bg-violet-50 p-6 sm:p-8">
        <div className="flex items-center gap-3"><CircleAlert className="h-6 w-6 text-violet-700" /><div><p className="text-xs font-bold uppercase tracking-wide text-violet-700">Transferred customer issue</p><h1 className="mt-1 text-2xl font-bold text-slate-950">Resolve with evidence, not assumption.</h1></div></div>
        <p className="mt-3 text-sm leading-6 text-slate-600">Review the original conversation below. Close the query only after the issue is actually handled and the resolution has been documented.</p>
      </section>
      <QueryTicketCard ticket={response.ticket} viewer={response.viewer} />
    </div>
  );
}
