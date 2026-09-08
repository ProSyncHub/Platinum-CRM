"use client";

import { useMemo, useState } from "react";
import { X, UserPlus, Calendar, Phone, Mail, MapPin, Upload, ClipboardPaste, FileSpreadsheet } from "lucide-react";
import { createMember, createMembersBulk } from "@/app/actions/memberActions";
import { toast } from "sonner";

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  executives?: string[];
  programs?: any[];
}

type MemberFormData = {
  programType: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  state: string;
  enrollingDate: string;
  endDate: string;
  plan: string;
  activeStatus: "Active" | "Not Active" | "On Hold";
  allotedTo: string;
  oneOnOneSessionAllowance: number;
  businessType: string;
  brandCollaborations: string;
  plBrand: string;
  resellingBrand: string;
  salesData: string;
  budgetAvailable: string;
  currentStage: "onboarding" | "research" | "sourcing" | "approval" | "growth";
  notes: string;
};

type BulkPreviewRow = MemberFormData & {
  sourceRow: number;
  warnings: string[];
};

const FIELD_ALIASES: Record<keyof MemberFormData | "fullName", string[]> = {
  fullName: ["name", "full name", "member name", "customer name", "student name", "client name"],
  firstName: ["first name", "firstname", "fname", "first"],
  lastName: ["last name", "lastname", "lname", "surname", "last"],
  email: ["email", "email address", "mail", "e-mail"],
  phone: ["phone", "phone number", "mobile", "mobile number", "whatsapp", "whatsapp number", "contact", "contact number", "contact no", "contact no."],
  programType: ["program", "program type", "membership", "course", "package", "plan type", "tier"],
  state: ["state", "location", "city", "address", "region"],
  enrollingDate: ["enrollment date", "enrolling date", "joining date", "join date", "start date", "registered at", "date"],
  endDate: ["end date", "expiry date", "expiration date", "valid till", "validity end"],
  plan: ["plan", "duration", "membership plan", "validity", "plan(yearly/6mon)", "plan yearly 6mon"],
  activeStatus: ["active status", "status", "active / not active", "active/not active", "active not active"],
  allotedTo: ["assigned executive", "assigned to", "alloted to", "allotted to", "owner", "executive", "counsellor"],
  oneOnOneSessionAllowance: ["1 on 1 sessions", "one on one sessions", "sessions", "session allowance", "1:1 allowance", "one-on-one allowance"],
  businessType: ["business type", "business", "model", "seller type"],
  brandCollaborations: ["brand", "brands", "brand collaborations", "pl brand", "private label", "reselling brand"],
  plBrand: ["pl brand name", "private label brand", "own brand"],
  resellingBrand: ["reselling brand", "reseller brand"],
  salesData: ["sales", "sales data", "revenue", "current sales", "target", "gmv"],
  budgetAvailable: ["budget", "budget available", "investment", "capital"],
  currentStage: ["stage", "current stage", "journey stage", "milestone"],
  notes: ["notes", "note", "remarks", "comment", "comments", "brief", "initial notes"],
};

function normalizeHeader(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function normalizeCell(value: unknown) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().split("T")[0];
  return String(value).trim();
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] || "", lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function normalizeDateInput(value: string) {
  if (!value) return "";
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const slashDate = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (slashDate) {
    const day = slashDate[1].padStart(2, "0");
    const month = slashDate[2].padStart(2, "0");
    const year = slashDate[3].length === 2 ? `20${slashDate[3]}` : slashDate[3];
    return `${year}-${month}-${day}`;
  }
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().split("T")[0];
  return "";
}

function calculateEndDate(enrollingDate: string, plan: string) {
  const start = enrollingDate ? new Date(enrollingDate) : new Date();
  if (Number.isNaN(start.getTime())) return "";
  if (plan.toLowerCase().includes("year")) start.setFullYear(start.getFullYear() + 1);
  else if (plan.toLowerCase().includes("life")) start.setFullYear(start.getFullYear() + 25);
  else start.setMonth(start.getMonth() + 6);
  return start.toISOString().split("T")[0];
}

function normalizeStage(value: string): MemberFormData["currentStage"] {
  const stage = value.toLowerCase();
  if (stage.includes("research")) return "research";
  if (stage.includes("sourcing") || stage.includes("brand")) return "sourcing";
  if (stage.includes("approval") || stage.includes("sample")) return "approval";
  if (stage.includes("growth") || stage.includes("live")) return "growth";
  return "onboarding";
}

function normalizeProgram(value: string, programs: any[], fallback: string) {
  if (!value) return fallback;
  const normalized = value.toLowerCase();
  const exact = programs.find((program) => program.name?.toLowerCase() === normalized);
  if (exact) return exact.name;
  const fuzzy = programs.find((program) => {
    const name = program.name?.toLowerCase() || "";
    return name.includes(normalized) || normalized.includes(name) || normalized.includes(program.codePrefix?.toLowerCase?.() || "__none__");
  });
  if (fuzzy) return fuzzy.name;
  if (normalized.includes("pnp") || normalized.includes("plug")) return "PNP";
  if (normalized.includes("plat")) return "Platinum";
  if (normalized.includes("amazon") || normalized.includes("wealth") || normalized.includes("aws")) return "Amazon Wealth Shortcut";
  return value;
}

function normalizeActiveStatus(value: string): MemberFormData["activeStatus"] {
  const status = value.trim().toLowerCase();
  if (status.includes("hold")) return "On Hold";
  if (status.includes("not") || status.includes("inactive") || status.includes("expired")) return "Not Active";
  return "Active";
}

function normalizeSessionAllowance(value: string, fallback: number) {
  const parsed = Number(String(value || "").match(/\d+/)?.[0] || fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(50, Math.round(parsed)));
}

function makeDefaultMember(programs: any[], executives: string[]): MemberFormData {
  const enrollingDate = new Date().toISOString().split("T")[0];
  return {
    programType: programs[0]?.name || "Platinum",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    state: "",
    enrollingDate,
    endDate: calculateEndDate(enrollingDate, "6 Months"),
    plan: "6 Months",
    activeStatus: "Active",
    allotedTo: executives[0] || "Samyak",
    oneOnOneSessionAllowance: 6,
    businessType: "Reseller",
    brandCollaborations: "",
    plBrand: "",
    resellingBrand: "",
    salesData: "",
    budgetAvailable: "50k-1L",
    currentStage: "onboarding",
    notes: "",
  };
}

function mapColumnIndexes(headers: unknown[]) {
  const normalized = headers.map(normalizeHeader);
  const indexes: Partial<Record<keyof MemberFormData | "fullName", number>> = {};
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    const index = normalized.findIndex((header) =>
      aliases.some((alias) => header === alias || header.includes(alias)),
    );
    if (index >= 0) indexes[field as keyof MemberFormData | "fullName"] = index;
  }
  return indexes;
}

function rowsToMembers(
  rawRows: unknown[][],
  programs: any[],
  executives: string[],
  defaults?: {
    programType?: string;
    activeStatus?: MemberFormData["activeStatus"];
    oneOnOneSessionAllowance?: number;
  },
): BulkPreviewRow[] {
  const rows = rawRows.filter((row) => row.some((cell) => normalizeCell(cell)));
  if (rows.length === 0) return [];
  const headerIndexes = mapColumnIndexes(rows[0]);
  const headerHitCount = Object.keys(headerIndexes).length;
  const hasHeader = headerHitCount >= 2;
  const indexes = hasHeader
    ? headerIndexes
    : {
        fullName: 0,
        phone: 1,
        email: 2,
        programType: 3,
        state: 4,
        notes: 5,
      };
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const defaultMember = makeDefaultMember(programs, executives);
  const fallback = {
    ...defaultMember,
    programType: defaults?.programType || defaultMember.programType,
    activeStatus: defaults?.activeStatus || defaultMember.activeStatus,
    oneOnOneSessionAllowance:
      defaults?.oneOnOneSessionAllowance ?? defaultMember.oneOnOneSessionAllowance,
  };

  return dataRows.map((row, index) => {
    const get = (field: keyof MemberFormData | "fullName") => {
      const column = indexes[field];
      return typeof column === "number" ? normalizeCell(row[column]) : "";
    };
    const nameParts = splitName(get("fullName"));
    const member: BulkPreviewRow = {
      ...fallback,
      firstName: get("firstName") || nameParts.firstName,
      lastName: get("lastName") || nameParts.lastName,
      email: get("email"),
      phone: get("phone").replace(/[^\d+]/g, ""),
      programType: normalizeProgram(get("programType"), programs, fallback.programType),
      state: get("state"),
      enrollingDate: normalizeDateInput(get("enrollingDate")) || fallback.enrollingDate,
      endDate: normalizeDateInput(get("endDate")) || fallback.endDate,
      plan: get("plan") || fallback.plan,
      activeStatus: get("activeStatus") ? normalizeActiveStatus(get("activeStatus")) : fallback.activeStatus,
      allotedTo: get("allotedTo") || fallback.allotedTo,
      oneOnOneSessionAllowance: normalizeSessionAllowance(
        get("oneOnOneSessionAllowance"),
        fallback.oneOnOneSessionAllowance,
      ),
      businessType: get("businessType") || fallback.businessType,
      brandCollaborations: get("brandCollaborations"),
      plBrand: get("plBrand"),
      resellingBrand: get("resellingBrand"),
      salesData: get("salesData"),
      budgetAvailable: get("budgetAvailable") || fallback.budgetAvailable,
      currentStage: normalizeStage(get("currentStage")),
      notes: get("notes"),
      sourceRow: index + (hasHeader ? 2 : 1),
      warnings: [],
    };
    if (!member.firstName) member.warnings.push("Missing name");
    if (!member.phone) member.warnings.push("Missing phone");
    return member;
  });
}

function parsePastedTable(text: string) {
  return text
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split(line.includes("\t") ? "\t" : ",").map((cell) => cell.trim()));
}

export default function AddMemberModal({
  isOpen,
  onClose,
  onSuccess,
  executives = [
    "Samyak",
    "Mayank",
    "Jaanvi",
    "Muskaan",
    "Jaspreet",
    "Sumit",
    "Dhruv",
    "Abdul Barr",
    "Dev Rathore",
    "Aditya Bairagi",
    "Savneet Singh",
    "Ritika Behl",
    "Harshita Prajapati",
    "Nishkarsh Gupta",
    "Janvi Arora",
    "Arshdeep Kaur",
    "Tushar Panchal",
    "Hemant Bhandari",
  ],
  programs = [
    { name: "Platinum", codePrefix: "PLT", icon: "👑", badgeColor: "amber" },
    { name: "PNP", codePrefix: "PNP", icon: "⚡", badgeColor: "cyan" },
    { name: "Amazon Wealth Shortcut", codePrefix: "AWS", icon: "🚀", badgeColor: "purple" },
  ],
}: AddMemberModalProps) {
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [formData, setFormData] = useState<MemberFormData>(() => makeDefaultMember(programs, executives));
  const [bulkProgramType, setBulkProgramType] = useState(programs[0]?.name || "Platinum");
  const [bulkSessionAllowance, setBulkSessionAllowance] = useState(6);
  const [bulkActiveStatus, setBulkActiveStatus] = useState<MemberFormData["activeStatus"]>("Active");
  const [bulkText, setBulkText] = useState("");
  const [bulkRows, setBulkRows] = useState<BulkPreviewRow[]>([]);
  const [bulkResult, setBulkResult] = useState<Awaited<ReturnType<typeof createMembersBulk>> | null>(null);
  const validBulkRows = useMemo(
    () => bulkRows.filter((row) => row.firstName.trim() && row.phone.trim()),
    [bulkRows],
  );

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.firstName.trim() || !formData.phone.trim()) {
      toast.error("Please fill in required fields (First Name & Phone).");
      return;
    }

    setLoading(true);
    try {
      const res = await createMember(formData);
      if (res.success) {
        toast.success(`${formData.programType} Member enrolled successfully!`);
        onSuccess();
        onClose();
      } else {
        toast.error(res.error || "Failed to add member");
      }
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handlePastePreview = () => {
    if (!bulkText.trim()) {
      toast.error("Paste rows from Excel first.");
      return;
    }
    const rows = rowsToMembers(parsePastedTable(bulkText), programs, executives, {
      programType: bulkProgramType,
      activeStatus: bulkActiveStatus,
      oneOnOneSessionAllowance: bulkSessionAllowance,
    });
    setBulkRows(rows);
    setBulkResult(null);
    toast.success(`${rows.length} row${rows.length === 1 ? "" : "s"} mapped from pasted data.`);
  };

  const handleFileImport = async (file?: File | null) => {
    if (!file) return;
    setLoading(true);
    try {
      let parsedRows: unknown[][];
      const lowerName = file.name.toLowerCase();
      if (lowerName.endsWith(".csv") || lowerName.endsWith(".tsv")) {
        const Papa = await import("papaparse");
        const result = Papa.default.parse<unknown[]>(await file.text(), {
          skipEmptyLines: "greedy",
          delimiter: lowerName.endsWith(".tsv") ? "\t" : undefined,
        });
        parsedRows = result.data;
      } else if (lowerName.endsWith(".xlsx")) {
        const { readSheet } = await import("read-excel-file/browser");
        parsedRows = (await readSheet(file)) as unknown[][];
      } else {
        toast.error("Upload an .xlsx, .csv, or .tsv file.");
        return;
      }
      const rows = rowsToMembers(parsedRows, programs, executives, {
        programType: bulkProgramType,
        activeStatus: bulkActiveStatus,
        oneOnOneSessionAllowance: bulkSessionAllowance,
      });
      setBulkRows(rows);
      setBulkResult(null);
      toast.success(`${rows.length} row${rows.length === 1 ? "" : "s"} mapped from ${file.name}.`);
    } catch (err: any) {
      toast.error(err.message || "Could not read this file.");
    } finally {
      setLoading(false);
    }
  };

  const handleBulkCreate = async () => {
    if (validBulkRows.length === 0) {
      toast.error("No valid rows found. Each member needs at least name and phone.");
      return;
    }
    setLoading(true);
    try {
      const result = await createMembersBulk(validBulkRows);
      setBulkResult(result);
      if (result.success) {
        toast.success(`Created ${result.created}. Skipped ${result.skipped}. Failed ${result.failed}.`);
        if (result.created > 0) setTimeout(onSuccess, 900);
      } else {
        toast.error(result.error || "Bulk import failed.");
      }
    } catch (err: any) {
      toast.error(err.message || "Bulk import failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 text-slate-900">
        <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-700 border border-amber-200">
              <UserPlus className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Enroll New Member</h2>
              <p className="text-xs text-slate-500">
                Enroll into Platinum, PNP, Amazon Wealth Shortcut, or custom cohort with automated code generation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1 text-xs font-bold">
          <button
            type="button"
            onClick={() => setMode("single")}
            className={`rounded-xl px-3 py-2 transition-all ${mode === "single" ? "bg-white text-slate-950 shadow-xs" : "text-slate-500 hover:text-slate-800"}`}
          >
            Single member
          </button>
          <button
            type="button"
            onClick={() => setMode("bulk")}
            className={`rounded-xl px-3 py-2 transition-all ${mode === "bulk" ? "bg-white text-slate-950 shadow-xs" : "text-slate-500 hover:text-slate-800"}`}
          >
            Bulk Excel / paste
          </button>
        </div>

        {mode === "bulk" ? (
          <div className="space-y-5">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-950">
              <p className="font-bold">Flexible import format</p>
              <p className="mt-1">
                Upload Excel/CSV or paste rows copied from Excel. Headers can be flexible: Full Name, Name,
                First Name, Last Name, Contact no., Email, State, Enrolling Date, End Date,
                Plan, Active / Not Active, Alloted to, Assigned To, Stage, Sales, Budget, Notes.
              </p>
              <p className="mt-1 font-semibold">Required per row: name and phone. Existing phone/email contacts will be skipped.</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-black text-slate-950">Bulk import defaults</p>
              <p className="mt-1 text-xs text-slate-500">
                These apply when the Excel/pasted rows do not have that column. Row values still win if present.
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-600">
                  Program
                  <select
                    value={bulkProgramType}
                    onChange={(event) => setBulkProgramType(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold normal-case tracking-normal text-slate-950 outline-none focus:border-amber-500"
                  >
                    {programs.map((program) => (
                      <option key={program.name} value={program.name}>
                        {program.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-600">
                  1-on-1 sessions
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={bulkSessionAllowance}
                    onChange={(event) => setBulkSessionAllowance(Number(event.target.value))}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold normal-case tracking-normal text-slate-950 outline-none focus:border-amber-500"
                  />
                </label>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-600">
                  Active status
                  <select
                    value={bulkActiveStatus}
                    onChange={(event) => setBulkActiveStatus(event.target.value as MemberFormData["activeStatus"])}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold normal-case tracking-normal text-slate-950 outline-none focus:border-amber-500"
                  >
                    <option value="Active">Active</option>
                    <option value="Not Active">Not Active</option>
                    <option value="On Hold">On Hold</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-5 text-center hover:border-amber-400 hover:bg-amber-50">
                <Upload className="h-7 w-7 text-amber-600" />
                <span className="mt-2 text-sm font-bold text-slate-900">Upload .xlsx / .csv</span>
                <span className="mt-1 text-xs text-slate-500">CRM will auto-map the columns</span>
                <input
                  type="file"
                  accept=".xlsx,.csv,.tsv"
                  className="hidden"
                  onChange={(event) => handleFileImport(event.target.files?.[0])}
                />
              </label>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-900">
                  <ClipboardPaste className="h-4 w-4 text-amber-600" />
                  Paste from Excel
                </div>
                <textarea
                  rows={5}
                  value={bulkText}
                  onChange={(event) => setBulkText(event.target.value)}
                  placeholder={"Full Name\tPhone\tEmail\tProgram\tState\tNotes\nRahul Sharma\t9876543210\trahul@email.com\tPlatinum\tDelhi\tInitial note"}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:bg-white focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handlePastePreview}
                  disabled={loading}
                  className="mt-3 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-amber-400" />
                  Map pasted rows
                </button>
              </div>
            </div>

            {bulkRows.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
                  <div>
                    <p className="text-sm font-bold text-slate-950">Import preview</p>
                    <p className="text-xs text-slate-500">
                      {validBulkRows.length} valid of {bulkRows.length} mapped rows
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleBulkCreate}
                    disabled={loading || validBulkRows.length === 0}
                    className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {loading ? "Importing..." : `Create ${validBulkRows.length} members`}
                  </button>
                </div>
                <div className="max-h-72 overflow-auto">
                  <table className="w-full min-w-[720px] text-left text-xs">
                    <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Row</th>
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">Phone</th>
                        <th className="px-3 py-2">Email</th>
                        <th className="px-3 py-2">Program</th>
                        <th className="px-3 py-2">Sessions</th>
                        <th className="px-3 py-2">Assigned</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {bulkRows.slice(0, 50).map((row) => (
                        <tr key={row.sourceRow} className={row.warnings.length ? "bg-rose-50/60" : "bg-white"}>
                          <td className="px-3 py-2 font-mono text-slate-500">{row.sourceRow}</td>
                          <td className="px-3 py-2 font-bold text-slate-900">{`${row.firstName} ${row.lastName}`.trim() || "—"}</td>
                          <td className="px-3 py-2">{row.phone || "—"}</td>
                          <td className="px-3 py-2">{row.email || "—"}</td>
                          <td className="px-3 py-2">{row.programType}</td>
                          <td className="px-3 py-2">{row.oneOnOneSessionAllowance}</td>
                          <td className="px-3 py-2">{row.allotedTo}</td>
                          <td className="px-3 py-2">
                            {row.warnings.length ? (
                              <span className="font-bold text-rose-700">{row.warnings.join(", ")}</span>
                            ) : (
                              <span className="font-bold text-emerald-700">Ready</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {bulkRows.length > 50 && (
                    <p className="border-t border-slate-100 p-3 text-xs text-slate-500">
                      Showing first 50 rows only. All {validBulkRows.length} valid rows will be imported.
                    </p>
                  )}
                </div>
              </div>
            )}

            {bulkResult?.success && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
                <p className="font-bold">
                  Import complete: {bulkResult.created} created, {bulkResult.skipped} skipped, {bulkResult.failed} failed.
                </p>
                {bulkResult.results?.some((result) => !result.success) && (
                  <details className="mt-2 text-xs">
                    <summary className="cursor-pointer font-bold">View skipped/failed rows</summary>
                    <ul className="mt-2 list-disc space-y-1 pl-4">
                      {bulkResult.results
                        .filter((result) => !result.success)
                        .slice(0, 20)
                        .map((result) => (
                          <li key={result.index}>
                            Row {result.index + 1}: {result.name || result.phone || "Unnamed"} — {result.error}
                          </li>
                        ))}
                    </ul>
                  </details>
                )}
              </div>
            )}

            <div className="flex justify-end border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200 hover:text-slate-900"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Program Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Select Membership Program *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {programs.map((p) => {
                const isSelected = formData.programType.toLowerCase() === p.name.toLowerCase();
                return (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => setFormData({ ...formData, programType: p.name })}
                    className={`p-3 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                      isSelected
                        ? "bg-amber-50 border-amber-400 ring-2 ring-amber-400/40 text-amber-900 shadow-xs"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    <span className="text-2xl shrink-0">{p.icon || "🎯"}</span>
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-slate-900 truncate">{p.name}</div>
                      <div className="text-[10px] text-slate-500 font-medium">
                        Prefix: {p.codePrefix}-2026-XXX
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                First Name *
              </label>
              <input
                type="text"
                required
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                placeholder="e.g. Rahul"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Last Name
              </label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                placeholder="e.g. Sharma"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Phone Number *
              </label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="rahul@example.com"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white text-sm"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                State / Location
              </label>
              <div className="relative">
                <MapPin className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  placeholder="e.g. Maharashtra"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Enrollment Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="date"
                  value={formData.enrollingDate}
                  onChange={(e) => {
                    const enrollingDate = e.target.value;
                    setFormData({
                      ...formData,
                      enrollingDate,
                      endDate: calculateEndDate(enrollingDate, formData.plan),
                    });
                  }}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white text-sm font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Membership Plan
              </label>
              <select
                value={formData.plan}
                onChange={(e) => {
                  const plan = e.target.value;
                  setFormData({
                    ...formData,
                    plan,
                    endDate: calculateEndDate(formData.enrollingDate, plan),
                  });
                }}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white text-sm font-medium"
              >
                <option value="6 Months">6 Months Plan (180 Days)</option>
                <option value="Yearly">Yearly Plan (365 Days)</option>
                <option value="Lifetime">Lifetime Access</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                End Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white text-sm font-medium"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                1-on-1 Sessions Included
              </label>
              <input
                type="number"
                min={0}
                max={50}
                value={formData.oneOnOneSessionAllowance}
                onChange={(e) => setFormData({ ...formData, oneOnOneSessionAllowance: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white text-sm font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Active Status
              </label>
              <select
                value={formData.activeStatus}
                onChange={(e) => setFormData({ ...formData, activeStatus: e.target.value as MemberFormData["activeStatus"] })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white text-sm font-medium"
              >
                <option value="Active">Active</option>
                <option value="Not Active">Not Active</option>
                <option value="On Hold">On Hold</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Assigned Executive
              </label>
              <select
                value={formData.allotedTo}
                onChange={(e) => setFormData({ ...formData, allotedTo: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white text-sm font-medium"
              >
                {executives.map((ex) => (
                  <option key={ex} value={ex}>
                    {ex}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Business Type
              </label>
              <select
                value={formData.businessType}
                onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white text-sm font-medium"
              >
                <option value="Reseller">Reseller</option>
                <option value="PL">Private Label (PL)</option>
                <option value="Both">Both (PL + Reselling)</option>
                <option value="Brand Collaboration">Brand Collaboration</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Starting Stage
              </label>
              <select
                value={formData.currentStage}
                onChange={(e: any) => setFormData({ ...formData, currentStage: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white text-sm font-medium"
              >
                <option value="onboarding">Stage 1: Decision & Onboarding</option>
                <option value="research">Stage 2: Product Research</option>
                <option value="sourcing">Stage 3: Sourcing & Brand Approval</option>
                <option value="approval">Stage 4: Sample & Testing</option>
                <option value="growth">Stage 5: Live & Growth Scaling</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Brand Collaborations / PL Brand Name
              </label>
              <input
                type="text"
                value={formData.brandCollaborations}
                onChange={(e) => setFormData({ ...formData, brandCollaborations: e.target.value })}
                placeholder="e.g. Havells, Portronics, Own Brand"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Current Sales / Target
              </label>
              <input
                type="text"
                value={formData.salesData}
                onChange={(e) => setFormData({ ...formData, salesData: e.target.value })}
                placeholder="e.g. 50k, 1.5L, 30L"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Initial Connect / Notes
            </label>
            <textarea
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Add details from onboarding call, special requirements, or business goals..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white text-sm leading-relaxed"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs disabled:opacity-50 transition-all cursor-pointer"
            >
              {loading ? "Adding..." : "Enroll Member"}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}
