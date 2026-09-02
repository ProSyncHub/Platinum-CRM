import { getQueryDesk } from "@/app/actions/queryActions";
import QueryDeskClient from "@/components/queries/QueryDeskClient";

export const dynamic = "force-dynamic";

export default async function QueriesPage() {
  const response = await getQueryDesk();
  if (!response.success || !response.viewer) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm font-semibold text-red-700">{response.error || "Unable to load the query desk."}</div>;
  }
  return <QueryDeskClient tickets={response.tickets} viewer={response.viewer} counts={response.counts} />;
}
