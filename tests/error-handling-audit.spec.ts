import { expect, test, type APIRequestContext, type Page } from "playwright/test";

const baseURL = process.env.APP_BASE_URL ?? "http://localhost:3000";
const password = process.env.QA_LOGIN_PASSWORD ?? "operator123";
const staffEmail = process.env.QA_LOGIN_EMAIL ?? "staff@skyhub.test";
const adminEmail = process.env.QA_ADMIN_EMAIL ?? "admin@skyhub.test";

async function loginViaApiRequest(request: APIRequestContext, email = staffEmail) {
  const response = await request.post(`${baseURL}/api/auth/login`, {
    data: { email, password, remember: true },
  });
  expect(response.ok()).toBeTruthy();
}

async function loginViaApi(page: Page, email = staffEmail) {
  await loginViaApiRequest(page.request, email);
}

async function loginPage(page: Page, email = staffEmail) {
  await page.request.post(`${baseURL}/api/auth/intro`, { maxRedirects: 0 }).catch(() => undefined);
  await loginViaApi(page, email);
  const home = email.startsWith("customer@") ? "/awb-tracking" : "/dashboard";
  await page.goto(`${baseURL}${home}`, { waitUntil: "domcontentloaded" });
}

async function expectShellReady(page: Page) {
  await expect(page.locator("main.ops-shell-main-scroll").first()).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole("banner").first()).toBeVisible();
}

async function expectAlertDialog(page: Page, titlePattern: RegExp | string) {
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible({ timeout: 8000 });
  if (typeof titlePattern === "string") {
    await expect(dialog.getByRole("heading", { level: 2 })).toContainText(titlePattern);
  } else {
    await expect(dialog.getByRole("heading", { level: 2 })).toHaveText(titlePattern);
  }
  await dialog.getByRole("button", { name: /^OK$/i }).click();
  await expect(dialog).toBeHidden({ timeout: 5000 });
}

async function expectLoginFieldError(page: Page, message: RegExp | string) {
  await expect(page.getByText(message)).toBeVisible({ timeout: 5000 });
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
}

async function expectLoginFormAlert(page: Page, titlePattern: RegExp | string) {
  const alert = page.locator("form").getByRole("alert");
  await expect(alert).toBeVisible({ timeout: 10000 });
  await expect(alert).toContainText(titlePattern);
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
}

async function expectFeedbackBanner(page: Page, titlePattern: RegExp | string, tone?: "warning" | "error" | "info") {
  const banner = page
    .locator(tone ? `.ops-feedback-banner--${tone}` : ".ops-feedback-banner")
    .filter({ hasText: titlePattern })
    .first();
  await expect(banner).toBeVisible({ timeout: 35000 });
  await expect(banner.locator(".ops-feedback-banner-title")).toContainText(titlePattern);
}

async function abortDashboardAlertsOnly(route: { request: () => { url: () => string }; abort: (error?: string) => Promise<void>; continue: () => Promise<void> }) {
  if (route.request().url().includes("alertsOnly=1")) {
    await route.abort("failed");
    return;
  }
  await route.continue();
}

async function solvePublicTrackingCaptcha(page: Page) {
  const prompt = page.locator("#tracking .font-mono.text-2xl").first();
  await expect(prompt).not.toHaveText("...", { timeout: 10_000 });
  const text = (await prompt.textContent())?.trim() ?? "";
  const match = text.match(/(\d+)\s*\+\s*(\d+)/);
  if (!match) {
    throw new Error(`Unexpected captcha prompt: ${text}`);
  }
  return String(Number(match[1]) + Number(match[2]));
}

test.describe("@error-audit Login validation matrix", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("empty email only", async ({ page }) => {
    await page.goto(`${baseURL}/login`);
    await page.locator('input[type="email"]').fill("");
    await page.locator('input[type="password"], input[type="text"]').fill(password);
    await page.locator('form button[type="submit"]').click();
    await expectLoginFieldError(page, /Surel wajib diisi/i);
  });

  test("empty password only", async ({ page }) => {
    await page.goto(`${baseURL}/login`);
    await page.locator('input[type="email"]').fill(staffEmail);
    await page.locator('input[type="password"], input[type="text"]').fill("");
    await page.locator('form button[type="submit"]').click();
    await expectLoginFieldError(page, /Kata sandi wajib diisi/i);
  });

  test("invalid credentials", async ({ page }) => {
    await page.goto(`${baseURL}/login`);
    await page.locator('input[type="email"]').fill(staffEmail);
    await page.locator('input[type="password"], input[type="text"]').fill("wrong-password-qa");
    await page.locator('form button[type="submit"]').click();
    await expectLoginFormAlert(page, /Kredensial tidak cocok/i);
  });
});

test.describe("@error-audit Landing input guards", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("AWB field keeps 160- prefix and accepts 8 digit suffix only", async ({ page }) => {
    await page.goto(`${baseURL}/about-us#tracking`, { waitUntil: "domcontentloaded" });
    const awbInput = page.locator("#public-awb-suffix");
    await awbInput.scrollIntoViewIfNeeded();
    await awbInput.click();
    await awbInput.pressSequentially("abc10000001xyz", { delay: 15 });
    await expect(awbInput).toHaveValue("10000001");
    await expect(page.getByTestId("public-awb-prefix-chip")).toContainText("160-");
  });

  test("tracking form shows captcha and prefix chip without overlap", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${baseURL}/about-us#tracking`, { waitUntil: "domcontentloaded" });

    const prefixChip = page.getByTestId("public-awb-prefix-chip");
    const awbInput = page.locator("#public-awb-suffix");
    const captchaAnswer = page.locator("#public-tracking-captcha-answer");

    await awbInput.scrollIntoViewIfNeeded();
    await expect(prefixChip).toBeVisible();
    await expect(awbInput).toBeVisible();

    await captchaAnswer.scrollIntoViewIfNeeded();
    await expect(captchaAnswer).toBeVisible();

    const overlap = await page.evaluate(() => {
      const prefix = document.querySelector("[data-testid='public-awb-prefix-chip']");
      const input = document.getElementById("public-awb-suffix");
      if (!prefix || !input) return true;
      const prefixRect = prefix.getBoundingClientRect();
      const inputRect = input.getBoundingClientRect();
      const horizontalOverlap = prefixRect.right > inputRect.left + 1;
      const verticalOverlap =
        prefixRect.bottom > inputRect.top + 1 && prefixRect.top < inputRect.bottom - 1;
      return horizontalOverlap && verticalOverlap;
    });

    expect(overlap).toBe(false);

    const captchaClipped = await page.evaluate(() => {
      const captcha = document.getElementById("public-tracking-captcha-answer");
      if (!captcha) return true;
      let node: Element | null = captcha.parentElement;
      while (node && node !== document.body) {
        const style = window.getComputedStyle(node);
        if (/(hidden|clip)/.test(style.overflowY) || /(hidden|clip)/.test(style.overflow)) {
          const parentRect = node.getBoundingClientRect();
          const captchaRect = captcha.getBoundingClientRect();
          const clippedVertically =
            captchaRect.bottom > parentRect.bottom + 1 || captchaRect.top < parentRect.top - 1;
          if (clippedVertically) return true;
        }
        node = node.parentElement;
      }
      return false;
    });

    expect(captchaClipped).toBe(false);
  });

  test("complaint name strips digits while typing", async ({ page }) => {
    await page.goto(`${baseURL}/about-us#complaints`, { waitUntil: "domcontentloaded" });
    const nameInput = page.locator("#complaints").locator("label", { hasText: "NAMA ANDA" }).locator("..").locator("input");
    await nameInput.scrollIntoViewIfNeeded();
    await nameInput.click();
    await nameInput.pressSequentially("Budi123", { delay: 15 });
    await expect(nameInput).toHaveValue("Budi");
  });

  test("empty complaint submit keeps Kirim Keluhan button reachable", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${baseURL}/about-us#complaints`, { waitUntil: "domcontentloaded" });

    const submitButton = page.locator("#complaint-submit-btn");
    await submitButton.scrollIntoViewIfNeeded();
    await expect(submitButton).toBeVisible();
    await page.waitForFunction(() => {
      const form = document.querySelector("#complaints form.premium-complaint-form");
      return Boolean(form);
    });
    await submitButton.click();

    const complaintAlert = page.locator("#complaints [role='alert']").first();
    await expect(complaintAlert).toContainText("Periksa kembali field yang ditandai merah");
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toBeEnabled();

    const viewportHeight = await page.evaluate(() => window.innerHeight);
    const buttonBox = await submitButton.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, height: rect.height };
    });
    expect(buttonBox.top).toBeGreaterThan(72);
    expect(buttonBox.bottom).toBeLessThan(viewportHeight - 16);
    expect(buttonBox.height).toBeGreaterThan(40);

    const buttonClipped = await submitButton.evaluate((node) => {
      const buttonRect = node.getBoundingClientRect();
      let ancestor = node.parentElement;
      while (ancestor) {
        const style = window.getComputedStyle(ancestor);
        const clipsY = style.overflowY === "hidden" || style.overflow === "hidden";
        if (clipsY) {
          const ancestorRect = ancestor.getBoundingClientRect();
          if (ancestorRect.bottom < buttonRect.bottom - 1) {
            return true;
          }
        }
        ancestor = ancestor.parentElement;
      }
      return false;
    });
    expect(buttonClipped).toBe(false);

    await submitButton.click();
    await expect(complaintAlert).toContainText("Periksa kembali field yang ditandai merah");
  });

  test("AWB search requires robot verification answer", async ({ page }) => {
    await page.goto(`${baseURL}/about-us#tracking`, { waitUntil: "domcontentloaded" });
    const awbInput = page.locator("#public-awb-suffix");
    const captchaAnswer = page.locator("#public-tracking-captcha-answer");
    const submitButton = page.locator("#tracking").getByRole("button", { name: "Cek Resi" });

    await awbInput.scrollIntoViewIfNeeded();
    await awbInput.fill("10000001");
    await expect(submitButton).toBeDisabled();
    await captchaAnswer.scrollIntoViewIfNeeded();
    await expect(captchaAnswer).toBeEnabled({ timeout: 10_000 });
    const solvedAnswer = await solvePublicTrackingCaptcha(page);
    await captchaAnswer.fill(solvedAnswer);
    await expect(submitButton).toBeEnabled();
  });
});

test.describe("@error-audit Protected routes — alertdialog on bad input", () => {
  test.beforeEach(async ({ page }) => {
    await loginPage(page);
  });

  test("AWB tracking — format invalid", async ({ page }) => {
    await page.goto(`${baseURL}/awb-tracking`, { waitUntil: "domcontentloaded" });
    await expectShellReady(page);
    await page.locator("#awb-tracking-input").fill("BAD");
    await page.getByRole("button", { name: /lacak/i }).click();
    await expectAlertDialog(page, /Format Salah/i);
  });

  test("AWB tracking — strips letters while typing", async ({ page }) => {
    await page.goto(`${baseURL}/awb-tracking`, { waitUntil: "domcontentloaded" });
    await expectShellReady(page);
    const awbInput = page.locator("#awb-tracking-input");
    await awbInput.pressSequentially("xyz99988877766");
    await expect(awbInput).toHaveValue("999-88877766");
  });

  test("settings profile input keeps focus while typing", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto(`${baseURL}/settings`, { waitUntil: "domcontentloaded" });
    await expectShellReady(page);
    const nameInput = page.locator("#settings-profile-name");
    await expect(nameInput).toBeVisible({ timeout: 15_000 });
    await nameInput.click();
    for (const char of "XYZ") {
      await nameInput.press(char);
      await expect(nameInput).toBeFocused();
    }
    await expect(nameInput).toHaveValue(/XYZ$/);
  });

  test("shipment ledger search keeps focus while typing", async ({ page }) => {
    await page.goto(`${baseURL}/shipment-ledger`, { waitUntil: "domcontentloaded" });
    await expectShellReady(page);
    const searchInput = page.locator("#ledger-query");
    await searchInput.click();
    await searchInput.pressSequentially("abc", { delay: 40 });
    await expect(searchInput).toBeFocused();
    await expect(searchInput).toHaveValue("abc");
  });

  test("AWB tracking — lookup accepts format without checksum gate", async ({ page }) => {
    await page.goto(`${baseURL}/awb-tracking`, { waitUntil: "domcontentloaded" });
    await expectShellReady(page);
    await page.locator("#awb-tracking-input").pressSequentially("12345678901");
    await page.getByRole("button", { name: /lacak/i }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(page).toHaveURL(/awb=123-45678901/);
  });

  test("Shipment ledger create — inline errors without browser tooltip", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto(`${baseURL}/shipment-ledger`, { waitUntil: "domcontentloaded" });
    await expectShellReady(page);
    await page.getByRole("button", { name: /Buat Pengiriman/i }).first().click();
    await expect(page.getByRole("heading", { name: "Tambah manifest baru" })).toBeVisible();
    const drawer = page.locator('form[novalidate]');
    await expect(drawer.getByText("Dibuat Oleh", { exact: true })).toBeVisible();
    await expect(drawer.getByText("Penanggung Jawab Shift", { exact: true })).toBeVisible();
    await expect(drawer.locator('input[disabled][readonly]').first()).toBeVisible();
    await drawer.getByRole("button", { name: /^Buat Pengiriman$/i }).click();
    await expect(page.locator(".form-field-error").first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
  });

  test("Shipment ledger create — same origin and destination", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto(`${baseURL}/shipment-ledger`, { waitUntil: "domcontentloaded" });
    await expectShellReady(page);
    await page.getByRole("button", { name: /Buat Pengiriman/i }).first().click();
    const drawer = page.locator('form[novalidate]');
    await drawer.locator('input[placeholder="Contoh: Dokumen penting"]').fill("Dokumen penting");
    await drawer.locator('input[placeholder="Contoh: 08123456789"]').first().fill("081234567890");
    await drawer.locator('input[placeholder="Nama pengirim"]').fill("Budi Santoso");
    await drawer.locator('input[placeholder="Nama penerima"]').fill("Siti Aminah");
    await drawer.locator('input[placeholder="Nama ekspeditor"]').fill("SkyHub");
    await drawer.locator('select').filter({ has: page.locator('option[value="SOQ"]') }).first().selectOption("SOQ");
    await drawer.getByRole("button", { name: /^Buat Pengiriman$/i }).click();
    await expect(page.getByText(/harus berbeda dari kota asal/i)).toBeVisible();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
  });

  test("Flight board — submit without required fields", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto(`${baseURL}/flight-board`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Manajemen Pesawat" })).toBeVisible({ timeout: 45_000 });
    await expectShellReady(page);
    const createBtn = page.getByRole("button", { name: /buat penerbangan/i }).first();
    await expect(createBtn).toBeVisible({ timeout: 15000 });
    await createBtn.click();
    await expect(page.getByRole("heading", { name: "Tambah penerbangan baru" })).toBeVisible();
    await page.getByRole("button", { name: /Buat Penerbangan/i }).click();
    await expect(page.locator(".form-field-error").first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
  });

});

test.describe("@error-audit Settings admin flows", () => {
  test("invite invalid email shows popup", async ({ page }) => {
    await loginViaApi(page, adminEmail);
    await page.goto(`${baseURL}/settings`, { waitUntil: "domcontentloaded" });
    await expectShellReady(page);
    await page.getByRole("button", { name: "Tambah Pengguna" }).click();
    const inviteDrawer = page.locator(".ops-drawer-panel").filter({ has: page.getByRole("heading", { name: "Tambah Pengguna" }) });
    await inviteDrawer.getByPlaceholder("Nama").fill("QA Audit");
    await inviteDrawer.getByPlaceholder("Surel").fill("not-an-email");
    await inviteDrawer.getByRole("button", { name: "Simpan" }).click();
    await expectAlertDialog(page, /Input Tidak Valid/i);
  });
});

test.describe("@error-audit Route coverage manifest", () => {
  const staffRoutes = [
    "/dashboard",
    "/shipment-ledger",
    "/awb-tracking",
    "/flight-board",
    "/alerts",
    "/activity-log",
    "/complaints",
    "/settings",
  ];

  test.beforeEach(async ({ page }) => {
    await loginPage(page);
  });

  for (const route of staffRoutes) {
    test(`renders ${route}`, async ({ page }) => {
      await page.goto(`${baseURL}${route}`, { waitUntil: "domcontentloaded" });
      await expectShellReady(page);
      if (route === "/dashboard") {
        await expect(page.getByText("Pusat Kendali").first()).toBeVisible();
      } else if (route === "/awb-tracking") {
        await expect(page.locator("#awb-tracking-input")).toBeVisible();
      } else {
        await expect(page.locator("h1").first()).toBeAttached();
      }
    });
  }

  test("/reports redirects to dashboard", async ({ page }) => {
    await page.goto(`${baseURL}/reports`, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("sidebar does not include Laporan link", async ({ page }) => {
    await page.goto(`${baseURL}/dashboard`, { waitUntil: "domcontentloaded" });
    await expectShellReady(page);
    await expect(page.locator('.sidebar-nav a[href="/reports"]')).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Laporan", exact: true })).toHaveCount(0);
  });
});

test.describe("@error-audit Auth API (/api/auth/*)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("login rejects invalid credentials with JSON error", async ({ request }) => {
    const response = await request.post(`${baseURL}/api/auth/login`, {
      data: { email: staffEmail, password: "wrong-password-qa", remember: false },
    });
    expect(response.status()).toBe(401);
    const body = (await response.json()) as { error?: string; code?: string };
    expect(body.error).toBeTruthy();
    expect(body.code).toBe("invalid_credentials");
  });

  test("protected API returns 401 without session", async ({ request }) => {
    const response = await request.get(`${baseURL}/api/dashboard`);
    expect(response.status()).toBe(401);
  });

  test("logout clears session", async ({ request }) => {
    await loginViaApiRequest(request, staffEmail);
    expect((await request.get(`${baseURL}/api/dashboard`)).status()).toBe(200);
    await request.post(`${baseURL}/api/auth/logout`);
    expect((await request.get(`${baseURL}/api/dashboard`)).status()).toBe(401);
  });

  test("customer login is disabled (Opsi A public tracking)", async ({ request }) => {
    const customerEmail = process.env.QA_CUSTOMER_EMAIL ?? "customer@skyhub.test";
    const response = await request.post(`${baseURL}/api/auth/login`, {
      data: { email: customerEmail, password, remember: false },
    });
    expect(response.status()).toBe(403);
    const body = (await response.json()) as { code?: string };
    expect(body.code).toBe("customer_login_disabled");
  });
});

test.describe("@error-audit Network failure surfaces feedback banner", () => {
  test("dashboard load failure", async ({ page }) => {
    test.setTimeout(90_000);
    await page.request.post(`${baseURL}/api/auth/intro`, { maxRedirects: 0 }).catch(() => undefined);
    await loginViaApi(page);
    await page.route("**/api/dashboard**", (route) => route.abort("failed"));
    await page.goto(`${baseURL}/dashboard`, { waitUntil: "domcontentloaded" });
    await expectFeedbackBanner(page, /Gagal memuat dasbor/i, "error");
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
  });

  test("dashboard alerts failure keeps KPI visible with warning banner", async ({ page }) => {
    test.setTimeout(90_000);
    await page.request.post(`${baseURL}/api/auth/intro`, { maxRedirects: 0 }).catch(() => undefined);
    await loginViaApi(page);
    await page.route("**/api/dashboard**", abortDashboardAlertsOnly);
    await page.goto(`${baseURL}/dashboard`, { waitUntil: "domcontentloaded" });
    await expectShellReady(page);
    await expect(page.getByText("Pusat Kendali").first()).toBeVisible({ timeout: 30000 });
    await expectFeedbackBanner(page, /Peringatan belum bisa dimuat/i, "warning");
  });
});

async function expectOpaqueOverlay(page: Page, selector: string) {
  const locator = page.locator(selector).first();
  await expect(locator).toBeAttached({ timeout: 15000 });
  await expect
    .poll(
      async () =>
        locator.evaluate((node) => {
          const computed = getComputedStyle(node);
          const backdrop = computed.backdropFilter || computed.getPropertyValue("-webkit-backdrop-filter");
          if (backdrop && backdrop !== "none") return false;
          const bg = computed.backgroundColor;
          if (!bg || bg === "transparent" || bg === "rgba(0, 0, 0, 0)") return false;
          const rgba = bg.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
          if (rgba && Number(rgba[4]) < 1) return false;
          return Number(computed.opacity) >= 0.99;
        }),
      { timeout: 15000 },
    )
    .toBe(true);
}

test.describe("@error-audit Operator overlays opaque + no blur", () => {
  test.beforeEach(async ({ page }) => {
    await loginPage(page);
  });

  test("shipment ledger list failure uses banner not alertdialog", async ({ page }) => {
    test.setTimeout(90_000);
    await page.route("**/api/shipments**", (route) => route.abort("failed"));
    await page.goto(`${baseURL}/shipment-ledger`, { waitUntil: "domcontentloaded" });
    await expectShellReady(page);
    await expectFeedbackBanner(page, /Gagal memuat daftar/i, "error");
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
  });

  test("drawer overlay class is opaque without backdrop blur", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto(`${baseURL}/dashboard`, { waitUntil: "domcontentloaded" });
    await expectShellReady(page);
    await page.waitForFunction(
      () => {
        const probe = document.createElement("div");
        probe.className = "ops-overlay ops-overlay--drawer";
        probe.style.cssText = "position:fixed;inset:0;pointer-events:none;";
        document.body.appendChild(probe);
        const computed = getComputedStyle(probe);
        const backdrop = computed.backdropFilter || computed.getPropertyValue("-webkit-backdrop-filter");
        const bg = computed.backgroundColor;
        const opaque =
          (!backdrop || backdrop === "none") &&
          Boolean(bg) &&
          bg !== "transparent" &&
          bg !== "rgba(0, 0, 0, 0)";
        probe.remove();
        return opaque;
      },
      undefined,
      { timeout: 30000 },
    );
    await page.evaluate(() => {
      document.getElementById("qa-drawer-overlay-probe")?.remove();
      const node = document.createElement("div");
      node.id = "qa-drawer-overlay-probe";
      node.className = "ops-overlay ops-overlay--drawer";
      node.style.pointerEvents = "none";
      document.body.appendChild(node);
    });
    await expectOpaqueOverlay(page, "#qa-drawer-overlay-probe");
    await page.evaluate(() => document.getElementById("qa-drawer-overlay-probe")?.remove());
  });

  test("alertdialog overlay is opaque without backdrop blur", async ({ page }) => {
    await page.goto(`${baseURL}/awb-tracking`, { waitUntil: "domcontentloaded" });
    await expectShellReady(page);
    await page.locator("#awb-tracking-input").fill("BAD");
    await page.getByRole("button", { name: /lacak/i }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await expectOpaqueOverlay(page, ".ops-overlay--alert");
    await page.getByRole("button", { name: /^OK$/i }).click();
  });

  test("dark mode keeps error banner and overlays opaque", async ({ page }) => {
    test.setTimeout(90_000);
    await page.route("**/api/shipments**", (route) => route.abort("failed"));
    await page.goto(`${baseURL}/shipment-ledger`, { waitUntil: "domcontentloaded" });
    await expectShellReady(page);
    await page.evaluate(() => {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    });
    await expectFeedbackBanner(page, /Gagal memuat daftar/i, "error");
    const bannerBg = await page.locator(".ops-feedback-banner--error").first().evaluate((node) => {
      const computed = getComputedStyle(node);
      return { backgroundColor: computed.backgroundColor, backdropFilter: computed.backdropFilter };
    });
    expect(bannerBg.backdropFilter).toBe("none");
    expect(bannerBg.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
  });
});