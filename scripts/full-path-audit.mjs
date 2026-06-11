import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3100";
const password = process.env.QA_LOGIN_PASSWORD ?? "operator123";

const accounts = {
  staff: process.env.QA_LOGIN_EMAIL ?? "staff@skyhub.test",
  admin: process.env.QA_ADMIN_EMAIL ?? "admin@skyhub.test",
  customer: process.env.QA_CUSTOMER_EMAIL ?? "customer@skyhub.test",
};

const viewport = { width: 1440, height: 900 };

/** @type {Array<{route: string, label: string, group: string, roles: string[], notes?: string, dynamic?: boolean}>} */
const ROUTE_MANIFEST = [
  { route: "/", label: "Root", group: "Publik", roles: ["public"], notes: "Redirect ke /about-us" },
  { route: "/about-us", label: "About Us", group: "Publik", roles: ["public"] },
  { route: "/login", label: "Login", group: "Publik", roles: ["public"] },
  { route: "/dashboard", label: "Pusat Kendali", group: "Operasional", roles: ["admin", "staff"] },
  { route: "/shipment-ledger", label: "Buku Pengiriman", group: "Operasional", roles: ["admin", "staff"] },
  { route: "/awb-tracking", label: "Pelacakan AWB", group: "Operasional", roles: ["admin", "staff", "customer"] },
  { route: "/flight-board", label: "Management Pesawat", group: "Pemantauan", roles: ["admin", "staff"] },
  { route: "/alerts", label: "Pusat Peringatan", group: "Pemantauan", roles: ["admin", "staff"] },
  { route: "/activity-log", label: "Catatan Aktivitas", group: "Pemantauan", roles: ["admin", "staff"] },
  { route: "/complaints", label: "Kotak Keluhan", group: "Pemantauan", roles: ["admin", "staff"] },
  { route: "/reports", label: "Laporan (legacy redirect)", group: "Sistem", roles: ["admin", "staff"], notes: "Redirect ke /dashboard" },
  { route: "/settings", label: "Pengaturan", group: "Sistem", roles: ["admin", "staff"] },
  { route: "/query", label: "Pemeriksaan Data", group: "Admin", roles: ["admin"], notes: "Staff diarahkan ke /dashboard" },
  { route: "/seed", label: "Utilitas Seed", group: "Admin", roles: ["admin"], notes: "Staff diarahkan ke /dashboard" },
  { route: "/exports/shipments", label: "Cetak Buku Pengiriman", group: "Export", roles: ["admin", "staff"] },
  { route: "/exports/flights", label: "Cetak Management Pesawat", group: "Export", roles: ["admin", "staff"] },
  { route: "/exports/activity-log", label: "Cetak Catatan Aktivitas", group: "Export", roles: ["admin", "staff"] },
  { route: "/exports/awb", label: "Cetak AWB", group: "Export", roles: ["admin", "staff", "customer"], dynamic: true },
];

const requiredChecks = {
  "/": { selectors: ["h1"], landmark: null, expectUrl: /\/about-us$/ },
  "/about-us": { selectors: ["h1", 'button:has-text("MASUK")'], landmark: null },
  "/login": { selectors: ['input[type="email"]', 'form button[type="submit"]'], landmark: null },
  "/dashboard": { selectors: [".dashboard-summary-strip"], landmark: "main", waitFor: ".dashboard-summary-strip" },
  "/shipment-ledger": { selectors: ["h1"], landmark: "main" },
  "/awb-tracking": { selectors: ["#awb-tracking-input"], landmark: "main", waitFor: "#awb-tracking-input" },
  "/flight-board": { selectors: ["h1"], landmark: "main" },
  "/alerts": { selectors: ["h1"], landmark: "main" },
  "/activity-log": { selectors: ["h1"], landmark: "main" },
  "/complaints": { selectors: ["h1"], landmark: "main" },
  "/reports": { selectors: [".dashboard-summary-strip"], landmark: "main", expectUrl: /\/dashboard$/ },
  "/settings": { selectors: ["h1"], landmark: "main" },
  "/query": { selectors: ["h1"], landmark: "main" },
  "/seed": { selectors: ["h1"], landmark: "main" },
  "/exports/shipments": { selectors: ["table"], landmark: null },
  "/exports/flights": { selectors: ["table"], landmark: null },
  "/exports/activity-log": { selectors: ["table"], landmark: null },
  "/exports/awb": { selectors: ["table"], landmark: null },
};

const staffRedirectExpectations = {
  "/query": /\/dashboard$/,
  "/seed": /\/dashboard$/,
};

function nowStamp() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}${String(d.getSeconds()).padStart(2, "0")}`;
}

function routeKey(route) {
  return route.split("?")[0];
}

function routeUrl(route) {
  return new URL(route, baseUrl).toString();
}

function routeSlug(route) {
  return route.replace(/[/?=&]+/g, "_").replace(/^_/, "").replace(/_$/, "") || "root";
}

async function primeIntro(page) {
  await page.request.post(routeUrl("/api/auth/intro"), { maxRedirects: 0 });
}

async function loginAs(page, role) {
  await primeIntro(page);
  const response = await page.request.post(routeUrl("/api/auth/login"), {
    data: { email: accounts[role], password, remember: false },
  });
  if (!response.ok()) {
    throw new Error(`Login ${role} failed with status ${response.status()}`);
  }
  const payload = await response.json();
  const landing = payload.role === "customer" ? "/awb-tracking" : "/dashboard";
  await page.goto(routeUrl(landing), { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
}

async function resolveAwb(page) {
  const response = await page.request.get(routeUrl("/api/shipments"));
  if (!response.ok()) throw new Error(`/api/shipments returned ${response.status()}`);
  const payload = await response.json();
  const awb = payload.shipments?.find((item) => item?.awb)?.awb;
  if (!awb) throw new Error("No AWB found for export audit");
  return awb;
}

async function getOverflow(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    return Math.max(0, Math.ceil(Math.max(root.scrollWidth, document.body.scrollWidth) - root.clientWidth));
  });
}

async function auditRoute(page, route, role) {
  const resolvedRoute = route.includes("/exports/awb") && !route.includes("awb=") ? null : route;
  const target = resolvedRoute ?? route;
  const started = Date.now();

  let response = null;
  try {
    response = await page.goto(routeUrl(target), { waitUntil: "domcontentloaded", timeout: 30000 });
  } catch (error) {
    return {
      route: target,
      role,
      status: "error",
      httpStatus: null,
      finalUrl: page.url(),
      durationMs: Date.now() - started,
      overflowPx: null,
      missingSelectors: [],
      error: String(error),
      screenshot: null,
    };
  }

  const checks = requiredChecks[routeKey(target)] ?? { selectors: ["main"], landmark: "main" };

  if (checks.waitFor) {
    await page.locator(checks.waitFor).first().waitFor({ state: "visible", timeout: 20000 }).catch(() => {});
  } else {
    await page.waitForTimeout(800);
  }

  const finalUrl = page.url();
  const missingSelectors = [];

  if (checks.expectUrl && !checks.expectUrl.test(finalUrl.replace(baseUrl, ""))) {
    missingSelectors.push(`expected-url:${checks.expectUrl}`);
  }

  const expectedRedirect = role === "staff" ? staffRedirectExpectations[routeKey(target)] : null;
  if (expectedRedirect) {
    const redirected = expectedRedirect.test(finalUrl.replace(baseUrl, ""));
    return {
      route: target,
      role,
      status: redirected ? "pass" : "fail",
      httpStatus: response?.status() ?? null,
      finalUrl,
      pageTitle: await page.title(),
      durationMs: Date.now() - started,
      overflowPx: await getOverflow(page),
      missingSelectors: redirected ? [] : [`expected-redirect:${expectedRedirect}`],
      error: null,
      screenshot: null,
    };
  }

  for (const selector of checks.selectors) {
    if (selector === "h1") {
      const count = await page.locator("h1").count();
      if (count === 0) missingSelectors.push("h1");
      continue;
    }
    const visible = await page.locator(selector).first().isVisible().catch(() => false);
    if (!visible) missingSelectors.push(selector);
  }

  if (checks.landmark) {
    const landmarkVisible = await page.locator(checks.landmark).first().isVisible().catch(() => false);
    if (!landmarkVisible) missingSelectors.push(checks.landmark);
  }

  const overflowPx = await getOverflow(page);
  const title = await page.title();

  return {
    route: target,
    role,
    status: missingSelectors.length === 0 && overflowPx <= 2 ? "pass" : "fail",
    httpStatus: response?.status() ?? null,
    finalUrl,
    pageTitle: title,
    durationMs: Date.now() - started,
    overflowPx,
    missingSelectors,
    error: null,
  };
}

function expectedAccess(role, manifest) {
  if (role === "public") return manifest.roles.includes("public");
  return manifest.roles.includes(role);
}

function buildMarkdown({ runId, results, awb }) {
  const failures = results.filter((entry) => entry.status === "fail" || entry.status === "error");
  const passes = results.filter((entry) => entry.status === "pass");

  const byGroup = ROUTE_MANIFEST.reduce((acc, item) => {
    acc[item.group] ??= [];
    acc[item.group].push(item);
    return acc;
  }, {});

  let md = `# SkyHub Ops — Laporan Audit Path Penuh\n\n`;
  md += `Run ID: \`${runId}\`\n`;
  md += `Base URL: \`${baseUrl}\`\n`;
  md += `Tanggal: ${new Date().toISOString()}\n`;
  md += `AWB sampel export: \`${awb}\`\n\n`;
  md += `## Ringkasan\n\n`;
  md += `| Metrik | Nilai |\n|--------|-------|\n`;
  md += `| Total kunjungan | ${results.length} |\n`;
  md += `| Lolos | ${passes.length} |\n`;
  md += `| Gagal / error | ${failures.length} |\n\n`;

  md += `## Manifest Path (semua route aplikasi)\n\n`;
  for (const [group, items] of Object.entries(byGroup)) {
    md += `### ${group}\n\n`;
    md += `| Route | Label | Role |\n|-------|-------|------|\n`;
    for (const item of items) {
      md += `| \`${item.route}\` | ${item.label} | ${item.roles.join(", ")} |`;
      if (item.notes) md += ` (${item.notes})`;
      md += `\n`;
    }
    md += `\n`;
  }

  md += `## Hasil per Role\n\n`;
  for (const role of ["public", "staff", "admin", "customer"]) {
    const roleResults = results.filter((entry) => entry.role === role);
    if (!roleResults.length) continue;
    md += `### ${role}\n\n`;
    md += `| Route | Status | Final URL | Overflow | Missing | Catatan |\n`;
    md += `|-------|--------|-----------|----------|---------|--------|\n`;
    for (const entry of roleResults) {
      const note = entry.error ?? (entry.missingSelectors.length ? entry.missingSelectors.join(", ") : "-");
      md += `| \`${entry.route}\` | ${entry.status.toUpperCase()} | \`${(entry.finalUrl ?? "-").replace(baseUrl, "")}\` | ${entry.overflowPx ?? "-"}px | ${entry.missingSelectors.length} | ${note} |\n`;
    }
    md += `\n`;
  }

  if (failures.length) {
    md += `## Temuan Gagal\n\n`;
    for (const entry of failures) {
      const reason = entry.error ?? (entry.missingSelectors.join(", ") || "overflow/layout");
      md += `- **${entry.role}** \`${entry.route}\`: ${reason}\n`;
    }
    md += `\n`;
  }

  md += `## Alur Navigasi (sidebar staff)\n\n`;
  md += `\`\`\`mermaid\nflowchart TD\n`;
  md += `  about["/about-us"] --> login["/login"]\n`;
  md += `  login --> dash["/dashboard"]\n`;
  md += `  dash --> ledger["/shipment-ledger"]\n`;
  md += `  dash --> awb["/awb-tracking"]\n`;
  md += `  dash --> flight["/flight-board"]\n`;
  md += `  dash --> alerts["/alerts"]\n`;
  md += `  dash --> activity["/activity-log"]\n`;
  md += `  dash --> complaints["/complaints"]\n`;
  md += `  dash --> reports["/reports"]\n`;
  md += `  dash --> settings["/settings"]\n`;
  md += `  reports --> exShip["/exports/shipments"]\n`;
  md += `  reports --> exFlight["/exports/flights"]\n`;
  md += `  reports --> exLog["/exports/activity-log"]\n`;
  md += `  awb --> exAwb["/exports/awb?awb=..."]\n`;
  md += `\`\`\`\n`;

  return md;
}

async function run() {
  const runId = nowStamp();
  const outputDir = path.join(process.cwd(), "output", "path-audit", runId);
  await mkdir(outputDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const results = [];
  let awb = process.env.QA_VISUAL_AWB ?? "";

  try {
    // Public routes
    {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      for (const item of ROUTE_MANIFEST.filter((entry) => entry.roles.includes("public"))) {
        const entry = await auditRoute(page, item.route, "public");
        const shot = path.join(outputDir, `public__${routeSlug(item.route)}.png`);
        await page.screenshot({ path: shot, fullPage: true });
        entry.screenshot = shot;
        results.push(entry);
      }
      await context.close();
    }

    // Staff routes
    {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      await loginAs(page, "staff");
      if (!awb) awb = await resolveAwb(page);

      for (const item of ROUTE_MANIFEST) {
        if (item.roles.includes("public")) continue;
        const route = item.route === "/exports/awb" ? `/exports/awb?awb=${encodeURIComponent(awb)}` : item.route;
        const entry = await auditRoute(page, route, "staff");
        const shot = path.join(outputDir, `staff__${routeSlug(route)}.png`);
        await page.screenshot({ path: shot, fullPage: true });
        entry.screenshot = shot;
        results.push(entry);
      }
      await context.close();
    }

    // Admin-only routes + verify staff redirect
    {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      await loginAs(page, "admin");
      for (const route of ["/query", "/seed"]) {
        const entry = await auditRoute(page, route, "admin");
        const shot = path.join(outputDir, `admin__${routeSlug(route)}.png`);
        await page.screenshot({ path: shot, fullPage: true });
        entry.screenshot = shot;
        results.push(entry);
      }
      await context.close();
    }

    // Customer routes skipped unless QA_CUSTOMER_LOGIN_ENABLED=1
    if (process.env.QA_CUSTOMER_LOGIN_ENABLED === "1") {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      await loginAs(page, "customer");
      if (!awb) {
        const response = await page.request.get(routeUrl("/api/shipments"));
        if (response.ok()) {
          const payload = await response.json();
          awb = payload.shipments?.find((item) => item?.awb)?.awb ?? awb;
        }
      }
      for (const route of ["/awb-tracking", `/exports/awb?awb=${encodeURIComponent(awb)}`]) {
        const entry = await auditRoute(page, route, "customer");
        const shot = path.join(outputDir, `customer__${routeSlug(route)}.png`);
        await page.screenshot({ path: shot, fullPage: true });
        entry.screenshot = shot;
        results.push(entry);

        for (const blocked of ["/dashboard", "/flight-board", "/reports"]) {
          await page.goto(routeUrl(blocked), { waitUntil: "domcontentloaded" });
          await page.waitForTimeout(300);
          const redirected = page.url().includes("/awb-tracking");
          results.push({
            route: blocked,
            role: "customer-blocked",
            status: redirected ? "pass" : "fail",
            httpStatus: 200,
            finalUrl: page.url(),
            pageTitle: await page.title(),
            durationMs: 0,
            overflowPx: 0,
            missingSelectors: redirected ? [] : ["redirect-to-awb-tracking"],
            error: null,
            screenshot: null,
          });
        }
      }
      await context.close();
    } else {
      results.push({
        route: "/awb-tracking",
        role: "customer",
        status: "skip",
        httpStatus: null,
        finalUrl: null,
        durationMs: 0,
        overflowPx: null,
        missingSelectors: [],
        error: "Customer login disabled (set QA_CUSTOMER_LOGIN_ENABLED=1 to audit)",
        screenshot: null,
      });
    }
  } finally {
    await browser.close();
  }

  const jsonPath = path.join(outputDir, "results.json");
  await writeFile(jsonPath, `${JSON.stringify(results, null, 2)}\n`);
  const md = buildMarkdown({ runId, results, awb });
  const mdPath = path.join(outputDir, "PATH-AUDIT-REPORT.md");
  await writeFile(mdPath, md);
  const manifestPath = path.join(process.cwd(), "audit-path-manifest.md");
  await writeFile(manifestPath, md);

  const summary = {
    runId,
    baseUrl,
    total: results.length,
    pass: results.filter((entry) => entry.status === "pass").length,
    fail: results.filter((entry) => entry.status === "fail" || entry.status === "error").length,
    skip: results.filter((entry) => entry.status === "skip").length,
    outputDir,
    report: mdPath,
    json: jsonPath,
  };

  console.log(JSON.stringify(summary, null, 2));
  const hardFails = results.filter((e) => e.status === "fail" || e.status === "error").length;
  if (hardFails > 0) process.exit(1);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});