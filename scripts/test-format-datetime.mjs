import { spawnSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();

const snippet = `
import { formatDateTime, formatDateTimeCompact } from "./src/lib/format.ts";

const sample = "2026-06-11T06:30:00.000Z";
const full = formatDateTime(sample);
const compact = formatDateTimeCompact(sample);

function assert(label, condition) {
  if (!condition) throw new Error(label);
}

assert("formatDateTime includes date parts", /\\d{2} \\p{L}+ 2026/u.test(full));
assert("formatDateTime includes clock", /, \\d{2}:\\d{2}$/.test(full));
assert("formatDateTimeCompact includes date", /\\d{2} \\p{L}+,/u.test(compact));
assert("formatDateTimeCompact includes clock", /\\d{2}:\\d{2}$/.test(compact));
assert("no relative suffix in full", !/yang lalu/i.test(full));
assert("no relative suffix in compact", !/yang lalu/i.test(compact));

console.log("formatDateTime:", full);
console.log("formatDateTimeCompact:", compact);
console.log("Datetime format unit test: ALL_PASS");
`;

const result = spawnSync("pnpm", ["exec", "tsx", "-e", snippet], {
  cwd: root,
  encoding: "utf8",
  shell: process.platform === "win32",
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}