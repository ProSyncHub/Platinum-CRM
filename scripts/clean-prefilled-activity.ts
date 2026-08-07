import { prisma } from "../src/lib/db";

async function cleanPrefilledActivity() {
  const latestAbdulLog = await prisma.callLog.findFirst({
    where: { staffName: { equals: "Abdul Barr", mode: "insensitive" } },
    orderBy: { date: "desc" },
  });

  if (!latestAbdulLog) {
    throw new Error("Cleanup stopped: no Abdul Barr interaction was found to preserve.");
  }

  const abdulUser = await prisma.user.findFirst({
    where: { name: { equals: "Abdul Barr", mode: "insensitive" } },
    select: { email: true, department: true },
  });

  const [removedLogs, removedTransfers, resetMembers] = await prisma.$transaction([
    prisma.callLog.deleteMany({ where: { id: { not: latestAbdulLog.id } } }),
    prisma.queryTransfer.deleteMany({}),
    prisma.member.updateMany({
      data: {
        lastConnectDate: null,
        nextConnectDate: null,
        lastContactMedium: null,
        lastContactStaff: null,
        healthStatus: "healthy",
      },
    }),
  ]);

  await prisma.callLog.update({
    where: { id: latestAbdulLog.id },
    data: {
      staffName: "Abdul Barr",
      staffEmail: abdulUser?.email || latestAbdulLog.staffEmail,
      staffDepartment: abdulUser?.department?.toLowerCase() || "management",
    },
  });

  await prisma.member.update({
    where: { id: latestAbdulLog.memberId },
    data: {
      lastConnectDate: latestAbdulLog.date,
      lastContactMedium: latestAbdulLog.medium,
      lastContactStaff: "Abdul Barr",
    },
  });

  console.log(JSON.stringify({
    preservedInteractionId: latestAbdulLog.id,
    preservedMemberId: latestAbdulLog.memberId,
    removedCallLogs: removedLogs.count,
    removedTransfers: removedTransfers.count,
    resetMembers: resetMembers.count,
  }, null, 2));
}

cleanPrefilledActivity()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

