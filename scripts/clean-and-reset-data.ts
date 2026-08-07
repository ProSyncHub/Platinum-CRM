import { prisma } from "../src/lib/db";
import { REAL_PLATINUM_MEMBERS } from "../src/lib/data/platinumMembersData";

async function cleanAndReset() {
  console.log("🧹 Starting Database Data Cleanup...");

  // 1. Remove all mock PNP members & their relations
  const pnpMembers = await prisma.member.findMany({
    where: {
      OR: [
        { programType: "PNP" },
        { memberCode: { startsWith: "PNP" } },
      ],
    },
    select: { id: true, memberCode: true, fullName: true },
  });

  console.log(`Found ${pnpMembers.length} mock PNP members to remove.`);

  for (const m of pnpMembers) {
    // Delete associated call logs & queries
    await prisma.callLog.deleteMany({ where: { memberId: m.id } });
    await prisma.queryTransfer.deleteMany({ where: { memberId: m.id } });
    await prisma.member.delete({ where: { id: m.id } });
    console.log(`🗑️ Removed PNP member: ${m.memberCode} - ${m.fullName}`);
  }

  // 2. Fix any "Deepanshi" assignments in the database
  const deepanshiMembers = await prisma.member.findMany({
    where: {
      allotedTo: { contains: "Deepanshi" },
    },
  });

  if (deepanshiMembers.length > 0) {
    console.log(`Found ${deepanshiMembers.length} members with obsolete assignment. Updating to Unassigned...`);
    await prisma.member.updateMany({
      where: { allotedTo: { contains: "Deepanshi" } },
      data: { allotedTo: "Unassigned" },
    });
  }

  // 3. Ensure all real Platinum members are properly synced and up to date
  let syncedPlatinumCount = 0;
  for (const m of REAL_PLATINUM_MEMBERS) {
    const alloted = m.allotedTo === "Deepanshi" ? "Unassigned" : m.allotedTo;

    await prisma.member.upsert({
      where: { memberCode: m.memberCode },
      update: {
        programType: "Platinum",
        firstName: m.firstName,
        lastName: m.lastName,
        fullName: m.fullName,
        state: m.state,
        email: m.email,
        phone: m.phone,
        enrollingDate: m.enrollingDate ? new Date(m.enrollingDate) : null,
        endDate: m.endDate ? new Date(m.endDate) : null,
        plan: m.plan,
        activeStatus: m.activeStatus,
        holdReason: m.holdReason,
        allotedTo: alloted,
        oneOnOneSessions: m.oneOnOneSessions,
        businessType: m.businessType,
        brandCollaborations: m.brandCollaborations,
        plBrand: m.plBrand,
        resellingBrand: m.resellingBrand,
        salesData: m.salesData,
        salesAmount: m.salesAmount,
        currentStage: m.currentStage,
        currentMilestone: m.currentMilestone,
        healthStatus: "healthy",
        notes: m.notes,
        detailedNotes: m.detailedNotes,
        lastConnectDate: null,
        nextConnectDate: null,
        lastContactMedium: null,
        lastContactStaff: null,
        budgetAvailable: m.budgetAvailable,
        gstStatus: m.gstStatus,
        countryInterest: m.countryInterest,
      },
      create: {
        memberCode: m.memberCode,
        programType: "Platinum",
        firstName: m.firstName,
        lastName: m.lastName,
        fullName: m.fullName,
        state: m.state,
        email: m.email,
        phone: m.phone,
        enrollingDate: m.enrollingDate ? new Date(m.enrollingDate) : null,
        endDate: m.endDate ? new Date(m.endDate) : null,
        plan: m.plan,
        activeStatus: m.activeStatus,
        holdReason: m.holdReason,
        allotedTo: alloted,
        oneOnOneSessions: m.oneOnOneSessions,
        businessType: m.businessType,
        brandCollaborations: m.brandCollaborations,
        plBrand: m.plBrand,
        resellingBrand: m.resellingBrand,
        salesData: m.salesData,
        salesAmount: m.salesAmount,
        currentStage: m.currentStage,
        currentMilestone: m.currentMilestone,
        healthStatus: "healthy",
        notes: m.notes,
        detailedNotes: m.detailedNotes,
        lastConnectDate: null,
        nextConnectDate: null,
        lastContactMedium: null,
        lastContactStaff: null,
        budgetAvailable: m.budgetAvailable,
        gstStatus: m.gstStatus,
        countryInterest: m.countryInterest,
      },
    });
    syncedPlatinumCount++;
  }

  // 4. Verification summary
  const totalMembers = await prisma.member.count();
  const totalPlatinum = await prisma.member.count({ where: { programType: "Platinum" } });
  const totalPNP = await prisma.member.count({ where: { programType: "PNP" } });
  const totalStaff = await prisma.user.count();

  console.log("\n✅ Database Reset Complete!");
  console.log(`📊 Total Members in CRM: ${totalMembers}`);
  console.log(`👑 Real Platinum Members: ${totalPlatinum}`);
  console.log(`⚡ PNP Members: ${totalPNP} (Clean slate — ready for your real data entry)`);
  console.log(`👥 Total Staff: ${totalStaff}`);
}

cleanAndReset()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
