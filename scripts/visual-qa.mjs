import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
const loginEmail = process.env.QA_LOGIN_EMAIL ?? "staff@skyhub.test";
const loginPassword = process.env.QA_LOGIN_PASSWORD ?? "operator123";
const visualAwbOverride = process.env.QA_VISUAL_AWB;

const zoomLevels = [50, 67, 80, 90, 100, 110, 125, 150, 175, 200];
const viewports = [
  { name: "wide", width: 1920, height: 1080 },
  { name: "desktop", width: 1536, height: 864 },
  { name: "laptop", width: 1366, height: 768 },
  { name: "tablet", width: 1024, height: 1366 },
  { name: "mobile", width: 390, height: 844 },
  { name: "small-mobile", width: 360, height: 740 },
];

const printViewports = [
  { name: "print-letter", width: 816, height: 1056 },
];

const protectedRoutes = [
  "/dashboard",
  "/shipment-ledger",
  "/awb-tracking",
  "/flight-board",
  "/alerts",
  "/activity-log",
  "/complaints",
  "/settings",
  "/exports/flights",
  "/exports/shipments",
  "/exports/activity-log",
];

const printRoutes = [
  "/exports/shipments",
  "/exports/flights",
  "/exports/activity-log",
];

const scenarios = [
  {
    name: "screen-light",
    media: "screen",
    colorScheme: "light",
    viewports,
    zooms: zoomLevels,
    capturePublic: true,
    authenticatedRoutes: protectedRoutes,
    overflowTolerance: 2,
  },
  {
    name: "screen-dark",
    media: "screen",
    colorScheme: "dark",
    viewports,
    zooms: [100],
    capturePublic: true,
    authenticatedRoutes: protectedRoutes,
    overflowTolerance: 2,
  },
  {
    name: "print-light",
    media: "print",
    colorScheme: "light",
    viewports: printViewports,
    zooms: [100],
    capturePublic: false,
    authenticatedRoutes: printRoutes,
    overflowTolerance: 48,
  },
];

const routeApiWaits = {
  "/dashboard": "/api/dashboard",
  "/shipment-ledger": "/api/shipments",
  "/flight-board": "/api/flights",
  "/alerts": "/api/alerts",
  "/activity-log": "/api/activity-log",
  "/complaints": "/api/complaints",
  "/settings": "/api/settings",
  "/awb-tracking": null,
  "/exports/flights": "/api/flights",
  "/exports/shipments": "/api/shipments",
  "/exports/activity-log": "/api/activity-log",
  "/exports/awb": null,
};

const routeContentWaits = {
  "/dashboard": ".dashboard-summary-strip a",
  "/shipment-ledger": 'h2:has-text("Manifest aktif")',
  "/settings": 'button:has-text("Profil")',
  "/flight-board": "table tbody tr, .ops-empty, p:has-text('Halaman')",
  "/alerts": "table tbody tr, .ops-empty, p:has-text('Halaman')",
  "/activity-log": "table tbody tr, .ops-empty",
  "/complaints": ".ops-empty, table tbody tr",
  "/exports/flights": "table.print-table",
  "/exports/shipments": "table.print-table",
  "/exports/activity-log": "table.print-table",
  "/exports/awb": "table.print-table",
};

const requiredSelectors = {
  "/about-us": ['button:has-text("MASUK")', "h1"],
  "/login": ['form button[type="submit"]', 'input[type="email"]', 'input[type="password"], input[type="text"]'],
  "/dashboard": [".dashboard-summary-strip a"],
  "/shipment-ledger": ["h1"],
  "/awb-tracking": ["#awb-tracking-input"],
  "/flight-board": ["h1"],
  "/alerts": ["h1"],
  "/activity-log": ["h1"],
  "/complaints": ["h1"],
  "/settings": ["h1"],
  "/exports/flights": ["table.print-table"],
  "/exports/shipments": ["table.print-table"],
  "/exports/activity-log": ["table.print-table"],
  "/exports/awb": ["table.print-table"],
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
  return route.replace(/[/?=&]+/g, "_").replace(/^_/, "").replace(/_$/, "");
}

function routeKey(route) {
  return route.split("?")[0];
}

function routeUrl(route) {
  return new URL(route, baseUrl).toString();
}

function getOverflowTolerance(scenario, route, viewportWidth) {
  if (routeKey(route).startsWith("/exports/")) {
    // Print manifests use wide tables; horizontal scroll is expected on narrow/zoomed screens.
    return Math.max(scenario.overflowTolerance, viewportWidth * 2);
  }
  return scenario.overflowTolerance;
}

async function hasAppError(page) {
  return page.locator('text=Sistem sedang bermasalah').isVisible().catch(() => false);
}

async function ensureVisibleSelectors(page, route) {
  const key = routeKey(route);
  const selectors = requiredSelectors[key] ?? ["main"];
  const missing = [];

  if (await hasAppError(page)) {
    missing.push("app-error");
    return missing;
  }

  for (const selector of selectors) {
    if (selector === "h1") {
      const count = await page.locator("h1").count();
      if (count === 0) missing.push("h1");
      continue;
    }

    if (key.startsWith("/exports/")) {
      const count = await page.locator(selector).count();
      if (count === 0) missing.push(selector);
      continue;
    }

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

async function applyScenario(page, scenario) {
  await page.emulateMedia({ media: scenario.media, colorScheme: scenario.colorScheme });
  await page.evaluate((theme) => {
    window.localStorage.setItem("theme", theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.classList.toggle("light", theme === "light");
  }, scenario.colorScheme);
}

const skeletonGoneRoutes = new Set([
  "/dashboard",
  "/shipment-ledger",
  "/flight-board",
  "/alerts",
  "/settings",
]);

async function waitForSkeletonGone(page, route) {
  const key = routeKey(route);
  if (!skeletonGoneRoutes.has(key)) return;

  await page
    .waitForFunction(
      () => {
        const loadingLabels = document.querySelectorAll('[aria-label*="Memuat"]');
        if (loadingLabels.length > 0) return false;
        const skeletons = document.querySelectorAll(".ops-skeleton, [aria-label*='Memuat dasbor'], [aria-label*='Memuat daftar'], [aria-label*='Memuat detail']");
        return skeletons.length === 0;
      },
      { timeout: 25000 },
    )
    .catch(() => null);
}

async function waitForRouteReady(page, route) {
  const key = routeKey(route);
  const apiPath = routeApiWaits[key];
  const contentSelector = routeContentWaits[key];

  if (apiPath) {
    await page
      .waitForResponse((response) => response.url().includes(apiPath) && response.ok(), { timeout: 30000 })
      .catch(() => null);
  }

  if (contentSelector) {
    await page.locator(contentSelector).first().waitFor({ state: "visible", timeout: 30000 }).catch(() => null);
  }

  if (key.startsWith("/exports/")) {
    await page.locator("table.print-table").first().waitFor({ state: "attached", timeout: 30000 }).catch(() => null);
    await page.locator("table.print-table tbody tr").first().waitFor({ state: "attached", timeout: 30000 }).catch(() => null);
  }

  await waitForSkeletonGone(page, route);
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => null);
  await page.waitForTimeout(900);
}

const ROUTE_CAPTURE_MAX_ATTEMPTS = 3;

async function isRouteContentReady(page, route) {
  if (await hasAppError(page)) return false;

  const key = routeKey(route);
  if (key.startsWith("/exports/")) {
    return (await page.locator("table.print-table").count()) > 0;
  }

  const contentSelector = routeContentWaits[key];
  if (!contentSelector) return true;
  return page.locator(contentSelector).first().isVisible().catch(() => false);
}

async function navigateAndPrepare(page, route, scenario) {
  const apiPath = routeApiWaits[routeKey(route)];
  const navigation = page.goto(routeUrl(route), { waitUntil: "domcontentloaded" });
  const apiWait = apiPath
    ? page
        .waitForResponse((response) => response.url().includes(apiPath) && response.ok(), { timeout: 30000 })
        .catch(() => null)
    : Promise.resolve(null);

  await Promise.all([navigation, apiWait]);
  await applyScenario(page, scenario);
  await waitForRouteReady(page, route);
}

async function captureRoute(page, outputDir, route, viewportName, scenario, results, viewportWidth = 1920) {
  for (let attempt = 1; attempt <= ROUTE_CAPTURE_MAX_ATTEMPTS; attempt += 1) {
    if (attempt > 1) {
      await page.waitForTimeout(1200 * attempt);
    }
    await navigateAndPrepare(page, route, scenario);
    if (await isRouteContentReady(page, route)) break;
  }

  for (const zoom of scenario.zooms) {
    await setZoom(page, zoom);
    await applyScenario(page, scenario);
    await page.waitForTimeout(280);

    const missingSelectors = await ensureVisibleSelectors(page, route);
    const horizontalOverflow = await getHorizontalOverflow(page);
    const overflowTolerance = getOverflowTolerance(scenario, route, viewportWidth);
    const hasError = missingSelectors.length > 0 || horizontalOverflow > overflowTolerance;

    const fileName = `${scenario.name}__${viewportName}__${routeSlug(route)}__z${zoom}.png`;
    const screenshotPath = path.join(outputDir, fileName);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    results.push({
      scenario: scenario.name,
      media: scenario.media,
      colorScheme: scenario.colorScheme,
      viewport: viewportName,
      route,
      zoom,
      screenshot: screenshotPath,
      missingSelectors,
      horizontalOverflow,
      overflowTolerance,
      status: hasError ? "fail" : "pass",
    });
  }
}

async function primeIntroCookie(page) {
  const response = await page.request.post(routeUrl("/api/auth/intro"), {
    maxRedirects: 0,
  });

  if (![200, 303].includes(response.status())) {
    throw new Error(`Intro gate failed with status ${response.status()}`);
  }
}

async function login(page, scenario) {
  await primeIntroCookie(page);
  await page.goto(routeUrl("/login"), { waitUntil: "domcontentloaded" });
  await applyScenario(page, scenario);
  await page.fill('input[type="email"]', loginEmail);
  await page.fill('input[type="password"], input[type="text"]', loginPassword);

  await Promise.all([
    page.waitForURL("**/dashboard", { timeout: 20000 }),
    page.locator('form button[type="submit"]').first().click(),
  ]);
  await page.locator(".dashboard-summary-strip a").first().waitFor({ timeout: 20000 });
}

async function resolveVisualAwb(page) {
  if (visualAwbOverride) {
    return visualAwbOverride;
  }

  const response = await page.request.get(routeUrl("/api/shipments"));
  if (!response.ok()) {
    throw new Error(`Unable to resolve visual AWB: /api/shipments returned ${response.status()}`);
  }

  const payload = await response.json();
  const awb = payload.shipments?.find((shipment) => shipment?.awb)?.awb;
  if (!awb) {
    throw new Error("Unable to resolve visual AWB: no active shipments returned by /api/shipments.");
  }

  return awb;
}

async function run() {
  const runId = nowStamp();
  const outputDir = path.join(process.cwd(), "output", "visual-qa", runId);
  await mkdir(outputDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const results = [];

  try {
    for (const scenario of scenarios) {
      for (const viewport of scenario.viewports) {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          deviceScaleFactor: 1,
          colorScheme: scenario.colorScheme,
        });
        await context.addInitScript((theme) => {
          window.localStorage.setItem("theme", theme);
          document.documentElement.classList.add(theme);
        }, scenario.colorScheme);

        const page = await context.newPage();
        await page.emulateMedia({ media: scenario.media, colorScheme: scenario.colorScheme });

        if (scenario.capturePublic) {
          await captureRoute(page, outputDir, "/about-us", viewport.name, scenario, results, viewport.width);
          await primeIntroCookie(page);
          await captureRoute(page, outputDir, "/login", viewport.name, scenario, results, viewport.width);
        }

        await login(page, scenario);
        const visualAwb = await resolveVisualAwb(page);
        const awbExportRoute = `/exports/awb?awb=${encodeURIComponent(visualAwb)}`;
        const authenticatedRoutes = [...scenario.authenticatedRoutes, awbExportRoute];

        for (const route of authenticatedRoutes) {
          await captureRoute(page, outputDir, route, viewport.name, scenario, results, viewport.width);
        }

        await context.close();
      }
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
