import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3100";
const outDir = path.join(process.cwd(), "test-results", "about-video-perf");

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const issues = [];

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${baseUrl}/about-us`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);

  const liteState = await page.evaluate(() => ({
    videos: document.querySelectorAll("video").length,
    poster: Boolean(document.querySelector(".about-scroll-poster")),
    cacheReady: window.__ABOUT_CACHE_READY__ ?? null,
  }));

  if (!liteState.poster) {
    issues.push("poster image missing");
  }

  const videoRequests = [];
  page.on("request", (request) => {
    const url = request.url();
    if (url.includes("/media/about/") && (url.endsWith(".mp4") || url.endsWith(".webm"))) {
      videoRequests.push(url);
    }
  });

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  const afterReload = await page.evaluate(() => ({
    videos: document.querySelectorAll("video").length,
    poster: Boolean(document.querySelector(".about-scroll-poster")),
  }));

  if (!afterReload.poster) {
    issues.push("poster missing after reload");
  }

  const liteMp4 = videoRequests.filter((url) => url.includes("sky-clouds-lite.mp4"));
  if (liteMp4.length > 2) {
    issues.push(`too many lite mp4 fetches on reload: ${liteMp4.length}`);
  }

  const mp4Path = path.join(process.cwd(), "public/media/about/sky-clouds-lite.mp4");
  const webmPath = path.join(process.cwd(), "public/media/about/sky-clouds-lite.webm");
  if (!fs.existsSync(mp4Path)) issues.push("missing sky-clouds-lite.mp4");
  if (!fs.existsSync(webmPath)) issues.push("missing sky-clouds-lite.webm");

  const mp4Size = fs.existsSync(mp4Path) ? fs.statSync(mp4Path).size : 0;
  if (mp4Size > 1_200_000) {
    issues.push(`sky-clouds-lite.mp4 too large: ${mp4Size} bytes`);
  }

  await browser.close();

  const result = {
    ok: issues.length === 0,
    issues,
    videoRequests: videoRequests.length,
    mp4Size,
  };

  fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  process.exit(issues.length ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});