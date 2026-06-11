import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { waitForServer } from "./qa-throttle.mjs";

const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3100";
const password = process.env.QA_LOGIN_PASSWORD ?? "operator123";
const email = process.env.QA_LOGIN_EMAIL ?? "staff@skyhub.test";
const outputDir = path.join(process.cwd(), ".qa", "feedback-ui");

async function loginStaff(page) {
  await page.request.post(new URL("/api/auth/intro", baseUrl).toString());
  const response = await page.request.post(new URL("/api/auth/login", baseUrl).toString(), {
    data: { email, password, remember: false },
  });
  if (!response.ok()) throw new Error(`Login failed: ${response.status()}`);
}

async function captureLoginError(page) {
  await page.goto(new URL("/login", baseUrl).toString(), { waitUntil: "networkidle" });
  const passwordInput = page.locator('input[autocomplete="current-password"]');
  await page.locator('input[type="email"]').fill(email);
  await passwordInput.fill("");
  await passwordInput.fill("wrong-password-qa");
  await page.locator('form button[type="submit"]').click();
  await page.waitForResponse(
    (response) => response.url().includes("/api/auth/login") && response.request().method() === "POST",
    { timeout: 15000 },
  );
  await page.locator("form").getByRole("alert").waitFor({ state: "visible", timeout: 15000 });
  await page.screenshot({ path: path.join(outputDir, "login-error-solid.png"), fullPage: true });
}

async function captureDashboardCalmSummary(page) {
  await loginStaff(page);
  await page.route("**/api/dashboard**", async (route) => {
    if (route.request().url().includes("alertsOnly=1")) {
      await route.abort("failed");
      return;
    }
    await route.continue();
  });
  await page.goto(new URL("/dashboard", baseUrl).toString(), { waitUntil: "domcontentloaded" });
  await page.locator(".dashboard-kpi-grid").first().waitFor({ state: "visible", timeout: 35000 });
  await page.waitForTimeout(3500);

  const warningVisible = await page
    .locator(".dashboard-operator-body .ops-feedback-banner--warning")
    .filter({ hasText: /peringatan/i })
    .first()
    .isVisible()
    .catch(() => false);
  const toastVisible = await page.locator(".ops-toast-host .ops-toast").isVisible().catch(() => false);
  if (warningVisible || toastVisible) {
    throw new Error("Dashboard calm regression: warning banner or toast visible after alerts fetch failure");
  }

  await page.screenshot({ path: path.join(outputDir, "dashboard-calm-summary.png"), fullPage: false });
}

async function captureDashboardLoadFailure(page) {
  const context = await page.context().browser().newContext({ viewport: { width: 1440, height: 900 } });
  const failurePage = await context.newPage();
  await failurePage.request.post(new URL("/api/auth/intro", baseUrl).toString());
  const response = await failurePage.request.post(new URL("/api/auth/login", baseUrl).toString(), {
    data: { email, password, remember: false },
  });
  if (!response.ok()) throw new Error(`Login failed: ${response.status()}`);
  await failurePage.route("**/api/dashboard**", (route) => route.abort("failed"));
  await failurePage.goto(new URL("/dashboard", baseUrl).toString(), { waitUntil: "domcontentloaded" });
  await failurePage.locator(".ops-feedback-banner--error").waitFor({ state: "visible", timeout: 35000 });
  await failurePage.screenshot({ path: path.join(outputDir, "dashboard-kpi-error-banner.png"), fullPage: false });
  await context.close();
}

async function captureConfirmDialog(page) {
  await loginStaff(page);
  await page.goto(new URL("/shipment-ledger", baseUrl).toString(), { waitUntil: "domcontentloaded" });
  await page.waitForSelector("main.ops-shell-main-scroll", { timeout: 30000 });
  const firstRow = page.locator(".ledger-manifest-table-row").first();
  const hasRow = await firstRow.isVisible({ timeout: 20000 }).catch(() => false);
  if (!hasRow) {
    console.warn("Skipping confirm dialog screenshot: no shipment rows in ledger.");
    return;
  }
  await firstRow.click();
  const deleteButton = page.getByRole("button", { name: /^Hapus$/i }).first();
  const canDelete = await deleteButton.isVisible({ timeout: 15000 }).catch(() => false);
  if (!canDelete) {
    console.warn("Skipping confirm dialog screenshot: delete action not available for current user.");
    return;
  }
  await deleteButton.click();
  await page.getByRole("alertdialog").waitFor({ state: "visible", timeout: 10000 });
  await page.screenshot({ path: path.join(outputDir, "confirm-dialog-solid.png"), fullPage: false });
  await page.keyboard.press("Escape");
}

async function captureComplaintEscalationBox(page) {
  const context = await page.context().browser().newContext({ viewport: { width: 1440, height: 900 } });
  const complaintsPage = await context.newPage();
  await complaintsPage.request.post(new URL("/api/auth/intro", baseUrl).toString());
  const response = await complaintsPage.request.post(new URL("/api/auth/login", baseUrl).toString(), {
    data: { email, password, remember: false },
  });
  if (!response.ok()) throw new Error(`Login failed: ${response.status()}`);

  await complaintsPage.goto(new URL("/complaints?status=escalated", baseUrl).toString(), {
    waitUntil: "domcontentloaded",
  });
  await complaintsPage.waitForSelector("main.ops-shell-main-scroll", { timeout: 30000 });
  const ticket = complaintsPage.locator("[data-complaint-card]").first();
  const hasTicket = await ticket.isVisible().catch(() => false);
  if (!hasTicket) {
    console.warn("Skipping complaint escalation screenshot: no escalated ticket in seed data.");
    await context.close();
    return;
  }
  await ticket.click();
  await complaintsPage.getByText("Alasan eskalasi:").waitFor({ state: "visible", timeout: 10000 });
  await complaintsPage.screenshot({ path: path.join(outputDir, "complaint-escalation-solid.png"), fullPage: false });
  await context.close();
}

async function run() {
  await waitForServer(baseUrl);
  await mkdir(outputDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const captures = [
    ["login", () => captureLoginError(page)],
    ["dashboard calm", () => captureDashboardCalmSummary(page)],
    ["dashboard kpi failure", () => captureDashboardLoadFailure(page)],
    ["confirm dialog", () => captureConfirmDialog(page)],
    ["complaint escalation", () => captureComplaintEscalationBox(page)],
  ];

  for (const [label, capture] of captures) {
    try {
      await capture();
    } catch (error) {
      console.warn(`Screenshot skipped (${label}): ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  await browser.close();
  console.log(`Feedback UI screenshots saved to ${outputDir}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});