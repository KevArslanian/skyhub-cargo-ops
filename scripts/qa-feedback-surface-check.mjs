import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const banned = [/tone-(?:warning|danger|info|success)-soft/i, /emerald-50/i, /emerald-200/i];

const checks = [
  { file: "src/components/alert-dialog.tsx" },
  { file: "src/components/confirm-dialog.tsx" },
  { file: "src/app/error.tsx" },
  { file: "src/app/(app)/error.tsx" },
  { file: "src/components/dashboard/control-center-shell.tsx" },
  { file: "src/app/(auth)/login/page.tsx" },
  { file: "src/components/ops-toast.tsx" },
  {
    file: "src/components/ops-ui.tsx",
    slice: (content) => {
      const start = content.indexOf("export function OpsFeedbackBanner");
      const end = content.indexOf("export function EmptyState");
      if (start < 0 || end < 0) return content;
      return content.slice(start, end);
    },
  },
  {
    file: "src/app/(app)/complaints/page.tsx",
    slice: (content) => {
      const marker = "Alasan eskalasi:";
      const index = content.indexOf(marker);
      return index >= 0 ? content.slice(Math.max(0, index - 200), index + 400) : "";
    },
  },
];

function findViolations(content, label) {
  const hits = [];
  for (const pattern of banned) {
    if (pattern.test(content)) {
      hits.push(pattern.source);
    }
  }
  return hits.map((pattern) => ({ file: label, pattern }));
}

async function run() {
  const failures = [];

  for (const check of checks) {
    const absolute = path.join(root, check.file);
    const raw = await readFile(absolute, "utf8");
    const content = check.slice ? check.slice(raw) : raw;
    failures.push(...findViolations(content, check.file));
  }

  if (failures.length) {
    console.error("Feedback surface check FAILED:");
    for (const failure of failures) {
      console.error(`  ${failure.file}: matched ${failure.pattern}`);
    }
    process.exit(1);
  }

  console.log(`Feedback surface check: ALL_PASS (${checks.length} targets)`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});