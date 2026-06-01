import { stat, readdir, rm, mkdir, rename } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const AUTO = process.argv.includes("--auto");
const APPLY = process.argv.includes("--apply");
const PURGE = process.argv.includes("--purge");
const QUIET = process.argv.includes("--quiet") || AUTO;

const SIZE_WARN_BYTES = 400 * 1024;

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  ".vercel",
  "_scratch_backup",
  "test-results",
]);

// auto:true  -> pure regenerable noise, safe to delete unattended.
// auto:false -> reported only; never touched by --auto (may be intentional output / build cache).
const SCRATCH_MATCHERS = [
  { label: "screenshot", auto: false, test: (name) => /^shot-.*\.png$/i.test(name) },
  { label: "tsbuildinfo", auto: false, test: (name) => name.endsWith(".tsbuildinfo") },
  { label: "log", auto: true, test: (name) => name.endsWith(".log") },
  { label: "playwright trace", auto: true, test: (name) => name.endsWith(".zip") && /trace/i.test(name) },
];

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}

async function walk(dir, hits) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await walk(path.join(dir, entry.name), hits);
      continue;
    }
    if (!entry.isFile()) continue;
    const matcher = SCRATCH_MATCHERS.find((m) => m.test(entry.name));
    if (!matcher) continue;
    const full = path.join(dir, entry.name);
    const info = await stat(full);
    hits.push({
      full,
      rel: path.relative(root, full),
      label: matcher.label,
      auto: matcher.auto,
      size: info.size,
    });
  }
}

function log(...args) {
  if (!QUIET) console.log(...args);
}

const hits = [];
await walk(root, hits);

// --- Auto mode: hands-off, deletes only regenerable noise, advises on the rest. ---
if (AUTO) {
  const removable = hits.filter((h) => h.auto);
  const advisory = hits.filter((h) => !h.auto && h.size >= SIZE_WARN_BYTES);

  let reclaimed = 0;
  for (const hit of removable) {
    await rm(hit.full, { force: true });
    reclaimed += hit.size;
  }

  if (removable.length > 0) {
    console.log(`[compact] removed ${removable.length} scratch file(s), reclaimed ${formatBytes(reclaimed)}.`);
  }
  if (advisory.length > 0) {
    const advBytes = advisory.reduce((sum, h) => sum + h.size, 0);
    console.log(
      `[compact] ${advisory.length} large artifact(s) kept (${formatBytes(advBytes)}). Run \`pnpm compact:apply\` to archive them.`,
    );
  }
  process.exit(0);
}

// --- Manual modes (dry-run / apply / purge). ---
if (hits.length === 0) {
  log("Workspace already compact. No scratch artifacts found.");
  process.exit(0);
}

hits.sort((a, b) => b.size - a.size);
const totalBytes = hits.reduce((sum, h) => sum + h.size, 0);

log(`Found ${hits.length} scratch artifact(s), ${formatBytes(totalBytes)} total:`);
for (const hit of hits) {
  const flag = hit.size >= SIZE_WARN_BYTES ? " (large)" : "";
  log(`  - [${hit.label}] ${hit.rel}  ${formatBytes(hit.size)}${flag}`);
}

if (!APPLY) {
  log("");
  log("Dry run. Re-run with --apply to move them to _scratch_backup/, or --apply --purge to delete.");
  process.exit(0);
}

if (PURGE) {
  for (const hit of hits) {
    await rm(hit.full, { force: true });
  }
  log("");
  log(`Purged ${hits.length} artifact(s), reclaimed ${formatBytes(totalBytes)}.`);
  process.exit(0);
}

const backupDir = path.join(root, "_scratch_backup");
await mkdir(backupDir, { recursive: true });
for (const hit of hits) {
  let dest = path.join(backupDir, path.basename(hit.full));
  if (dest === hit.full) continue;
  try {
    await stat(dest);
    dest = path.join(backupDir, `${Date.now()}-${path.basename(hit.full)}`);
  } catch {}
  await rename(hit.full, dest);
}
log("");
log(`Moved ${hits.length} artifact(s) to _scratch_backup/ (${formatBytes(totalBytes)}). Delete it when ready.`);
