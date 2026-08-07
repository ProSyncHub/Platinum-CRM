import { prisma } from "../src/lib/db";
import bcrypt from "bcryptjs";

async function updateAllPasswords() {
  const newPassword = process.env.CRM_PASSWORD_RESET_VALUE;
  if (!newPassword) throw new Error("CRM_PASSWORD_RESET_VALUE is required.");

  console.log("Updating all user passwords to the supplied reset value...");
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  const result = await prisma.user.updateMany({
    data: { password: hashedPassword },
  });

  console.log(`Successfully updated ${result.count} users in the database.`);
}

updateAllPasswords()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
