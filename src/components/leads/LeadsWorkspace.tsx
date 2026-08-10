"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleHelp,
  Download,
  FileSpreadsheet,
  Filter,
  Inbox,
  Loader2,
  MessageCircle,
  Search,
  Settings2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  completeLeadImport,
  createLeadImportBatch,
  createLeadSource,
  importLeadRows,
  regenerateLeadSourceSecret,
  setLeadSourceActive,
  updateLeadStatus,
} from "@/app/actions/leadActions";
import {
  autoMapLeadColumns,
  LEAD_IMPORT_FIELDS,
  mapLeadImportRow,
  type LeadColumnMapping,
} from "@/lib/leadMapping";

type Source = {
  id: string;
  name: string;
  slug: string;
  sourceType: string;
  description: string | null;
  active: boolean;
  webhookEnabled: boolean;
  webhookSecretHint: string | null;
  defaultCampaign: string | null;
  defaultDepartment: string | null;
  createdAt: string;
  updatedAt: string;
};

type LeadRow = {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  responseCode: string;
  responseText: string | null;
  campaign: string | null;
  status: string;
  priority: string;
  receivedAt: string;
  source: { name: string; slug: string };
  member: { id: string; fullName: string; memberCode: string | null } | null;
};

type ImportBatch = {
  id: string;
  fileName: string;
  status: string;
  totalRows: number;
  imported: number;
  skipped: number;
  failed: number;
  createdAt: string;
  source: { name: string };
};

const STATUS_OPTIONS = ["new", "contacted", "qualified", "converted", "closed"];

function responseLabel(code: string, text: string | null) {
  if (code === "already_paid") return "Already paid";
  if (code === "will_pay_shortly") return "Will pay shortly";
  if (code === "has_question") return "Has a question";
  return text || "Other response";
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Users;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-black text-slate-950">{value}</p>
        </div>
        <div className="rounded-xl bg-amber-50 p-3 text-amber-600"><Icon className="h-5 w-5" /></div>
      </div>
    </div>
  );
}

function ModalFrame({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white px-6 py-5">
          <div><h2 className="text-xl font-black text-slate-950">{title}</h2><p className="mt-1 text-sm text-slate-500">{description}</p></div>
          <button onClick={onClose} className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function LeadImportModal({ sources, onClose }: { sources: Source[]; onClose: () => void }) {
  const router = useRouter();
  const manualSource = sources.find((source) => source.slug === "manual-excel");
  const [sourceId, setSourceId] = useState(manualSource?.id || sources.find((s) => s.active)?.id || "");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<unknown[][]>([]);
  const [mapping, setMapping] = useState<LeadColumnMapping>({});
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);

  async function readFile(file: File) {
    setReading(true);
    try {
      let parsed: unknown[][];
      if (file.name.toLowerCase().endsWith(".csv")) {
        const Papa = await import("papaparse");
        const result = Papa.default.parse<unknown[]>(await file.text(), {
          skipEmptyLines: "greedy",
        });
        if (result.errors.length && !result.data.length) throw new Error(result.errors[0]?.message);
        parsed = result.data;
      } else if (file.name.toLowerCase().endsWith(".xlsx")) {
        const { readSheet } = await import("read-excel-file/browser");
        parsed = (await readSheet(file)) as unknown[][];
      } else {
        throw new Error("Upload an .xlsx or .csv file.");
      }

      const candidates = parsed.slice(0, 12).map((row, index) => {
        const candidateHeaders = row.map((cell) => String(cell ?? "").trim());
        const candidateMapping = autoMapLeadColumns(candidateHeaders);
        const mapped = Object.values(candidateMapping).filter(Boolean).length;
        const populated = candidateHeaders.filter(Boolean).length;
        return { index, candidateHeaders, candidateMapping, score: mapped * 20 + populated };
      });
      const header = candidates.toSorted((a, b) => b.score - a.score)[0];
      if (!header || header.candidateHeaders.filter(Boolean).length < 1) {
        throw new Error("No header row was found in this file.");
      }
      setFileName(file.name);
      setHeaders(header.candidateHeaders);
      setMapping(header.candidateMapping);
      setRows(parsed.slice(header.index + 1).filter((row) => row.some((cell) => String(cell ?? "").trim())));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to read this file.");
    } finally {
      setReading(false);
    }
  }

  async function startImport() {
    if (!sourceId || !headers.length || !rows.length) return toast.error("Choose a source and file first.");
    const identityMapped = Object.values(mapping).some((field) =>
      ["fullName", "firstName", "lastName", "phone", "email"].includes(field),
    );
    if (!identityMapped) return toast.error("Map at least a name, phone, or email column.");

    setImporting(true);
    try {
      const batch = await createLeadImportBatch({
        sourceId,
        fileName,
        mapping: Object.fromEntries(Object.entries(mapping).map(([key, value]) => [key, value])),
      });
      if (!batch.success) throw new Error(batch.error);

      const normalized = rows.map((row) => mapLeadImportRow(headers, row, mapping));
      let imported = 0;
      let skipped = 0;
      let failed = 0;
      for (let offset = 0; offset < normalized.length; offset += 200) {
        const result = await importLeadRows({ batchId: batch.batchId, rows: normalized.slice(offset, offset + 200) });
        if (!result.success) throw new Error(result.error);
        imported += result.imported;
        skipped += result.skipped;
        failed += result.failed;
      }
      const completed = await completeLeadImport(batch.batchId, normalized.length);
      if (!completed.success) throw new Error(completed.error);
      toast.success(`Imported ${imported} leads. ${skipped} duplicates/empty and ${failed} failed.`);
      router.refresh();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Lead import failed.");
    } finally {
      setImporting(false);
    }
  }

  function downloadTemplate() {
    const template = [
      "Full Name,Phone,Email,Response,Campaign,Company,Location,Notes,Lead Date",
      'Example Lead,919810081379,lead@example.com,"I have a question",Saturday Campaign,Example Brand,Delhi,Requested a callback,2026-08-10',
    ].join("\n");
    const url = URL.createObjectURL(new Blob([template], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "prosync-lead-import-template.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <ModalFrame title="Import leads" description="Upload any CSV/XLSX layout, review the automatic mapping, then import." onClose={onClose}>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="font-bold text-slate-900">Choose an Excel or CSV file</p><p className="text-sm text-slate-500">The header row and likely columns are detected automatically.</p></div>
          <div className="flex gap-2">
            <button onClick={downloadTemplate} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold"><Download className="h-4 w-4" /> Template</button>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white">
              {reading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Browse
              <input className="hidden" type="file" accept=".xlsx,.csv" disabled={reading || importing} onChange={(event) => event.target.files?.[0] && void readFile(event.target.files[0])} />
            </label>
          </div>
        </div>

        {headers.length > 0 && (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-bold text-slate-700">Import source
                <select value={sourceId} onChange={(e) => setSourceId(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 font-medium">
                  {sources.filter((source) => source.active).map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}
                </select>
              </label>
              <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><strong>{rows.length}</strong> populated rows found in <strong>{fileName}</strong>.</div>
            </div>

            <div>
              <h3 className="font-black text-slate-900">Review column mapping</h3>
              <p className="mt-1 text-sm text-slate-500">Change any guess before importing. Unneeded columns can be ignored.</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {headers.map((header, index) => (
                  <div key={`${header}-${index}`} className="grid grid-cols-2 items-center gap-3 rounded-xl border border-slate-200 p-3">
                    <div className="min-w-0"><p className="truncate text-xs font-bold uppercase text-slate-500">File column</p><p className="truncate font-semibold text-slate-900">{header || `Column ${index + 1}`}</p></div>
                    <select value={mapping[index] || ""} onChange={(event) => setMapping((current) => ({ ...current, [index]: event.target.value as LeadColumnMapping[number] }))} className="rounded-lg border border-slate-200 px-2 py-2 text-sm">
                      <option value="">Ignore</option>
                      {LEAD_IMPORT_FIELDS.map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{headers.slice(0, 7).map((header, index) => <th key={index} className="px-3 py-3">{header || `Column ${index + 1}`}</th>)}</tr></thead><tbody>{rows.slice(0, 3).map((row, rowIndex) => <tr key={rowIndex} className="border-t border-slate-100">{headers.slice(0, 7).map((_, index) => <td key={index} className="max-w-52 truncate px-3 py-3">{String(row[index] ?? "")}</td>)}</tr>)}</tbody></table>
            </div>

            <div className="flex justify-end gap-3"><button onClick={onClose} className="rounded-xl border border-slate-200 px-5 py-3 font-bold">Cancel</button><button onClick={() => void startImport()} disabled={importing} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 font-bold text-white disabled:opacity-50">{importing && <Loader2 className="h-4 w-4 animate-spin" />} Import {rows.length} leads</button></div>
          </>
        )}
      </div>
    </ModalFrame>
  );
}

function LeadSourcesModal({ sources, onClose }: { sources: Source[]; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [campaign, setCampaign] = useState("");
  const [revealed, setRevealed] = useState<{ slug: string; secret: string } | null>(null);
  const origin = typeof window === "undefined" ? "https://crm.prosyncedu.com" : window.location.origin;

  function create() {
    startTransition(async () => {
      const result = await createLeadSource({ name, defaultCampaign: campaign, sourceType: "api" });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setRevealed({ slug: result.source.slug, secret: result.webhookSecret });
      setName(""); setCampaign(""); router.refresh(); toast.success("Lead source created.");
    });
  }

  function rotate(sourceId: string) {
    startTransition(async () => {
      const result = await regenerateLeadSourceSecret(sourceId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setRevealed({ slug: result.source.slug, secret: result.webhookSecret });
      router.refresh(); toast.success("Webhook secret rotated.");
    });
  }

  return (
    <ModalFrame title="Lead source integrations" description="Create secured intake URLs for forms, ad platforms, automation tools, or other software." onClose={onClose}>
      <div className="space-y-6">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><h3 className="font-black text-emerald-950">WATI Leads</h3><p className="mt-1 text-sm text-emerald-800">Endpoint: <code className="break-all">{origin}/api/webhooks/leads/wati</code></p><p className="mt-2 text-xs text-emerald-700">Send the server&apos;s WATI_WEBHOOK_SECRET in the x-wati-secret header. Only the three configured payment replies become leads.</p></div>

        <div className="grid gap-3 rounded-2xl border border-slate-200 p-5 md:grid-cols-[1fr_1fr_auto]"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Source name, e.g. Meta Leads" className="rounded-xl border border-slate-200 px-3 py-3" /><input value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="Default campaign (optional)" className="rounded-xl border border-slate-200 px-3 py-3" /><button onClick={create} disabled={pending || !name.trim()} className="rounded-xl bg-slate-950 px-5 py-3 font-bold text-white disabled:opacity-50">Create source</button></div>

        {revealed && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950"><p className="font-black">Copy this secret now—it is shown only once.</p><p className="mt-2 break-all"><strong>URL:</strong> {origin}/api/webhooks/leads/{revealed.slug}</p><p className="mt-2 break-all"><strong>x-prosync-secret:</strong> {revealed.secret}</p></div>}

        <div className="space-y-3">{sources.map((source) => <div key={source.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><p className="font-black text-slate-900">{source.name}</p><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${source.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{source.active ? "Active" : "Disabled"}</span></div><p className="mt-1 text-xs text-slate-500">{source.sourceType.toUpperCase()} · /{source.slug}{source.webhookSecretHint ? ` · secret …${source.webhookSecretHint}` : ""}</p></div><div className="flex gap-2">{source.sourceType !== "manual" && source.slug !== "wati" && <button onClick={() => rotate(source.id)} disabled={pending} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold">Rotate secret</button>}<button onClick={() => startTransition(async () => { const result = await setLeadSourceActive(source.id, !source.active); if (!result.success) toast.error(result.error); else { router.refresh(); toast.success(source.active ? "Source disabled." : "Source enabled."); } })} disabled={pending} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold">{source.active ? "Disable" : "Enable"}</button></div></div>)}</div>
      </div>
    </ModalFrame>
  );
}

export default function LeadsWorkspace({
  leads,
  sources,
  imports,
  stats,
  filters,
  pagination,
  isAdmin,
}: {
  leads: LeadRow[];
  sources: Source[];
  imports: ImportBatch[];
  stats: { totalLeads: number; newLeads: number; questionLeads: number; watiLeads: number };
  filters: { query: string; source: string; status: string };
  pagination: { page: number; pageSize: number; total: number };
  isAdmin: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(filters.query);
  const [showImport, setShowImport] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [pending, startTransition] = useTransition();
  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.pageSize));

  function setFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value); else params.delete(key);
    params.delete("page");
    router.push(`/leads?${params.toString()}`);
  }

  function pageHref(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page));
    return `/leads?${params.toString()}`;
  }

  const activeSources = useMemo(() => sources.filter((source) => source.active), [sources]);

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end"><div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-700"><Inbox className="h-4 w-4" /> Lead intake & response center</div><h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">Leads</h1><p className="mt-1 text-sm text-slate-500">WATI replies, integrations, and flexible spreadsheet imports in one simple queue.</p></div><div className="flex flex-wrap gap-2">{isAdmin && <button onClick={() => setShowSources(true)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold"><Settings2 className="h-4 w-4" /> Configure sources</button>}<button onClick={() => setShowImport(true)} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white"><FileSpreadsheet className="h-4 w-4 text-amber-400" /> Import Excel / CSV</button></div></div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="All leads" value={stats.totalLeads} icon={Users} /><MetricCard label="New queue" value={stats.newLeads} icon={Inbox} /><MetricCard label="WATI leads" value={stats.watiLeads} icon={MessageCircle} /><MetricCard label="Questions waiting" value={stats.questionLeads} icon={CircleHelp} /></div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs"><form onSubmit={(event) => { event.preventDefault(); setFilter("q", query.trim()); }} className="grid gap-3 lg:grid-cols-[1fr_220px_200px_auto]"><label className="relative"><Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, phone, email, or campaign…" className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-3" /></label><select value={filters.source} onChange={(e) => setFilter("source", e.target.value)} className="rounded-xl border border-slate-200 px-3 py-3"><option value="">All lead sources</option>{sources.map((source) => <option key={source.id} value={source.slug}>{source.name}</option>)}</select><select value={filters.status} onChange={(e) => setFilter("status", e.target.value)} className="rounded-xl border border-slate-200 px-3 py-3"><option value="">All statuses</option>{STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status[0].toUpperCase() + status.slice(1)}</option>)}</select><button className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-100 px-5 py-3 font-bold text-slate-800"><Filter className="h-4 w-4" /> Apply</button></form></div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xs"><div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h2 className="font-black text-slate-950">Lead queue</h2><p className="text-xs text-slate-500">Showing {leads.length} of {pagination.total} filtered leads</p></div>{pending && <Loader2 className="h-4 w-4 animate-spin text-slate-500" />}</div><div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Lead</th><th className="px-4 py-3">Source</th><th className="px-4 py-3">Response</th><th className="px-4 py-3">Campaign</th><th className="px-4 py-3">Received</th><th className="px-4 py-3">CRM status</th><th className="px-4 py-3">Member</th></tr></thead><tbody>{leads.map((lead) => <tr key={lead.id} className="border-t border-slate-100 align-top hover:bg-slate-50/70"><td className="px-5 py-4"><p className="font-bold text-slate-950">{lead.fullName}</p><p className="mt-1 text-xs text-slate-500">{lead.phone || lead.email || "No contact information"}</p>{lead.phone && lead.email && <p className="text-xs text-slate-400">{lead.email}</p>}</td><td className="px-4 py-4"><span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">{lead.source.name}</span></td><td className="px-4 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${lead.responseCode === "has_question" ? "bg-rose-50 text-rose-700" : lead.responseCode === "already_paid" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{responseLabel(lead.responseCode, lead.responseText)}</span></td><td className="max-w-48 px-4 py-4 text-sm text-slate-600">{lead.campaign || "—"}</td><td className="whitespace-nowrap px-4 py-4 text-xs text-slate-500">{dateLabel(lead.receivedAt)}</td><td className="px-4 py-4"><select value={lead.status} disabled={pending} onChange={(e) => { const next = e.target.value; startTransition(async () => { const result = await updateLeadStatus(lead.id, next); if (!result.success) toast.error(result.error); else { toast.success("Lead status updated."); router.refresh(); } }); }} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-bold">{STATUS_OPTIONS.map((status) => <option key={status}>{status}</option>)}</select></td><td className="px-4 py-4">{lead.member ? <Link href={`/members/${lead.member.id}`} className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 hover:underline"><CheckCircle2 className="h-3.5 w-3.5" /> {lead.member.memberCode || lead.member.fullName}</Link> : <span className="text-xs text-slate-400">Not matched</span>}</td></tr>)}{!leads.length && <tr><td colSpan={7} className="px-6 py-16 text-center"><Inbox className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 font-bold text-slate-700">No leads match these filters</p><p className="text-sm text-slate-500">Import a file or wait for an integration response.</p></td></tr>}</tbody></table></div><div className="flex items-center justify-between border-t border-slate-200 px-5 py-4"><span className="text-xs text-slate-500">Page {pagination.page} of {totalPages}</span><div className="flex gap-2"><Link aria-disabled={pagination.page <= 1} href={pagination.page > 1 ? pageHref(pagination.page - 1) : "#"} className={`inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-bold ${pagination.page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-slate-50"}`}><ArrowLeft className="h-3.5 w-3.5" /> Previous</Link><Link aria-disabled={pagination.page >= totalPages} href={pagination.page < totalPages ? pageHref(pagination.page + 1) : "#"} className={`inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-bold ${pagination.page >= totalPages ? "pointer-events-none opacity-40" : "hover:bg-slate-50"}`}>Next <ArrowRight className="h-3.5 w-3.5" /></Link></div></div></div>

      {imports.length > 0 && <div className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-black text-slate-950">Recent imports</h2><div className="mt-3 grid gap-3 lg:grid-cols-2">{imports.map((batch) => <div key={batch.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4"><div className="flex items-center justify-between"><p className="truncate font-bold text-slate-900">{batch.fileName}</p><span className="text-xs font-bold text-emerald-700">{batch.status}</span></div><p className="mt-1 text-xs text-slate-500">{batch.source.name} · {batch.imported} imported · {batch.skipped} skipped · {batch.failed} failed</p></div>)}</div></div>}

      {showImport && <LeadImportModal sources={activeSources} onClose={() => setShowImport(false)} />}
      {showSources && isAdmin && <LeadSourcesModal sources={sources} onClose={() => setShowSources(false)} />}
    </div>
  );
}
