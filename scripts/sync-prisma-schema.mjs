import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const supportedProviders = new Set(["sqlite", "postgresql"]);
const provider = process.env.DATABASE_PROVIDER ?? "sqlite";

if (!supportedProviders.has(provider)) {
  console.error(
    `Unsupported DATABASE_PROVIDER "${provider}". Use one of: ${Array.from(supportedProviders).join(", ")}.`,
  );
  process.exit(1);
}

const currentFilePath = fileURLToPath(import.meta.url);
const workspaceRoot = path.resolve(path.dirname(currentFilePath), "..");
const templatePath = path.join(workspaceRoot, "prisma", "schema.template.prisma");
const outputPath = path.join(workspaceRoot, "prisma", "schema.prisma");

const template = await readFile(templatePath, "utf8");
const schema = template.replace('__DATABASE_PROVIDER__', provider);

await writeFile(
  outputPath,
  `// This file is generated from prisma/schema.template.prisma.\n// Run \`pnpm prisma:sync-schema\` after changing DATABASE_PROVIDER.\n\n${schema}`,
);

console.log(`Prisma schema synced for provider: ${provider}`);
