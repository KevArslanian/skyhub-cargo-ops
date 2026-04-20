import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

function configureRuntimeSqliteDatabase() {
  const provider = process.env.DATABASE_PROVIDER ?? "postgresql";
  if (provider !== "sqlite") {
    return;
  }

  const shouldUseBundledSqlite = process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
  if (!shouldUseBundledSqlite) {
    return;
  }

  const bundledDbPath = path.join(/* turbopackIgnore: true */ process.cwd(), "prisma", "seed.db");
  if (!existsSync(bundledDbPath)) {
    return;
  }

  const runtimeDir = path.join("/tmp", "skyhub-demo-db");
  const runtimeDbPath = path.join(runtimeDir, "seed.db");

  if (!existsSync(runtimeDbPath)) {
    mkdirSync(runtimeDir, { recursive: true });
    copyFileSync(bundledDbPath, runtimeDbPath);
  }

  process.env.DATABASE_URL = `file:${runtimeDbPath}`;
}

configureRuntimeSqliteDatabase();

export const db =
  global.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.prisma = db;
}
