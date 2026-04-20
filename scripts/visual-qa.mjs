import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
const loginEmail = process.env.QA_LOGIN_EMAIL ?? "staff@skyhub.test";
const loginPassword = process.env.QA_LOGIN_PASSWORD ?? "operator123";

const zoomLevels = [50, 67, 80, 90, 100, 110, 125, 150, 175, 200];
const viewports = [
  { name: "desktop", width: 1536, height: 864 },
  { name: "tablet", width: 1024, height: 1366 },
  { name: "mobile", width: 390, height: 844 },
];

const protectedRoutes = [
  "/dashboard",
  "/shipment-ledger",
  "/awb-tracking",
  "/flight-board",
  "/activity-log",
  "/reports",
  "/settings",
  "/exports/shipments",
  "/exports/activity-log",
];

const requiredSelectors = {
  "/about-us": ['form[action="/api/auth/intro"] button[type="submit"]'],
  "/login": ['form button[type="submit"]', 'input[type="email"]', 'input[type="password"], input[type="text"]'],
  "/dashboard": ["h1"],
  "/shipment-ledger": ["h1"],
  "/awb-tracking": ["h1", 'input[placeholder*="160-12345678"]'],
  "/flight-board": ["h1"],
  "/activity-log": ["h1"],
  "/reports": ["h1"],
  "/settings": ["h1"],
  "/exports/shipments": ["table"],
  "/exports/activity-log": ["table"],
};

function nowStamp() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${y}${m}${day}-${hh}${mm}${ss}`;
}

function routeSlug(route) {
  if (route === "/") return "root";
  return route.replace(/\//g, "_").replace(/^_/, "");
}

async function ensureVisibleSelectors(page, route) {
  const selectors = requiredSelectors[route] ?? ["main"];
  const missing = [];

  for (const selector of selectors) {
    const visible = await page.locator(selector).first().isVisible().catch(() => false);
    if (!visible) {
      missing.push(selector);
    }
  }

  return missing;
}

async function setZoom(page, zoom) {
  await page.evaluate((nextZoom) => {
    const value = `${nextZoom}%`;
    document.documentElement.style.zoom = value;
    document.documentElement.style.transformOrigin = "top left";
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, zoom);
}

async function getHorizontalOverflow(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    const scrollWidth = Math.max(root.scrollWidth, body.scrollWidth);
    const rawOverflow = scrollWidth - root.clientWidth;
    const zoomValue = root.style.zoom || getComputedStyle(root).zoom || "1";
    const parsedZoom = typeof zoomValue === "string" && zoomValue.endsWith("%")
      ? Number.parseFloat(zoomValue) / 100
      : Number.parseFloat(String(zoomValue));

    if (Number.isFinite(parsedZoom) && parsedZoom > 0 && parsedZoom < 1) {
      const normalizedOverflow = scrollWidth * parsedZoom - root.clientWidth;
      return Math.max(0, Math.ceil(normalizedOverflow));
    }

    return Math.max(0, Math.ceil(rawOverflow));
  });
}

async function captureRoute(page, outputDir, route, viewportName, results) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(220);

  for (const zoom of zoomLevels) {
    await setZoom(page, zoom);
    await page.waitForTimeout(180);

    const missingSelectors = await ensureVisibleSelectors(page, route);
    const horizontalOverflow = await getHorizontalOverflow(page);
    const hasError = missingSelectors.length > 0 || horizontalOverflow > 2;

    const fileName = `${viewportName}__${routeSlug(route)}__z${zoom}.png`;
    const screenshotPath = path.join(outputDir, fileName);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    results.push({
      viewport: viewportName,
      route,
      zoom,
      screenshot: screenshotPath,
      missingSelectors,
      horizontalOverflow,
      status: hasError ? "fail" : "pass",
    });
  }
}

async function loginFromAbout(page) {
  await page.goto(`${baseUrl}/about-us`, { waitUntil: "domcontentloaded" });
  await Promise.all([
    page.waitForURL("**/login", { timeout: 30000, waitUntil: "domcontentloaded" }),
    page.locator('form[action="/api/auth/intro"] button[type="submit"]').first().click(),
  ]);

  await page.fill('input[type="email"]', loginEmail);
  await page.fill('input[type="password"], input[type="text"]', loginPassword);

  await Promise.all([
    page.waitForURL("**/dashboard", { timeout: 20000 }),
    page.locator('form button[type="submit"]').first().click(),
  ]);
  await page.locator("h1").first().waitFor({ timeout: 15000 });
}

async function run() {
  const runId = nowStamp();
  const outputDir = path.join(process.cwd(), "output", "visual-qa", runId);
  await mkdir(outputDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const results = [];

  try {
    for (const viewport of viewports) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 1,
      });
      const page = await context.newPage();

      await captureRoute(page, outputDir, "/about-us", viewport.name, results);

  await page.goto(`${baseUrl}/about-us`, { waitUntil: "domcontentloaded" });
  await Promise.all([
    page.waitForURL("**/login", { timeout: 30000, waitUntil: "domcontentloaded" }),
    page.locator('form[action="/api/auth/intro"] button[type="submit"]').first().click(),
  ]);
      await captureRoute(page, outputDir, "/login", viewport.name, results);

      await loginFromAbout(page);

      for (const route of protectedRoutes) {
        await captureRoute(page, outputDir, route, viewport.name, results);
      }

      await context.close();
    }
  } finally {
    await browser.close();
  }

  const outputJsonPath = path.join(outputDir, "results.json");
  await writeFile(outputJsonPath, `${JSON.stringify(results, null, 2)}\n`, "utf8");

  const failures = results.filter((entry) => entry.status === "fail");
  const summary = {
    runId,
    baseUrl,
    screenshots: results.length,
    failures: failures.length,
    outputDir,
    outputJsonPath,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (failures.length > 0) {
    console.error("Visual QA found failures.");
    process.exit(1);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
