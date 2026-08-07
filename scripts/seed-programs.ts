import { prisma } from "../src/lib/db";
import { DEFAULT_PROGRAMS } from "../src/lib/programs";

async function seedPrograms() {
  console.log("🌱 Seeding default CRM programs...");

  for (const prog of DEFAULT_PROGRAMS) {
    const existing = await prisma.program.findFirst({
      where: {
        OR: [
          { name: prog.name },
          { codePrefix: prog.codePrefix },
        ],
      },
    });

    if (!existing) {
      const created = await prisma.program.create({
        data: prog,
      });
      console.log(`✅ Created Program: ${created.name} (${created.codePrefix})`);
    } else {
      console.log(`ℹ️ Program already exists: ${existing.name} (${existing.codePrefix})`);
    }
  }

  const all = await prisma.program.findMany();
  console.log(`\n🎉 Total Programs in Database: ${all.length}`);
  all.forEach((p) => console.log(` - ${p.icon || "👑"} ${p.name} [Prefix: ${p.codePrefix}-2026-XXX] (Color: ${p.badgeColor})`));

  process.exit(0);
}

seedPrograms().catch((err) => {
  console.error("Error seeding programs:", err);
  process.exit(1);
});
