import { PrismaClient } from "@prisma/client";
import { assertRequiredServerEnv } from "./server-env";

declare global {
  var prisma: PrismaClient | undefined;
}

assertRequiredServerEnv();

export const db =
  global.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.prisma = db;
}
