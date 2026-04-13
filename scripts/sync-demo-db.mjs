import { access, copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFilePath = fileURLToPath(import.meta.url);
const workspaceRoot = path.resolve(path.dirname(currentFilePath), "..");
const sourcePath = path.join(workspaceRoot, "prisma", "dev.db");
const targetPath = path.join(workspaceRoot, "prisma", "seed.db");

try {
  await access(sourcePath);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await copyFile(sourcePath, targetPath);
  console.log("Bundled demo database synced to prisma/seed.db");
} catch {
  console.log("Skipped demo database sync because prisma/dev.db is not available yet.");
}
