import { prisma } from "../src/lib/db";
import bcrypt from "bcryptjs";

async function main() {
  console.log("🔄 Updating user roles & setting primary admin...");

  const initialAdminPassword = process.env.CRM_INITIAL_ADMIN_PASSWORD;
  if (!initialAdminPassword) {
    throw new Error("CRM_INITIAL_ADMIN_PASSWORD is required.");
  }
  const passwordHash = await bcrypt.hash(initialAdminPassword, 10);

  // 1. Ensure admin@prosyncedu.com is the primary Admin
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@prosyncedu.com" },
    update: {
      name: "ProSync Admin",
      role: "admin",
      department: "Management",
      active: true,
      password: passwordHash,
    },
    create: {
      name: "ProSync Admin",
      email: "admin@prosyncedu.com",
      password: passwordHash,
      role: "admin",
      department: "Management",
      active: true,
    },
  });
  console.log(`✅ Admin configured: ${adminUser.email} (Role: ${adminUser.role})`);

  // 2. Demote any previous admin (other than admin@prosyncedu.com) to manager or employee
  const otherAdmins = await prisma.user.findMany({
    where: {
      role: "admin",
      email: { not: "admin@prosyncedu.com" },
    },
  });

  for (const user of otherAdmins) {
    if (user.email.toLowerCase().includes("samyak") || user.name.toLowerCase().includes("samyak")) {
      await prisma.user.update({
        where: { id: user.id },
        data: { role: "manager" },
      });
      console.log(`✅ Demoted ${user.name} (${user.email}) from admin to manager`);
    } else if (user.email.toLowerCase().includes("mayank") || user.name.toLowerCase().includes("mayank")) {
      await prisma.user.update({
        where: { id: user.id },
        data: { role: "manager" },
      });
      console.log(`✅ Set ${user.name} (${user.email}) to manager`);
    } else {
      // Remove admin privilege from any legacy admin accounts
      await prisma.user.update({
        where: { id: user.id },
        data: { role: "manager" },
      });
      console.log(`ℹ️ Changed ${user.email} from admin to manager`);
    }
  }

  // 3. Make sure Samyak is manager
  const samyakUsers = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: "samyak" } },
        { name: { contains: "Samyak" } },
      ],
    },
  });

  if (samyakUsers.length === 0) {
    // Create Samyak if not found
    await prisma.user.create({
      data: {
        name: "Samyak Jain",
        email: "samyakjainprosync@gmail.com",
        password: passwordHash,
        role: "manager",
        department: "Operations",
        active: true,
      },
    });
    console.log("✅ Created Samyak Jain as manager (samyakjainprosync@gmail.com)");
  } else {
    for (const u of samyakUsers) {
      await prisma.user.update({
        where: { id: u.id },
        data: {
          role: "manager",
          active: true,
          password: passwordHash,
        },
      });
      console.log(`✅ Updated ${u.name} (${u.email}) -> Role: manager`);
    }
  }

  // 4. Make sure Mayank is manager
  const mayankUsers = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: "mayank" } },
        { name: { contains: "Mayank" } },
      ],
    },
  });

  if (mayankUsers.length === 0) {
    // Create Mayank if not found
    await prisma.user.create({
      data: {
        name: "Mayank",
        email: "mayankr.prosync@gmail.com",
        password: passwordHash,
        role: "manager",
        department: "Operations",
        active: true,
      },
    });
    console.log("✅ Created Mayank as manager (mayankr.prosync@gmail.com)");
  } else {
    for (const u of mayankUsers) {
      await prisma.user.update({
        where: { id: u.id },
        data: {
          role: "manager",
          active: true,
          password: passwordHash,
        },
      });
      console.log(`✅ Updated ${u.name} (${u.email}) -> Role: manager`);
    }
  }

  // 5. Output full user directory
  const allUsers = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  console.log("\n📋 Current System User Directory:");
  console.table(
    allUsers.map((u) => ({
      ID: u.id,
      Name: u.name,
      Email: u.email,
      Role: u.role,
      Department: u.department,
      Active: u.active,
    }))
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
