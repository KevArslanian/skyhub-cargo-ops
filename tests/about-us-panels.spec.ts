import { expect, test } from "playwright/test";

const baseURL = process.env.APP_BASE_URL ?? "http://localhost:3000";

test.describe("@about-us Scroll + nav highlight", () => {
  test("all main sections stay on one scrollable page", async ({ page }) => {
    await page.goto(`${baseURL}/about-us`);
    await expect(page.locator("#overview")).toBeAttached();
    await expect(page.locator("#tracking")).toBeAttached();
    await expect(page.locator("#about")).toBeAttached();
    await expect(page.locator("#capabilities")).toBeAttached();
    await expect(page.locator("#complaints")).toBeAttached();
    await page.locator("#complaints").scrollIntoViewIfNeeded();
    await expect(page.getByText("KOTAK KELUHAN", { exact: true }).first()).toBeVisible();
  });

  test("Tentang Kami shows readable content after nav click", async ({ page }) => {
    await page.goto(`${baseURL}/about-us`);
    await page.getByRole("button", { name: "Tentang Kami", exact: true }).first().click();
    await page.waitForTimeout(1000);
    const about = page.locator("#about");
    await expect(about.getByText("CERITA KAMI", { exact: true })).toBeVisible();
    await expect(about.locator("h2").first()).toBeVisible();
    await expect(page.getByText("CEK RESI LANGSUNG", { exact: true })).not.toBeInViewport();
    const dominant = await page.evaluate(() => {
      const nav = document.getElementById("navbar")?.offsetHeight ?? 96;
      const score = (id: string) => {
        const el = document.getElementById(id);
        if (!el) return 0;
        const r = el.getBoundingClientRect();
        const top = Math.max(r.top, nav);
        const bottom = Math.min(r.bottom, window.innerHeight);
        return Math.max(0, bottom - top);
      };
      return score("about") > score("tracking");
    });
    expect(dominant).toBeTruthy();
  });

  test("click Cek Resi highlights one menu and scrolls to tracking", async ({ page }) => {
    await page.goto(`${baseURL}/about-us`);
    const trackingButton = page.getByRole("button", { name: "Cek Resi", exact: true }).first();
    await trackingButton.click();
    await expect(trackingButton).toHaveAttribute("aria-current", "page");
    await expect(page.locator("#tracking")).toBeInViewport();
    await expect(page.getByRole("button", { name: "Ringkasan", exact: true }).first()).not.toHaveAttribute("aria-current", "page");
  });

  test("scroll updates highlighted menu to Tentang Kami", async ({ page }) => {
    await page.goto(`${baseURL}/about-us#tracking`);
    await page.locator("#about").scrollIntoViewIfNeeded();
    await expect(page.getByRole("button", { name: "Tentang Kami", exact: true }).first()).toHaveAttribute("aria-current", "page", {
      timeout: 5000,
    });
  });
});