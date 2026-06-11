import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { sleep, waitForServer } from "./qa-throttle.mjs";

const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3100";
const password = process.env.QA_LOGIN_PASSWORD ?? "operator123";
const email = process.env.QA_LOGIN_EMAIL ?? "staff@skyhub.test";
const viewport = { width: 1440, height: 900 };
const settleMs = Number(process.env.QA_DASHBOARD_CALM_SETTLE_MS ?? 3500);

async function loginStaff(page) {
  await page.request.post(new URL("/api/auth/intro", baseUrl).toString());
  const response = await page.request.post(new URL("/api/auth/login", baseUrl).toString(), {
    data: { email, password, remember: false },
  });
  if (!response.ok()) throw new Error(`Login failed: ${response.status()}`);
}

async function run() {
  await waitForServer(baseUrl);
  const outputDir = path.join(process.cwd(), "test-results", "dashboard-calm");
  await mkdir(outputDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport });
  await loginStaff(page);

  await page.route("**/api/dashboard**", async (route) => {
    if (route.request().url().includes("alertsOnly=1")) {
      await route.abort("failed");
      return;
    }
    await route.continue();
  });

  await page.goto(new URL("/dashboard", baseUrl).toString(), { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.locator(".dashboard-kpi-grid").first().waitFor({ state: "visible", timeout: 35000 });
  await sleep(settleMs);

  const findings = await page.evaluate(() => {
    const failures = [];
    const body = document.querySelector(".dashboard-operator-body");
    if (!body) failures.push("missing-dashboard-operator-body");

    const warningBanners = body
      ? Array.from(body.querySelectorAll(".ops-feedback-banner--warning")).filter((node) => {
          const text = node.textContent ?? "";
          return /peringatan|alert/i.test(text);
        })
      : [];
    if (warningBanners.length > 0) failures.push("warning-banner-in-dashboard-body");

    if (document.querySelector(".dashboard-tabs")) failures.push("dashboard-tabs-present");

    const toast = document.querySelector(".ops-toast-host .ops-toast");
    if (toast) failures.push("visible-ops-toast");

    return failures;
  });

  await page.screenshot({ path: path.join(outputDir, "dashboard-calm.png"), fullPage: false });

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    settleMs,
    findings,
    verdict: findings.length === 0 ? "PASS" : "FAIL",
  };

  await writeFile(path.join(outputDir, "dashboard-calm-report.json"), JSON.stringify(report, null, 2));
  await browser.close();

  if (findings.length) {
    console.error("Dashboard calm check FAILED:");
    for (const finding of findings) {
      console.error(`  ${finding}`);
    }
    process.exit(1);
  }

  console.log("Dashboard calm check: ALL_PASS");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});