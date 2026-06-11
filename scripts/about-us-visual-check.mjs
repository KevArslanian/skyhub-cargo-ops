import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
const outDir = path.join(process.cwd(), "test-results", "about-us-visual");

const sections = ["overview", "tracking", "about", "capabilities", "complaints"];

const BLEED_MARKERS = {
  tracking: [
    { text: "Cek Resi Publik", label: "tombol hero" },
    { text: "Masuk Operator", label: "tombol hero" },
  ],
  about: [{ text: "Contoh: 123-45678901", label: "placeholder AWB tracking" }],
  capabilities: [
    { text: "konteks yang dibaca asdos", label: "teks Tentang Kami" },
    { text: "Cek Resi Publik", label: "tombol hero" },
  ],
  complaints: [{ text: "CEK RESI LANGSUNG", label: "header tracking" }],
};

async function overflowPx(page) {
  return page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
}

async function navState(page) {
  return page.evaluate(() => {
    const active = Array.from(
      document.querySelectorAll("nav button[aria-current='page']:not(.premium-mobile-nav button)"),
    ).map((b) => b.textContent?.trim());
    const mobileActive = Array.from(document.querySelectorAll(".premium-mobile-nav button[aria-current='page']")).map(
      (b) => b.textContent?.trim(),
    );
    const nav = document.getElementById("navbar");
    const rect = nav?.getBoundingClientRect();
    return {
      active,
      mobileActive,
      navBottom: rect?.bottom ?? 0,
      navHeight: rect?.height ?? 0,
      scrollY: window.scrollY,
    };
  });
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const issues = [];

  await page.goto(`${baseUrl}/about-us`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);

  const overflowInitial = await overflowPx(page);
  if (overflowInitial > 2) issues.push(`horizontal overflow on load: ${overflowInitial}px`);

  const logoOk = await page.locator('nav img[src*="skyhub-logo-icon-clean"]').count();
  if (logoOk < 1) {
    issues.push("overview: logo skyhub-logo-icon-clean tidak ditemukan di nav");
  }

  await page.screenshot({ path: path.join(outDir, "01-overview-top.png") });

  for (const id of sections) {
    await page.getByRole("button", { name: sections.find((s) => s === id) ? undefined : "" });
  }

  for (const label of [
    ["Ringkasan", "overview"],
    ["Cek Resi", "tracking"],
    ["Tentang Kami", "about"],
    ["Kapabilitas", "capabilities"],
    ["Keluhan", "complaints"],
  ]) {
    const [name, id] = label;
    await page.getByRole("button", { name, exact: true }).filter({ hasText: name }).first().click();
    await page.waitForTimeout(1200);
    const state = await navState(page);
    const overflow = await overflowPx(page);
    const sectionMetrics = await page.evaluate((sid) => {
      const section = document.getElementById(sid);
      const navBottom = document.getElementById("navbar")?.getBoundingClientRect().bottom ?? 96;
      const contact = document.getElementById("about-contact");
      const panels = section ? Array.from(section.querySelectorAll(".premium-content-panel")) : [];
      const panelBorders = panels.map((node) => getComputedStyle(node).borderTopWidth);

      const isVisible = (node) => {
        if (!node) return false;
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return (
          style.opacity !== "0" &&
          style.visibility !== "hidden" &&
          rect.bottom > navBottom + 8 &&
          rect.top < window.innerHeight - 8 &&
          rect.height > 0
        );
      };

      return {
        sectionTop: section?.getBoundingClientRect().top ?? -999,
        contactVisible: isVisible(contact),
        panelCount: panels.length,
        panelsMissingBorder: panelBorders.filter((value) => value === "0px").length,
      };
    }, id);

    const bleed = await page.evaluate(
      ({ sid, markers }) => {
        const navBottom = document.getElementById("navbar")?.getBoundingClientRect().bottom ?? 96;
        const bleedTop = navBottom + 24;
        const hits = [];

        const nodeVisibleInBleedZone = (node) => {
          const rect = node.getBoundingClientRect();
          const style = getComputedStyle(node);
          if (style.opacity === "0" || style.visibility === "hidden" || rect.height < 2) {
            return false;
          }
          return rect.top < bleedTop && rect.bottom > 0 && rect.width > 0;
        };

        for (const marker of markers) {
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          let current;
          while ((current = walker.nextNode())) {
            const value = current.textContent?.trim() ?? "";
            if (!value.includes(marker.text)) {
              continue;
            }
            const element = current.parentElement;
            if (!element || element.closest(`#${sid}`)) {
              continue;
            }
            if (nodeVisibleInBleedZone(element)) {
              hits.push(marker.label);
              break;
            }
          }
        }

        return { hits, sectionTop: document.getElementById(sid)?.getBoundingClientRect().top ?? -999 };
      },
      { sid: id, markers: BLEED_MARKERS[id] ?? [] },
    );

    await page.screenshot({ path: path.join(outDir, `nav-${id}.png`) });

    if (bleed.hits.length) {
      issues.push(`${name}: bleed di zona nav (${bleed.hits.join(", ")})`);
    }
    if (Math.abs(bleed.sectionTop - state.navBottom) > 48 && id !== "overview" && id !== "complaints") {
      issues.push(`${name}: section top=${Math.round(bleed.sectionTop)}px, nav bottom=${Math.round(state.navBottom)}px`);
    }
    if (id === "complaints") {
      const complaintsFocus = await page.evaluate(() => {
        const navBottom = document.getElementById("navbar")?.getBoundingClientRect().bottom ?? 96;
        const panels = document.getElementById("complaints-panels");
        const submit = Array.from(document.querySelectorAll("button")).find((node) =>
          node.textContent?.trim().includes("KIRIM KELUHAN"),
        );
        const panelRect = panels?.getBoundingClientRect();
        const submitRect = submit?.getBoundingClientRect();
        return {
          panelsTop: panelRect?.top ?? -999,
          panelsVisible:
            !!panelRect &&
            panelRect.top >= navBottom - 8 &&
            panelRect.top < window.innerHeight - 80 &&
            panelRect.bottom > navBottom + 8,
          submitVisible:
            !!submitRect &&
            submitRect.bottom > navBottom + 8 &&
            submitRect.bottom <= window.innerHeight + 2,
        };
      });
      if (!complaintsFocus.panelsVisible) {
        issues.push(`${name}: grid panel tidak terlihat di viewport (top=${Math.round(complaintsFocus.panelsTop)}px)`);
      }
      if (!complaintsFocus.submitVisible) {
        issues.push(`${name}: tombol KIRIM KELUHAN terpotong atau tidak terlihat`);
      }
    }

    if (state.active.length !== 1 || state.active[0] !== name) {
      issues.push(`${name}: desktop active=[${state.active.join(", ")}]`);
    }
    if (state.mobileActive.length !== 1 || state.mobileActive[0] !== name) {
      issues.push(`${name}: mobile active=[${state.mobileActive.join(", ")}]`);
    }
    if (id === "about" && !sectionMetrics.contactVisible) {
      issues.push(`${name}: kartu Pusat Operasi tidak terlihat di viewport`);
    }
    if (id === "capabilities") {
      const capFocus = await page.evaluate(() => {
        const navBottom = document.getElementById("navbar")?.getBoundingClientRect().bottom ?? 96;
        const intro = document.getElementById("capabilities-intro");
        const complaints = document.getElementById("complaints");
        const visible = (node) => {
          if (!node) return 0;
          const rect = node.getBoundingClientRect();
          const top = Math.max(rect.top, navBottom);
          const bottom = Math.min(rect.bottom, window.innerHeight);
          return Math.max(0, bottom - top) / Math.max(rect.height, 1);
        };
        return {
          intro: visible(intro),
          complaints: visible(complaints),
        };
      });
      if (capFocus.intro < 0.35) {
        issues.push(`${name}: judul kapabilitas tidak terlihat di viewport`);
      }
      if (capFocus.complaints > 0.2) {
        issues.push(`${name}: section keluhan ikut tampil (${Math.round(capFocus.complaints * 100)}% viewport)`);
      }
    }
    if (["about", "capabilities", "complaints", "tracking"].includes(id) && sectionMetrics.panelCount === 0) {
      issues.push(`${name}: tidak ada premium-content-panel di section`);
    }
    if (sectionMetrics.panelsMissingBorder > 0) {
      issues.push(`${name}: ${sectionMetrics.panelsMissingBorder} panel tanpa border`);
    }
    if (["tracking", "about", "complaints"].includes(id)) {
      const panelAlign = await page.evaluate((sid) => {
        const section = document.getElementById(sid);
        const grid = section?.querySelector(".about-equal-columns");
        const panels = grid ? Array.from(grid.querySelectorAll(".about-equal-panel")) : [];
        if (panels.length < 2) {
          return { ok: false, reason: `panel count ${panels.length}` };
        }
        const rects = panels.slice(0, 2).map((node) => node.getBoundingClientRect());
        const heightDelta = Math.abs(rects[0].height - rects[1].height);
        const topDelta = Math.abs(rects[0].top - rects[1].top);
        return {
          ok: heightDelta < 8 && topDelta < 4,
          heightDelta: Math.round(heightDelta),
          topDelta: Math.round(topDelta),
        };
      }, id);
      if (!panelAlign.ok) {
        issues.push(
          `${name}: panel tidak sejajar (heightDelta=${panelAlign.heightDelta ?? "?"}px, topDelta=${panelAlign.topDelta ?? "?"}px, ${panelAlign.reason ?? ""})`,
        );
      }
    }
    if (overflow > 2) issues.push(`${name}: horizontal overflow ${overflow}px`);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/about-us`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Tentang Kami", exact: true }).first().click();
  await page.waitForTimeout(900);
  const mobileAbout = await page.evaluate(() => {
    const navBottom = document.getElementById("navbar")?.getBoundingClientRect().bottom ?? 96;
    const contact = document.getElementById("about-contact");
    if (!contact) return { ok: false, reason: "missing" };
    const rect = contact.getBoundingClientRect();
    const style = getComputedStyle(contact);
    const visible =
      style.opacity !== "0" &&
      rect.bottom > navBottom + 8 &&
      rect.top < window.innerHeight - 8;
    const contactFirst = contact.compareDocumentPosition(
      contact.parentElement?.querySelector(".premium-content-panel") ?? contact,
    );
    return { ok: visible, top: Math.round(rect.top), navBottom: Math.round(navBottom), contactFirst };
  });
  await page.screenshot({ path: path.join(outDir, "mobile-about.png"), fullPage: false });
  if (!mobileAbout.ok) {
    issues.push(`mobile Tentang Kami: Pusat Operasi tidak terlihat (top=${mobileAbout.top ?? "?"})`);
  }
  const mobileOverflow = await overflowPx(page);
  if (mobileOverflow > 4) issues.push(`mobile horizontal overflow: ${mobileOverflow}px`);

  await browser.close();

  const report = { issues, outDir, ok: issues.length === 0 };
  fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exit(issues.length ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});