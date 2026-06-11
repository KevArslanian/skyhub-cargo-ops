import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { waitForServer } from "./qa-throttle.mjs";

const baseUrl = process.env.APP_BASE_URL ?? "http://127.0.0.1:3100";
const root = process.cwd();
const outputDir = path.join(root, ".qa", "dashboard-overlap");

function rectsOverlap(a, b) {
  return a.top < b.bottom && a.bottom > b.top && a.left < b.right && a.right > b.left;
}

async function run() {
  await waitForServer(baseUrl);
  await mkdir(outputDir, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.getByRole("button", { name: /Masuk/i }).click();
    await page.waitForURL("**/dashboard/**", { timeout: 90000, waitUntil: "domcontentloaded" });
    await page.goto(`${baseUrl}/dashboard/control-center/summary`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForSelector(".dashboard-summary-layout", { timeout: 90000 });
    await page.waitForSelector(".dashboard-flight-recovery-header", { timeout: 90000 });
    await page.waitForTimeout(1500);

    const overlap = await page.evaluate(() => {
      const header = document.querySelector(".dashboard-flight-recovery-header");
      const cards = Array.from(document.querySelectorAll(".dashboard-flight-recovery-scroll [data-recovery-card]"));
      if (!header || cards.length === 0) {
        return { ok: true, reason: "no-recovery-cards" };
      }

      const headerRect = header.getBoundingClientRect();
      const hits = [];

      for (const card of cards) {
        const cardRect = card.getBoundingClientRect();
        const overlaps =
          cardRect.top < headerRect.bottom &&
          cardRect.bottom > headerRect.top &&
          cardRect.left < headerRect.right &&
          cardRect.right > headerRect.left;
        if (overlaps) {
          hits.push({
            flight: card.querySelector(".font-mono")?.textContent?.trim() ?? "unknown",
            cardTop: cardRect.top,
            headerBottom: headerRect.bottom,
          });
        }
      }

      const scroll = document.querySelector(".dashboard-flight-recovery-scroll");
      const scrollRect = scroll?.getBoundingClientRect();
      const scrollOverflow =
        scroll && cards.some((card) => {
          const cardRect = card.getBoundingClientRect();
          return cardRect.bottom > scrollRect.bottom + 1 && cardRect.top < scrollRect.bottom;
        });

      return {
        ok: hits.length === 0,
        hits,
        scrollOverflow: Boolean(scrollOverflow),
        cardCount: cards.length,
      };
    });

    const screenshotPath = path.join(outputDir, "reference-match.png");
    await page.screenshot({ path: screenshotPath, fullPage: false });

    if (!overlap.ok) {
      console.error("Dashboard overlap check FAILED:");
      for (const hit of overlap.hits) {
        console.error(`  ${hit.flight}: card top ${hit.cardTop}px overlaps header bottom ${hit.headerBottom}px`);
      }
      process.exit(1);
    }

    console.log(
      `Dashboard overlap check: ALL_PASS (${overlap.cardCount} recovery cards, scroll=${overlap.scrollOverflow ? "yes" : "no"})`,
    );
    console.log(`Screenshot: ${screenshotPath}`);
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});