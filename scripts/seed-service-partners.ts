import { PrismaClient } from "@prisma/client";
import { DEFAULT_SERVICE_PARTNERS } from "../src/lib/servicePartners";

const prisma = new PrismaClient();

async function main() {
  for (const partner of DEFAULT_SERVICE_PARTNERS) {
    await prisma.servicePartner.upsert({
      where: { serviceCode: partner.serviceCode },
      update: {
        serviceName: partner.serviceName,
        providerName: partner.providerName,
        category: partner.category,
        description: partner.description,
        benefitLabel: partner.benefitLabel,
        includedConsultations: partner.includedConsultations,
        contactPerson: partner.contactPerson,
        active: true,
        order: partner.order,
      },
      create: {
        ...partner,
        active: true,
      },
    });
  }

  const partners = await prisma.servicePartner.findMany({
    orderBy: { order: "asc" },
    select: {
      serviceCode: true,
      serviceName: true,
      providerName: true,
      benefitLabel: true,
    },
  });

  console.log(JSON.stringify({ seeded: partners.length, partners }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

