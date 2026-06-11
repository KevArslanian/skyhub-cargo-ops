import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const srcDir = path.join(root, "src");

async function readAllFiles(dir, acc = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await readAllFiles(absolute, acc);
      continue;
    }
    if (/\.(tsx?|css)$/.test(entry.name)) {
      acc.push({ absolute, relative: path.relative(root, absolute) });
    }
  }
  return acc;
}

function assertNoMatch(content, pattern, label, failures) {
  if (pattern.test(content)) {
    failures.push(label);
  }
}

async function run() {
  const failures = [];
  const files = await readAllFiles(srcDir);
  const byPath = new Map(files.map((file) => [file.relative, file]));

  async function readRelative(relativePath) {
    const file = byPath.get(relativePath);
    if (!file) {
      failures.push(`missing-file:${relativePath}`);
      return "";
    }
    return readFile(file.absolute, "utf8");
  }

  for (const file of files) {
    const content = await readFile(file.absolute, "utf8");
    assertNoMatch(content, /DashboardTabs/, `${file.relative}: DashboardTabs`, failures);
    assertNoMatch(content, /dashboard-tabs/, `${file.relative}: dashboard-tabs class`, failures);
    assertNoMatch(content, /DashboardAlertsPanel/, `${file.relative}: DashboardAlertsPanel`, failures);
  }

  const shell = await readRelative("src/components/dashboard/control-center-shell.tsx");
  assertNoMatch(shell, /alertsError/, "control-center-shell: alertsError state", failures);
  assertNoMatch(shell, /Peringatan belum bisa dimuat/, "control-center-shell: alerts warning banner copy", failures);

  const summary = await readRelative("src/components/dashboard/summary-tab.tsx");
  assertNoMatch(summary, /dashboard-alerts/, "summary-tab: dashboard-alerts markup", failures);

  const hook = await readRelative("src/hooks/use-dashboard-data.ts");
  const alertsRequest = hook.match(/const requestDashboardAlerts = useCallback\(async[\s\S]*?\n  \}, \[fetchDashboardEndpoint\]\);/);
  if (!alertsRequest || !/failure:\s*"none"/.test(alertsRequest[0])) {
    failures.push('use-dashboard-data: requestDashboardAlerts must use failure: "none"');
  }
  const alertsLoader = hook.match(/const loadDashboardAlerts = useCallback\(async[\s\S]*?\n  \}, \[requestDashboardAlerts\]\);/);
  if (!alertsLoader) {
    failures.push("use-dashboard-data: loadDashboardAlerts definition missing");
  } else if (/showToast/.test(alertsLoader[0])) {
    failures.push("use-dashboard-data: loadDashboardAlerts must not call showToast");
  }

  const globals = await readRelative("src/app/globals.css");
  assertNoMatch(globals, /\.dashboard-alerts-/, "globals.css: dashboard-alerts styles", failures);
  assertNoMatch(globals, /\.dashboard-chart-card--alerts/, "globals.css: dashboard-chart-card--alerts", failures);
  if (!/\.ops-toast[\s\S]*backdrop-filter:\s*none/.test(globals)) {
    failures.push("globals.css: .ops-toast must disable backdrop-filter");
  }

  if (failures.length) {
    console.error("Dashboard invariants FAILED:");
    for (const failure of failures) {
      console.error(`  ${failure}`);
    }
    process.exit(1);
  }

  console.log("Dashboard invariants: ALL_PASS");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});