import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { sleep, waitForServer, withThrottle } from "./qa-throttle.mjs";

const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3100";
const password = process.env.QA_LOGIN_PASSWORD ?? "operator123";
const email = process.env.QA_LOGIN_EMAIL ?? "staff@skyhub.test";
const adminEmail = process.env.QA_ADMIN_EMAIL ?? "admin@skyhub.test";

const STRICT = process.argv.includes("--strict");
const MOBILE = process.argv.includes("--mobile") || STRICT;

const VIEWPORTS = [
  { id: "desktop", width: 1440, height: 900 },
  ...(MOBILE ? [{ id: "mobile", width: 375, height: 812 }] : []),
];

const STAFF_ROUTES = [
  "/dashboard",
  "/shipment-ledger",
  "/awb-tracking",
  "/flight-board",
  "/alerts",
  "/activity-log",
  "/complaints",
  "/settings",
];

const PUBLIC_ROUTES = ["/login"];

const ADMIN_ROUTES = ["/query", "/seed"];

const DRAWER_SCROLL_ALLOW = ".ops-drawer-body, .ops-drawer-form-readable, [class*='drawer-scroll'], [class*='detail-scroll']";

function parseRoutes() {
  const routeIdx = process.argv.indexOf("--route");
  if (routeIdx >= 0 && process.argv[routeIdx + 1]) {
    return { staff: [process.argv[routeIdx + 1]], public: [], admin: [] };
  }
  return { staff: STAFF_ROUTES, public: PUBLIC_ROUTES, admin: ADMIN_ROUTES };
}

async function loginStaff(page, asAdmin = false) {
  await withThrottle(async () => {
    await page.request.post(new URL("/api/auth/intro", baseUrl).toString());
    const response = await page.request.post(new URL("/api/auth/login", baseUrl).toString(), {
      data: { email: asAdmin ? adminEmail : email, password, remember: false },
    });
    if (!response.ok()) {
      throw new Error(`Login failed: ${response.status()}`);
    }
  });

  await page.goto(new URL("/dashboard", baseUrl).toString(), { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);
}

async function checkViewport(page, route, strict) {
  return page.evaluate(
    ({ routePath, strictMode, drawerAllow }) => {
      const root = document.documentElement;
      const pageScroll = root.scrollHeight - window.innerHeight;

      function visible(el) {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
      }

      const toolbar = document.querySelector(".page-action-toolbar, .shell-topbar-toolbar");
      const filter = document.querySelector(".ops-filter-strip, .shell-filter-strip");
      const pagination = document.querySelector(".table-pagination-footer, .pagination-bar");
      const firstRow = document.querySelector("table tbody tr, .data-table tbody tr, .ledger-manifest-table tbody tr");
      const locked = document.querySelector(".ops-locked-page");

      const internalScrollers = [];
      if (strictMode && locked) {
        const nodes = locked.querySelectorAll("*");
        for (const node of nodes) {
          if (!(node instanceof HTMLElement)) continue;
          if (node.matches(drawerAllow) || node.closest(drawerAllow)) continue;
          if (node.scrollHeight > node.clientHeight + 2 && node.clientHeight > 0) {
            const style = getComputedStyle(node);
            if (style.overflowY === "auto" || style.overflowY === "scroll") {
              internalScrollers.push(node.className.split(" ")[0] || node.tagName);
            }
          }
        }
      }

      const needsFilter = [
        "/shipment-ledger",
        "/flight-board",
        "/alerts",
        "/activity-log",
        "/complaints",
        "/awb-tracking",
      ].includes(routePath);

      return {
        pageScrollPx: Math.max(0, Math.ceil(pageScroll)),
        toolbarVisible: visible(toolbar) || routePath === "/settings" || routePath === "/login",
        filterVisible: visible(filter) || !needsFilter,
        paginationVisible: visible(pagination) || !pagination,
        firstRowVisible: visible(firstRow) || !firstRow,
        lockedPresent: Boolean(locked) || routePath === "/login",
        internalScrollers: [...new Set(internalScrollers)].slice(0, 5),
      };
    },
    { routePath: route, strictMode: strict, drawerAllow: DRAWER_SCROLL_ALLOW },
  );
}

async function auditSettingsTimAkses(page, outputDir, viewportId) {
  const route = "/settings";
  const url = new URL(route, baseUrl).toString();
  const started = Date.now();

  await withThrottle(async () => {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  });
  await page.waitForTimeout(2000);
  try {
    await page.waitForSelector(".settings-users-panel, button:has-text('Tim & Akses')", { timeout: 12000 });
  } catch {
    // Fall through; metrics will record missing panel/rows.
  }

  const timTab = page.locator("button").filter({ hasText: "Tim & Akses" });
  if (await timTab.count()) {
    await timTab.first().click();
    await page.waitForTimeout(1500);
    await page.waitForSelector(".settings-users-table-scroll tbody tr", { timeout: 12000 }).catch(() => null);
  }

  const metrics = await page.evaluate(() => {
    const rows = document.querySelectorAll(".settings-users-table-scroll tbody tr");
    const panel = document.querySelector(".settings-users-panel");
    const pagination = document.querySelector(".settings-users-pagination .table-pagination-footer");
    const lastRow = rows[rows.length - 1];
    const panelRect = panel?.getBoundingClientRect();
    const lastRowRect = lastRow?.getBoundingClientRect();
    const deadSpacePx =
      panelRect && lastRowRect ? Math.max(0, Math.round(panelRect.bottom - lastRowRect.bottom)) : 999;

    return {
      rowCount: rows.length,
      deadSpacePx,
      paginationVisible: Boolean(pagination),
    };
  });

  const slug = `${viewportId}__settings_tim_akses`;
  const screenshot = path.join(outputDir, `${slug}.png`);
  await page.screenshot({ path: screenshot, fullPage: false });

  const failures = [];
  if (metrics.rowCount < 6) failures.push(`too-few-rows:${metrics.rowCount}`);
  if (metrics.deadSpacePx > 140) failures.push(`dead-space:${metrics.deadSpacePx}px`);
  if (!metrics.paginationVisible) failures.push("pagination-missing");

  return {
    route: `${route}#tim-akses`,
    viewport: viewportId,
    status: failures.length ? "fail" : "pass",
    durationMs: Date.now() - started,
    metrics,
    failures,
    screenshot,
  };
}

async function auditRoute(page, route, outputDir, viewportId) {
  const url = new URL(route, baseUrl).toString();
  const started = Date.now();

  await withThrottle(async () => {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  });

  await page.waitForTimeout(1200);
  if (route !== "/login") {
    try {
      await page.waitForSelector(".ops-locked-page", { timeout: 8000 });
    } catch {
      // Fall through; checkViewport records missing-ops-locked-page in strict mode.
    }
  }

  const metrics = await checkViewport(page, route, STRICT);
  const slug = `${viewportId}__${route.replace(/\//g, "_").replace(/^_/, "") || "root"}`;
  const screenshot = path.join(outputDir, `${slug}.png`);
  await page.screenshot({ path: screenshot, fullPage: false });

  const failures = [];
  if (metrics.pageScrollPx > 4) {
    failures.push(`page-scroll:${metrics.pageScrollPx}px`);
  }
  if (!metrics.toolbarVisible && !["/settings", "/login", "/seed"].includes(route)) {
    failures.push("toolbar-clipped");
  }
  if (!metrics.filterVisible) {
    failures.push("filter-clipped");
  }
  if (
    !metrics.paginationVisible &&
    ["/shipment-ledger", "/flight-board", "/alerts", "/activity-log", "/complaints", "/settings", "/query"].includes(route)
  ) {
    failures.push("pagination-clipped");
  }
  if (STRICT && metrics.internalScrollers.length) {
    failures.push(`internal-scroll:${metrics.internalScrollers.join(",")}`);
  }
  if (STRICT && !metrics.lockedPresent && route !== "/login") {
    failures.push("missing-ops-locked-page");
  }

  return {
    route,
    viewport: viewportId,
    status: failures.length ? "fail" : "pass",
    durationMs: Date.now() - started,
    metrics,
    failures,
    screenshot,
  };
}

async function run() {
  await waitForServer(baseUrl);
  const { staff, public: publicRoutes, admin } = parseRoutes();
  const outputDir = path.join(process.cwd(), "test-results", "viewport-lock");
  await mkdir(outputDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const results = [];

  for (const vp of VIEWPORTS) {
    {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await context.newPage();
      await loginStaff(page, false);

      for (const route of staff) {
        const result = await auditRoute(page, route, outputDir, vp.id);
        results.push(result);
        console.log(`${result.status === "pass" ? "PASS" : "FAIL"} [${vp.id}] ${route} ${result.failures.join(", ") || ""}`);
        await sleep(800);
      }
      await context.close();
    }

    for (const route of publicRoutes) {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await context.newPage();
      const result = await auditRoute(page, route, outputDir, vp.id);
      results.push(result);
      console.log(`${result.status === "pass" ? "PASS" : "FAIL"} [${vp.id}] ${route} ${result.failures.join(", ") || ""}`);
      await context.close();
      await sleep(800);
    }

    {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await context.newPage();
      await loginStaff(page, true);

      for (const route of admin) {
        const result = await auditRoute(page, route, outputDir, vp.id);
        results.push(result);
        console.log(`${result.status === "pass" ? "PASS" : "FAIL"} [${vp.id}] ${route} ${result.failures.join(", ") || ""}`);
        await sleep(800);
      }

      const timAksesResult = await auditSettingsTimAkses(page, outputDir, vp.id);
      results.push(timAksesResult);
      console.log(
        `${timAksesResult.status === "pass" ? "PASS" : "FAIL"} [${vp.id}] ${timAksesResult.route} ${timAksesResult.failures.join(", ") || ""}`,
      );
      await context.close();
    }
  }

  await browser.close();

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    strict: STRICT,
    viewports: VIEWPORTS.map((v) => v.id),
    routes: results,
    summary: {
      pass: results.filter((r) => r.status === "pass").length,
      fail: results.filter((r) => r.status === "fail").length,
    },
  };

  const reportPath = path.join(outputDir, "viewport-lock-report.json");
  await writeFile(reportPath, JSON.stringify(report, null, 2));

  if (report.summary.fail > 0) {
    console.error(`\nViewport lock: ${report.summary.fail} check(s) FAILED`);
    process.exit(1);
  }

  console.log(`\nViewport lock: ALL_PASS (${report.summary.pass} checks)`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});