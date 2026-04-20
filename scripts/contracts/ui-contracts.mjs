import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();

const checks = [
  {
    file: "src/components/app-shell.tsx",
    includes: ["app-workspace", "shell-sidebar-nav-scroll", "shell-content-frame"],
  },
  {
    file: "src/app/globals.css",
    includes: [
      ".app-workspace",
      ".shell-sidebar-nav-scroll",
      ".shell-content-frame",
      "--panel-radius:",
      "--control-radius:",
      "--space-16:",
      ".ops-table-scroll",
      ".ops-table-sticky thead th",
      ".ops-pane-scroll",
    ],
  },
  {
    file: "src/components/ops-ui.tsx",
    includes: ["ops-page-header", "ops-filter-bar", "metric-card", "ops-empty"],
  },
  {
    file: "src/components/status-badge.tsx",
    includes: ["aria-label", "bg-current"],
  },
  {
    file: "src/app/(app)/dashboard/page.tsx",
    includes: ["dashboard-viewport", "ops-table-scroll", "ops-table-sticky", "dashboard-side-stack"],
  },
  {
    file: "src/app/(app)/shipment-ledger/page.tsx",
    includes: ["ledger-layout", "ops-table-scroll", "ops-table-sticky", "ops-pane-scroll", "PDF / Print"],
    excludes: ["CSV"],
  },
  {
    file: "src/app/(app)/awb-tracking/page.tsx",
    includes: [
      "Received",
      "Sortation",
      "Loaded to Aircraft",
      "Departed",
      "Arrived",
      "AWB belum ditemukan",
      "Periksa kembali inputnya atau hubungi supervisor",
    ],
  },
  {
    file: "src/app/(app)/flight-board/page.tsx",
    includes: ["ops-table-scroll", "ops-table-sticky", "flight-board-layout", "selectedFlight"],
  },
  {
    file: "src/app/(app)/activity-log/page.tsx",
    includes: ["ops-table-scroll", "ops-table-sticky", "PDF / Print"],
    excludes: ["CSV"],
  },
  {
    file: "src/app/(app)/reports/page.tsx",
    includes: ["Shipment PDF / Print", "Activity PDF / Print"],
    excludes: ["Shipment Ledger CSV", "Activity Log CSV", "/api/exports/shipments", "/api/exports/activity-log", "CSV"],
  },
  {
    file: "src/app/(app)/settings/page.tsx",
    includes: ["settings-layout", "settings-tab-rail", "settings-content-scroll"],
  },
  {
    file: "src/app/(auth)/login/page.tsx",
    includes: ["login-shell", "login-rail", "login-hero"],
  },
  {
    file: "src/app/(auth)/about-us/page.tsx",
    includes: ["about-shell", "about-frame"],
  },
  {
    file: "src/app/api/uploads/[file]/route.ts",
    includes: ["csv: \"text/csv; charset=utf-8\""],
  },
  {
    file: "src/app/(app)/shipment-ledger/page.tsx",
    excludes: ["/api/exports/shipments"],
  },
  {
    file: "src/app/(app)/activity-log/page.tsx",
    excludes: ["/api/exports/activity-log"],
  },
  {
    file: "src/app/(app)/reports/page.tsx",
    excludes: ["/api/exports/shipments", "/api/exports/activity-log", "CSV"],
  },
];

const failures = [];

for (const check of checks) {
  const content = readFileSync(resolve(root, check.file), "utf8");

  if (check.includes) {
    for (const token of check.includes) {
      if (!content.includes(token)) {
        failures.push(`${check.file} missing: ${token}`);
      }
    }
  }

  if (check.excludes) {
    for (const token of check.excludes) {
      if (content.includes(token)) {
        failures.push(`${check.file} should not include: ${token}`);
      }
    }
  }
}

if (failures.length) {
  console.error("UI contract checks failed:\n" + failures.map((entry) => `- ${entry}`).join("\n"));
  process.exit(1);
}

console.log("UI contract checks passed");
