import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
const loginEmail = process.env.QA_LOGIN_EMAIL ?? "staff@skyhub.test";
const loginPassword = process.env.QA_LOGIN_PASSWORD ?? "operator123";
const resultsPath =
  process.env.QA_RERUN_FROM ??
  path.join(process.cwd(), "output", "visual-qa", "20260608-120716", "results.json");

const viewportsByName = {
  wide: { width: 1920, height: 1080 },
  desktop: { width: 1536, height: 864 },
  laptop: { width: 1366, height: 768 },
  tablet: { width: 1024, height: 1366 },
  mobile: { width: 390, height: 844 },
  "small-mobile": { width: 360, height: 740 },
  "print-letter": { width: 816, height: 1056 },
};

const scenarioMeta = {
  "screen-light": { media: "screen", colorScheme: "light", overflowTolerance: 2 },
  "screen-dark": { media: "screen", colorScheme: "dark", overflowTolerance: 2 },
  "print-light": { media: "print", colorScheme: "light", overflowTolerance: 48 },
};

function routeUrl(route) {
  return new URL(route, baseUrl).toString();
}

async function primeIntroCookie(page) {
  const response = await page.request.post(routeUrl("/api/auth/intro"), { maxRedirects: 0 });
  if (![200, 303].includes(response.status())) {
    throw new Error(`Intro gate failed with status ${response.status()}`);
  }
}

async function login(page, colorScheme) {
  await primeIntroCookie(page);
  await page.goto(routeUrl("/login"), { waitUntil: "domcontentloaded" });
  await page.emulateMedia({ media: "screen", colorScheme });
  await page.evaluate((theme) => {
    window.localStorage.setItem("theme", theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.classList.toggle("light", theme === "light");
  }, colorScheme);
  await page.fill('input[type="email"]', loginEmail);
  await page.fill('input[type="password"], input[type="text"]', loginPassword);
  await Promise.all([
    page.waitForURL("**/dashboard", { timeout: 20000 }),
    page.locator('form button[type="submit"]').first().click(),
  ]);
  await page.locator(".dashboard-summary-strip a").first().waitFor({ timeout: 20000 });
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
    return Math.max(0, Math.ceil(scrollWidth - root.clientWidth));
  });
}

function getOverflowTolerance(meta, route, viewportWidth) {
  if (route.split("?")[0].startsWith("/exports/")) {
    return Math.max(meta.overflowTolerance, viewportWidth * 2);
  }
  return meta.overflowTolerance;
}

async function captureFailure(page, entry, meta, viewportWidth) {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (attempt > 1) await page.waitForTimeout(1500 * attempt);
    await page.goto(routeUrl(entry.route), { waitUntil: "domcontentloaded" });
    await page.emulateMedia({ media: meta.media, colorScheme: meta.colorScheme });
    await page.evaluate((theme) => {
      window.localStorage.setItem("theme", theme);
      document.documentElement.classList.toggle("dark", theme === "dark");
      document.documentElement.classList.toggle("light", theme === "light");
    }, meta.colorScheme);
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => null);
    await page.locator("table.print-table").first().waitFor({ state: "attached", timeout: 30000 }).catch(() => null);
    await page.waitForTimeout(1200);

    const hasError = await page.locator('text=Sistem sedang bermasalah').isVisible().catch(() => false);
    const tableCount = await page.locator("table.print-table").count();
    if (!hasError && tableCount > 0) break;
  }

  await setZoom(page, entry.zoom);
  await page.waitForTimeout(400);

  const missingSelectors = [];
  if (await page.locator('text=Sistem sedang bermasalah').isVisible().catch(() => false)) {
    missingSelectors.push("app-error");
  } else if ((await page.locator("table.print-table").count()) === 0) {
    missingSelectors.push("table.print-table");
  }

  const horizontalOverflow = await getHorizontalOverflow(page);
  const overflowTolerance = getOverflowTolerance(meta, entry.route, viewportWidth);
  const hasFail = missingSelectors.length > 0 || horizontalOverflow > overflowTolerance;

  await page.screenshot({ path: entry.screenshot, fullPage: true });

  return {
    ...entry,
    missingSelectors,
    horizontalOverflow,
    overflowTolerance,
    status: hasFail ? "fail" : "pass",
    rerunAt: new Date().toISOString(),
  };
}

async function run() {
  const raw = await readFile(resultsPath, "utf8");
  const results = JSON.parse(raw);
  const failures = results.filter((entry) => entry.status === "fail");

  if (!failures.length) {
    console.log(JSON.stringify({ message: "No failures to rerun.", resultsPath }, null, 2));
    return;
  }

  const browser = await chromium.launch({ headless: true });
  const updated = new Map();
  const groups = new Map();

  for (const entry of failures) {
    const key = `${entry.scenario}::${entry.viewport}::${entry.route}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }

  try {
    for (const [groupKey, entries] of groups) {
      const [scenarioName, viewportName, route] = groupKey.split("::");
      const viewport = viewportsByName[viewportName];
      const meta = scenarioMeta[scenarioName];
      if (!viewport || !meta) {
        throw new Error(`Unknown group ${groupKey}`);
      }

      const context = await browser.newContext({
        viewport,
        deviceScaleFactor: 1,
        colorScheme: meta.colorScheme,
      });
      await context.addInitScript((theme) => {
        window.localStorage.setItem("theme", theme);
        document.documentElement.classList.add(theme);
      }, meta.colorScheme);

      const page = await context.newPage();
      const needsAuth = route.startsWith("/exports/") || !["/about-us", "/login"].includes(route);
      if (needsAuth) {
        await login(page, meta.colorScheme);
      }

      for (const entry of entries) {
        const next = await captureFailure(page, entry, meta, viewport.width);
        updated.set(`${entry.scenario}::${entry.viewport}::${entry.route}::${entry.zoom}`, next);
      }

      await context.close();
    }
  } finally {
    await browser.close();
  }

  const merged = results.map((entry) => {
    const key = `${entry.scenario}::${entry.viewport}::${entry.route}::${entry.zoom}`;
    return updated.get(key) ?? entry;
  });

  await writeFile(resultsPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");

  const remainingFailures = merged.filter((entry) => entry.status === "fail");
  console.log(
    JSON.stringify(
      {
        resultsPath,
        rerun: failures.length,
        fixed: failures.length - remainingFailures.length,
        remainingFailures: remainingFailures.length,
      },
      null,
      2,
    ),
  );

  if (remainingFailures.length > 0) process.exit(1);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});