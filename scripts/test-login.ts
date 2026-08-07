import { prisma } from "../src/lib/db";
import bcrypt from "bcryptjs";

async function testLogin() {
  const testEmails = [
    "admin@prosyncedu.com",
    "samyakjainprosync@gmail.com",
    "mayankr.prosync@gmail.com",
    "abdulbarrprosync@gmail.com",
  ];
  const testPassword = process.env.CRM_TEST_PASSWORD;
  if (!testPassword) throw new Error("CRM_TEST_PASSWORD is required.");

  console.log("Verifying the supplied test password against user accounts...");
  for (const email of testEmails) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.log(`User not found: ${email}`);
      continue;
    }

    const matches = await bcrypt.compare(testPassword, user.password);
    console.log(
      `[${matches ? "SUCCESS" : "FAILED"}] ${email} -> Name: "${user.name}", Role: "${user.role}", Dept: "${user.department}"`,
    );
  }
}

testLogin()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
