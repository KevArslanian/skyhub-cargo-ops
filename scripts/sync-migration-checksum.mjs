import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

const migrationName = process.argv[2];

if (!migrationName) {
  console.error("Usage: node scripts/sync-migration-checksum.mjs <migration_folder_name>");
  process.exit(1);
}

const sqlPath = join(process.cwd(), "prisma", "migrations", migrationName, "migration.sql");
const sql = readFileSync(sqlPath, "utf8");
const checksum = createHash("sha256").update(sql).digest("hex");

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(
    `UPDATE "_prisma_migrations" SET checksum = $1 WHERE migration_name = $2`,
    checksum,
    migrationName,
  );
  console.log(`Synced checksum for ${migrationName}: ${checksum}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });