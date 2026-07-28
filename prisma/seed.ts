import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash("password123", 10);

  // Manager
  await prisma.user.upsert({
    where: { email: "manager@platinum.com" },
    update: {},
    create: {
      email: "manager@platinum.com",
      name: "Super Manager",
      password,
      role: "manager",
      department: "manager",
    },
  });

  // Ecom Employee
  await prisma.user.upsert({
    where: { email: "ecom@platinum.com" },
    update: {},
    create: {
      email: "ecom@platinum.com",
      name: "Ecom Exec",
      password,
      role: "employee",
      department: "ecom",
    },
  });

  // Brand Employee
  await prisma.user.upsert({
    where: { email: "brand@platinum.com" },
    update: {},
    create: {
      email: "brand@platinum.com",
      name: "Brand Exec",
      password,
      role: "employee",
      department: "brand",
    },
  });

  // Follow Up Employee
  await prisma.user.upsert({
    where: { email: "followup@platinum.com" },
    update: {},
    create: {
      email: "followup@platinum.com",
      name: "Follow Up Exec",
      password,
      role: "employee",
      department: "follow_up",
    },
  });

  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
