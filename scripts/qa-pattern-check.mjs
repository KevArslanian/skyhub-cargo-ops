import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { sleep, waitForServer, withThrottle } from "./qa-throttle.mjs";

const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3100";
const password = process.env.QA_LOGIN_PASSWORD ?? "operator123";
const email = process.env.QA_LOGIN_EMAIL ?? "staff@skyhub.test";
const viewport = { width: 1440, height: 900 };

const ROUTES = [
  { route: "/shipment-ledger", needsCreate: true, needsToolbar: false, createInPanel: true },
  { route: "/awb-tracking", needsCreate: false, needsToolbar: false },
  { route: "/flight-board", needsCreate: true, needsToolbar: false, createInPanel: true, waitFor: ".section-header-actions .btn-primary" },
  { route: "/alerts", needsCreate: false, needsToolbar: false },
  { route: "/activity-log", needsCreate: false, needsToolbar: false },
  { route: "/complaints", needsCreate: false, needsToolbar: false },
];

async function loginStaff(page) {
  await page.request.post(new URL("/api/auth/intro", baseUrl).toString());
  const response = await page.request.post(new URL("/api/auth/login", baseUrl).toString(), {
    data: { email, password, remember: false },
  });
  if (!response.ok()) throw new Error(`Login failed: ${response.status()}`);
  await page.goto(new URL("/dashboard", baseUrl).toString(), { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
}

async function checkPattern(page, route, config) {
  await withThrottle(async () => {
    await page.goto(new URL(route, baseUrl).toString(), { waitUntil: "domcontentloaded", timeout: 30000 });
  });
  if (config.waitFor) {
    await page.locator(config.waitFor).first().waitFor({ state: "visible", timeout: 20000 }).catch(() => {});
  }
  await page.waitForTimeout(1000);

  return page.evaluate((cfg) => {
    const failures = [];
    const h1 = document.querySelector("h1");
    if (!h1) failures.push("missing-h1-sr");

    const toolbar = document.querySelector(".page-action-toolbar");
    if (cfg.needsToolbar && !toolbar) failures.push("missing-page-action-toolbar");

    const filter = document.querySelector(".ops-filter-strip");
    if (!filter) failures.push("missing-ops-filter-strip");

    const locked = document.querySelector(".ops-locked-page");
    if (!locked) failures.push("missing-ops-locked-page");

    if (cfg.needsCreate) {
      const createBtn = Array.from(document.querySelectorAll("button")).find((b) =>
        /buat/i.test(b.textContent ?? ""),
      );
      if (!createBtn) failures.push("missing-create-button");
      else if (cfg.createInPanel) {
        const panelActions = document.querySelector(".ops-locked-page__body .section-header-actions");
        if (!panelActions) failures.push("missing-panel-section-actions");
        else if (!panelActions.contains(createBtn)) failures.push("create-not-in-panel-header");
      } else if (toolbar && !toolbar.contains(createBtn)) {
        failures.push("create-not-in-toolbar");
      }
    }

    return failures;
  }, config);
}

async function run() {
  await waitForServer(baseUrl);
  const outputDir = path.join(process.cwd(), "test-results", "pattern-check");
  await mkdir(outputDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport });
  await loginStaff(page);

  const results = [];
  for (const config of ROUTES) {
    const failures = await checkPattern(page, config.route, config);
    const status = failures.length ? "fail" : "pass";
    results.push({ route: config.route, status, failures });
    console.log(`${status === "pass" ? "PASS" : "FAIL"} ${config.route} ${failures.join(", ") || ""}`);
    await sleep(800);
  }

  await browser.close();

  const report = {
    generatedAt: new Date().toISOString(),
    results,
    summary: {
      pass: results.filter((r) => r.status === "pass").length,
      fail: results.filter((r) => r.status === "fail").length,
    },
  };

  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, "pattern-check-report.json"), JSON.stringify(report, null, 2));

  if (report.summary.fail > 0) {
    console.error(`Pattern check: ${report.summary.fail} route(s) FAILED`);
    process.exit(1);
  }

  console.log(`Pattern check: ALL_PASS (${report.summary.pass} routes)`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});