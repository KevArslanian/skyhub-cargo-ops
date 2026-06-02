import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const BASE_URL = "http://localhost:3000";
const LOGIN_EMAIL = "staff@skyhub.test";
const LOGIN_PASSWORD = "operator123";

const PAGES = [
  { route: "/dashboard", name: "dashboard" },
  { route: "/shipment-ledger", name: "shipment-ledger" },
  { route: "/awb-tracking", name: "awb-tracking" },
  { route: "/flight-board", name: "flight-board" },
  { route: "/activity-log", name: "activity-log" },
  { route: "/alerts", name: "alerts" },           // important for summary box review
  { route: "/settings", name: "settings" },
  { route: "/reports", name: "reports" },
];

const VIEWPORTS = {
  desktop: { width: 1440, height: 900, label: "desktop" },
  mobile: { width: 390, height: 844, label: "mobile-iphone" },
};

async function login(page) {
  // Prime intro cookie
  await page.request.post(`${BASE_URL}/api/auth/intro`, { maxRedirects: 0 }).catch(() => {});
  
  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[type="email"]', LOGIN_EMAIL);
  await page.fill('input[type="password"]', LOGIN_PASSWORD);
  
  await Promise.all([
    page.waitForURL("**/dashboard", { timeout: 20000 }),
    page.locator('form button[type="submit"]').first().click(),
  ]);
  await page.waitForTimeout(800);
}

async function forceTheme(page, theme) {
  await page.evaluate((t) => {
    localStorage.setItem("theme", t);
    document.documentElement.classList.toggle("dark", t === "dark");
    document.documentElement.classList.toggle("light", t === "light");
  }, theme);
  await page.emulateMedia({ colorScheme: theme });
  await page.waitForTimeout(300);
}

async function capture(page, url, outDir, viewportLabel, theme, pageName) {
  await page.goto(`${BASE_URL}${url}`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(600);
  await forceTheme(page, theme);

  // Scroll to top
  await page.evaluate(() => window.scrollTo(0, 0));

  const fileName = `${viewportLabel}__${theme}__${pageName}.png`;
  const filePath = path.join(outDir, fileName);

  await page.screenshot({ 
    path: filePath, 
    fullPage: true,
    animations: "disabled"
  });

  // Enhanced checks for layout issues the user cares about
  const checks = await page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    
    const horizontalOverflow = Math.max(0, root.scrollWidth - root.clientWidth);
    const verticalScroll = root.scrollHeight > root.clientHeight;
    
    // Look for common mobile cutoff risks (elements near bottom with fixed positioning issues)
    const hasFixedBottomIssues = !!document.querySelector('[style*="position: fixed"][style*="bottom"]');
    
    return {
      horizontalOverflow,
      verticalScroll,
      hasFixedBottomIssues,
      viewportWidth: root.clientWidth,
      contentWidth: root.scrollWidth,
    };
  });

  const status = checks.horizontalOverflow > 5 ? "OVERFLOW" : "OK";
  console.log(`  ✓ ${viewportLabel} ${theme} ${pageName} — ${status} (h-overflow: ${checks.horizontalOverflow}px, v-scroll: ${checks.verticalScroll})`);
  
  return { 
    filePath, 
    ...checks,
    pageName, 
    viewportLabel, 
    theme,
    status
  };
}

async function main() {
  const runId = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outDir = path.join(process.cwd(), "output", "ui-audit", runId);
  await mkdir(outDir, { recursive: true });

  console.log(`\n🔍 Starting UI Audit Capture`);
  console.log(`Output: ${outDir}\n`);

  const browser = await chromium.launch({ headless: true });
  const results = [];

  try {
    for (const [vpKey, vp] of Object.entries(VIEWPORTS)) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 1,
      });

      const page = await context.newPage();

      // Login once per context
      console.log(`\n📱 Logging in for ${vp.label}...`);
      await login(page);

      // Capture each page in both themes
      for (const theme of ["light", "dark"]) {
        console.log(`\n  Theme: ${theme}`);
        for (const p of PAGES) {
          try {
            const r = await capture(page, p.route, outDir, vp.label, theme, p.name);
            results.push(r);
          } catch (err) {
            console.error(`  ✗ Failed ${vp.label} ${theme} ${p.name}: ${err.message}`);
          }
        }
      }

      await context.close();
    }
  } finally {
    await browser.close();
  }

  // Summary
  const badOverflow = results.filter(r => r.overflow > 5);
  console.log(`\n\n=== UI AUDIT CAPTURE COMPLETE ===`);
  console.log(`Screenshots: ${results.length}`);
  console.log(`Horizontal overflow issues (>5px): ${badOverflow.length}`);
  if (badOverflow.length > 0) {
    badOverflow.forEach(r => console.log(`  - ${r.viewportLabel} ${r.theme} ${r.pageName}: ${r.overflow}px`));
  }
  console.log(`\nScreenshots saved to: ${outDir}`);
  console.log(`\nNext step: Zip the folder "${outDir}" and share it with me (or the key PNG files), so I can visually analyze for summary boxes, layout issues, mobile problems, etc.`);
  console.log(`Especially look at: dashboard, shipment-ledger (detail view), alerts, flight-board, activity-log.`);
}

main().catch(console.error);