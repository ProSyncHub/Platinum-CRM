import { readFile } from "node:fs/promises";
import { prisma } from "../src/lib/db";

const sourcePath = process.argv[2];
if (!sourcePath) throw new Error("Pass the pasted-text file path as the first argument.");

function normalize(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

function normalizePhone(value?: string | null) {
  return (value || "").replace(/\D/g, "").slice(-10);
}

async function preview() {
  const rows = (await readFile(sourcePath, "utf8"))
    .split(/\r?\n/)
    .map((line) => line.split("\t").map((cell) => cell.trim()))
    .filter((cells) => cells.some(Boolean));
  const members = await prisma.member.findMany({
    select: { id: true, fullName: true, email: true, phone: true, memberCode: true },
  });

  const results = rows.map((cells, index) => {
    const isShortVijayRow = cells.length < 8;
    const firstName = cells[0] || "";
    const lastName = isShortVijayRow ? "" : cells[1] || "";
    const email = isShortVijayRow ? cells[1] || "" : cells[3] || "";
    const phone = isShortVijayRow ? cells[3] || cells[2] || "" : cells[4] || "";
    const fullName = `${firstName} ${lastName}`.trim();
    const exact = members.filter((member) =>
      (email && normalize(member.email) === normalize(email)) ||
      (phone && normalizePhone(member.phone) === normalizePhone(phone))
    );
    const byName = members.filter((member) => normalize(member.fullName) === normalize(fullName));
    const matches = exact.length ? exact : byName;
    return {
      row: index + 1,
      source: { fullName, email, phone, cells: cells.length },
      matches: matches.map(({ id, memberCode, fullName: name }) => ({ id, memberCode, name })),
    };
  });

  console.log(JSON.stringify({
    rows: results.length,
    matched: results.filter((result) => result.matches.length === 1).length,
    unmatched: results.filter((result) => result.matches.length === 0),
    ambiguous: results.filter((result) => result.matches.length > 1),
  }, null, 2));
}

preview().finally(() => prisma.$disconnect());

