import { prisma } from "../src/lib/db";

async function auditCrmData() {
  const [memberCount, contactFields, callLogCount, transferCount, unhealthyCount, paymentDueCount, logsByStaff, logsByMedium, latestLogs] = await Promise.all([
    prisma.member.count(),
    prisma.member.count({ where: { lastConnectDate: { not: null } } }),
    prisma.callLog.count(),
    prisma.queryTransfer.count(),
    prisma.member.count({ where: { healthStatus: { not: "healthy" } } }),
    prisma.member.count({ where: { paymentStatus: { in: ["partial", "unpaid"] } } }),
    prisma.callLog.groupBy({
      by: ["staffName"],
      _count: { _all: true },
      orderBy: { _count: { staffName: "desc" } },
    }),
    prisma.callLog.groupBy({
      by: ["medium"],
      _count: { _all: true },
    }),
    prisma.callLog.findMany({
      take: 20,
      orderBy: { date: "desc" },
      select: {
        date: true,
        staffName: true,
        staffEmail: true,
        medium: true,
        outcome: true,
        member: { select: { memberCode: true, fullName: true } },
      },
    }),
  ]);

  console.log(JSON.stringify({ memberCount, contactFields, callLogCount, transferCount, unhealthyCount, paymentDueCount, logsByStaff, logsByMedium, latestLogs }, null, 2));
}

auditCrmData()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
