import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const srcDir = path.join(root, "src");
const allowlist = new Set([path.join(srcDir, "lib", "format.ts")]);

const banned = [
  { id: "formatRelativeShort", pattern: /\bformatRelativeShort\b/ },
  { id: "formatTimeOnly", pattern: /\bformatTimeOnly\b/ },
  { id: "formatDistanceToNow", pattern: /\bformatDistanceToNow(?:Strict)?\b/ },
];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(absolute)));
      continue;
    }
    if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      files.push(absolute);
    }
  }

  return files;
}

async function run() {
  const files = await walk(srcDir);
  const failures = [];

  for (const file of files) {
    if (allowlist.has(file)) continue;

    const content = await readFile(file, "utf8");
    const relative = path.relative(root, file);

    for (const rule of banned) {
      if (rule.pattern.test(content)) {
        failures.push({ file: relative, rule: rule.id });
      }
    }
  }

  if (failures.length) {
    console.error("Datetime format check FAILED — UI must use formatDateTime / formatDateTimeCompact:");
    for (const failure of failures) {
      console.error(`  ${failure.file}: ${failure.rule}`);
    }
    process.exit(1);
  }

  console.log(`Datetime format check: ALL_PASS (${files.length - allowlist.size} files scanned)`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});