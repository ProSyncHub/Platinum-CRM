import { syncWorkforceStaffToCRM } from "../src/lib/workforce";
import { prisma } from "../src/lib/db";

async function main() {
  console.log("🚀 Starting Workforce to CRM Sync...");
  const result = await syncWorkforceStaffToCRM();
  console.log("Sync Result:", result);

  const totalUsers = await prisma.user.count();
  console.log(`\n✅ Total Users in CRM Database: ${totalUsers}`);

  const sampleUsers = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, department: true },
    take: 30,
  });
  console.table(sampleUsers);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
