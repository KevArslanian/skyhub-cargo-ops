/**
 * Non-destructive repair: ensure QA customer account + customer@skyhub.test exist.
 * Run: node scripts/ensure-qa-auth-users.mjs
 */
import { hashSync } from "bcryptjs";
import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();
const PASSWORD_HASH = hashSync("operator123", 10);

async function main() {
  let account = await prisma.customerAccount.findFirst({
    where: { status: "active" },
    orderBy: { createdAt: "asc" },
  });

  if (!account) {
    account = await prisma.customerAccount.create({
      data: {
        code: "SORCARGO",
        name: "PT Sorong Cargo Nusantara",
        contactName: "Nadia Kusuma",
        contactEmail: "customer@skyhub.test",
        contactPhone: "+62-811-7000-001",
        status: "active",
      },
    });
    console.log("Created customer account:", account.code);
  }

  const existing = await prisma.user.findUnique({ where: { email: "customer@skyhub.test" } });
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        passwordHash: PASSWORD_HASH,
        status: "active",
        role: UserRole.customer,
        customerAccountId: account.id,
      },
    });
    console.log("Updated customer@skyhub.test");
  } else {
    await prisma.user.create({
      data: {
        name: "Nadia Kusuma",
        email: "customer@skyhub.test",
        passwordHash: PASSWORD_HASH,
        role: UserRole.customer,
        station: "SOQ",
        status: "active",
        customerAccountId: account.id,
        settings: {
          create: {
            theme: "light",
            compactRows: false,
            sidebarCollapsed: false,
            cutoffAlert: true,
            exceptionAlert: true,
            soundAlert: false,
            emailDigest: false,
            autoRefresh: true,
            refreshIntervalSeconds: 15,
            timezone: "Asia/Makassar",
          },
        },
      },
    });
    console.log("Created customer@skyhub.test");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());