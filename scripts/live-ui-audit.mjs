/**
 * Live interactive UI audit — Petugas operator bandara Kelas C persona.
 * Run: APP_BASE_URL=http://localhost:3100 node scripts/live-ui-audit.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3100";
const loginEmail = process.env.QA_LOGIN_EMAIL ?? "staff@skyhub.test";
const loginPassword = process.env.QA_LOGIN_PASSWORD ?? "operator123";
const headed = process.env.QA_HEADED !== "0";
const outDir = path.resolve("test-results/live-audit");

/** @type {Array<{id: string, severity: string, page: string, title: string, steps: string, personaImpact: string, suggestedFix: string, screenshot?: string}>} */
const findings = [];
let findingCounter = 0;

function routeUrl(route) {
  return new URL(route, baseUrl).toString();
}

function addFinding({ severity, page, title, steps, personaImpact, suggestedFix, screenshot }) {
  findings.push({
    id: `LIVE-${String(++findingCounter).padStart(3, "0")}`,
    severity,
    page,
    title,
    steps,
    personaImpact,
    suggestedFix,
    screenshot: screenshot ?? undefined,
  });
}

async function shot(page, name) {
  const file = `${name}.png`;
  await page.screenshot({ path: path.join(outDir, file), fullPage: false });
  return file;
}

async function shotFull(page, name) {
  const file = `${name}.png`;
  await page.screenshot({ path: path.join(outDir, file), fullPage: true });
  return file;
}

async function getOverflow(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    return Math.max(0, Math.ceil(Math.max(root.scrollWidth, document.body.scrollWidth) - root.clientWidth));
  });
}

async function checkOverflow(page, pageName, viewportLabel, threshold = 2) {
  const overflow = await getOverflow(page);
  if (overflow > threshold) {
    const ss = await shot(page, `${pageName.replace(/\//g, "_")}-overflow-${viewportLabel}`);
    addFinding({
      severity: viewportLabel === "mobile" ? "high" : "medium",
      page: pageName,
      title: `Overflow horizontal ${overflow}px (${viewportLabel})`,
      steps: `Buka ${pageName} pada viewport ${viewportLabel}, perhatikan scroll horizontal.`,
      personaImpact: "Operator harus geser layar untuk baca kolom penting — memperlambat keputusan di shift panjang.",
      suggestedFix: "Perketat min-width tabel, aktifkan scroll terkontrol di wrapper tabel, atau sembunyikan kolom non-kritis di mobile tanpa mengubah bahasa visual.",
      screenshot: ss,
    });
  }
  return overflow;
}

async function checkSmallTouchTargets(page, pageName, selector = "button, a, [role='button'], input[type='checkbox']") {
  const small = await page.evaluate((sel) => {
    const min = 44;
    const items = [];
    document.querySelectorAll(sel).forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none" || style.pointerEvents === "none") return;
      if (rect.bottom < 0 || rect.top > window.innerHeight) return;
      if (rect.width < min || rect.height < min) {
        const label =
          el.getAttribute("aria-label") ||
          el.textContent?.trim().slice(0, 40) ||
          el.className?.toString().slice(0, 30) ||
          sel;
        items.push({ label, w: Math.round(rect.width), h: Math.round(rect.height) });
      }
    });
    return items.slice(0, 8);
  }, selector);

  if (small.length >= 3) {
    addFinding({
      severity: "medium",
      page: pageName,
      title: `${small.length}+ target sentuh < 44px`,
      steps: `Buka ${pageName}, periksa tombol/link yang terlihat.`,
      personaImpact: "Sarung tangan / layar basah / kecepatan tap — target kecil meningkatkan salah tekan.",
      suggestedFix: "Naikkan min-height/min-width interaktif ke 44px via padding pada kelas tombol yang ada, tanpa mengubah palet atau radius.",
      screenshot: undefined,
    });
  }
}

async function measureGlassReadability(page, contextLabel) {
  return page.evaluate((label) => {
    const results = [];
    const selectors = [
      ".liquid-glass-panel",
      ".liquid-glass-dropdown",
      ".dropdown-panel",
      ".premium-glass",
      ".glass-select-trigger",
      ".glass-date-trigger",
      ".ops-drawer-panel",
      ".confirm-panel",
    ];
    for (const sel of selectors) {
      document.querySelectorAll(sel).forEach((panel) => {
        const rect = panel.getBoundingClientRect();
        if (rect.width < 40 || rect.height < 20) return;
        const style = getComputedStyle(panel);
        const bg = style.backgroundColor;
        const blur = style.backdropFilter || style.webkitBackdropFilter || "";
        const opacity = Number.parseFloat(style.opacity || "1");
        const textEl = panel.querySelector("p, span, label, button, h2, h3, td, th, input") ?? panel;
        const textStyle = getComputedStyle(textEl);
        const color = textStyle.color;
        const parseRgb = (c) => {
          const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
          return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
        };
        const rgb = parseRgb(color);
        const luminance = rgb ? (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255 : null;
        const hasHeavyBlur = /blur\((1[6-9]|[2-9]\d)px\)/.test(blur);
        const lowContrastRisk = luminance !== null && luminance > 0.82 && hasHeavyBlur;
        if (hasHeavyBlur || lowContrastRisk) {
          results.push({
            selector: sel,
            blur,
            bg,
            textColor: color,
            luminance,
            lowContrastRisk,
            context: label,
          });
        }
      });
    }
    return results.slice(0, 6);
  }, contextLabel);
}

async function primeIntro(page) {
  await page.request.post(routeUrl("/api/auth/intro"), { maxRedirects: 0 });
}

async function apiLogin(page) {
  await primeIntro(page);
  const res = await page.request.post(routeUrl("/api/auth/login"), {
    data: { email: loginEmail, password: loginPassword, remember: false },
  });
  if (!res.ok()) throw new Error(`API login failed: ${res.status()}`);
}

async function dismissOverlays(page) {
  for (let i = 0; i < 6; i++) {
    const okBtn = page.getByRole("button", { name: /^OK$/i }).first();
    if (await okBtn.isVisible().catch(() => false)) {
      await okBtn.click();
      await page.waitForTimeout(300);
      continue;
    }
    const backdrop = page.locator(".liquid-glass-backdrop").first();
    if (!(await backdrop.isVisible().catch(() => false))) break;
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    await backdrop.click({ force: true, position: { x: 4, y: 4 } }).catch(() => {});
    await page.waitForTimeout(200);
  }
}

async function uiLogin(page) {
  await dismissOverlays(page);
  await page.goto(routeUrl("/login"), { waitUntil: "domcontentloaded" });
  await dismissOverlays(page);
  await page.locator('input[type="email"]').fill(loginEmail);
  await page.locator('input[type="password"], input[type="text"]').fill(loginPassword);
  const submit = page.locator('form button[type="submit"]');
  await submit.click({ timeout: 8000 }).catch(async () => {
    await dismissOverlays(page);
    await submit.click({ force: true });
  });
  await page.waitForURL("**/dashboard", { timeout: 20000 });
}

function validAwb(prefix = "160") {
  const serial7 = `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-7).padStart(7, "0");
  const checkDigit = parseInt(serial7, 10) % 7;
  return `${prefix}-${serial7}${checkDigit}`;
}

async function assertAuthenticated(page, route) {
  if (page.url().includes("/login")) {
    addFinding({
      severity: "critical",
      page: route,
      title: "Redirect ke login — sesi tidak aktif",
      steps: `Buka ${route} setelah login.`,
      personaImpact: "Modul operasional tidak bisa dibuka di tengah shift.",
      suggestedFix: "Periksa cookie auth dan middleware; pastikan QA user aktif.",
    });
    return false;
  }
  return true;
}

async function waitForRouteContent(page, route) {
  const waits = {
    "/dashboard": ".dashboard-summary-strip",
    "/shipment-ledger": 'h2:has-text("Manifest aktif"), h1',
    "/flight-board": "h1",
    "/alerts": "h1",
    "/activity-log": "h1",
    "/complaints": "h1",
    "/settings": "h1",
    "/awb-tracking": "#awb-tracking-input",
  };
  const sel = waits[route];
  if (sel) {
    await page.locator(sel).first().waitFor({ state: "visible", timeout: 20000 }).catch(() => {});
  }
  await page.waitForTimeout(500);
}

// ─── Flow auditors ───────────────────────────────────────────────────────────

async function auditAboutUs(page) {
  await page.goto(routeUrl("/about-us"), { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  await shot(page, "01-about-us-hero");

  const masukOperator = page.getByRole("button", { name: /Masuk Operator/i });
  if (!(await masukOperator.isVisible().catch(() => false))) {
    addFinding({
      severity: "critical",
      page: "/about-us",
      title: "CTA Masuk Operator tidak terlihat",
      steps: "Buka /about-us hero section.",
      personaImpact: "Tidak ada pintu masuk jelas ke sistem operasional.",
      suggestedFix: "Pastikan tombol Masuk Operator tetap di hero dengan kontras biru solid.",
    });
  } else {
    await masukOperator.click();
    await page.waitForTimeout(800);
    await shot(page, "01-about-us-login-redirect");
    if (!page.url().includes("/login")) {
      addFinding({
        severity: "high",
        page: "/about-us",
        title: "Masuk Operator tidak mengarah ke halaman login",
        steps: 'Klik "Masuk Operator" di hero.',
        personaImpact: "Operator bingung cara masuk — membuang waktu di shift.",
        suggestedFix: "Pastikan router.push('/login') atau setModalOpen(true) konsisten.",
        screenshot: "01-about-us-login-redirect.png",
      });
    }
    await page.goto(routeUrl("/about-us"), { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
  }

  // Premium login modal exists in code but has no trigger — document if unreachable
  const hasDeadModal = await page.evaluate(() => {
    const modal = document.querySelector(".premium-login-modal");
    return Boolean(modal) && !modal?.checkVisibility?.();
  });
  if (hasDeadModal) {
    addFinding({
      severity: "low",
      page: "/about-us",
      title: "Modal login premium ada di DOM tetapi tidak pernah dibuka",
      steps: "Cari tombol yang membuka LiquidGlassOverlay login di /about-us.",
      personaImpact: "Tidak langsung — alur saat ini lewat /login terpisah.",
      suggestedFix: "Hapus modal mati atau hubungkan nav sticky ke setModalOpen(true) untuk login tanpa navigasi.",
    });
  }

  await page.getByRole("button", { name: /Cek Resi Publik/i }).click().catch(() => {});
  await page.waitForTimeout(1000);
  const trackingSection = await page.getByText(/CEK RESI LANGSUNG|NOMOR RESI/i).first().isVisible().catch(() => false);
  await shot(page, "01-about-us-tracking");
  if (!trackingSection) {
    addFinding({
      severity: "medium",
      page: "/about-us#tracking",
      title: "Seksi pelacakan publik sulit dijangkau",
      steps: 'Klik "Cek Resi Publik" atau buka /about-us#tracking.',
      personaImpact: "Operator mengarahkan penumpang ke link yang tidak scroll ke form.",
      suggestedFix: "Pastikan scrollToSection('tracking') dan hash #tracking konsisten dengan offset nav.",
    });
  }

  const awbInput = page.locator('input[placeholder*="45678901"], input[placeholder*="resi" i]').first();
  if (await awbInput.isVisible().catch(() => false)) {
    await awbInput.fill("000-00000000");
    await page.getByRole("button", { name: /LACAK|CEK RESI/i }).first().click().catch(() => {});
    await page.waitForTimeout(1500);
    await shot(page, "01-about-us-tracking-invalid");
    const err = await page.getByText(/tidak valid|tidak ditemukan|format/i).isVisible().catch(() => false);
    if (!err) {
      addFinding({
        severity: "medium",
        page: "/about-us#tracking",
        title: "Feedback AWB invalid tidak jelas",
        steps: "Masukkan AWB invalid di pelacakan publik, submit.",
        personaImpact: "Penumpang/operator tidak tahu format resi yang benar.",
        suggestedFix: "Tampilkan pesan validasi inline di bawah input (sudah ada pola trackingError).",
      });
    }
  }

  await page.evaluate(() => {
    const el = document.getElementById("complaint") ?? document.querySelector('[id*="complaint"]');
    el?.scrollIntoView({ behavior: "instant", block: "start" });
  });
  await page.waitForTimeout(800);
  await shotFull(page, "01-about-us-complaint-section");
  const complaintForm = page.locator('form').filter({ has: page.getByText(/KIRIM KELUHAN/i) }).first();
  if (await complaintForm.isVisible().catch(() => false)) {
    await page.getByRole("button", { name: /KIRIM KELUHAN/i }).click();
    await page.waitForTimeout(800);
    await shot(page, "01-about-us-complaint-validation");
  }

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.5));
  await page.waitForTimeout(500);
  await shot(page, "01-about-us-scroll-mid");

  await checkOverflow(page, "/about-us", "desktop");
}

async function auditLogin(page) {
  await page.context().clearCookies();
  await page.goto(routeUrl("/login"), { waitUntil: "domcontentloaded" });
  await shot(page, "02-login-default");

  const demoButtons = page.locator("button").filter({ hasText: /Administrator|Staf|Pelanggan/ });
  const demoCount = await demoButtons.count();
  if (demoCount < 2) {
    addFinding({
      severity: "low",
      page: "/login",
      title: "Akun demo tidak terlihat lengkap",
      steps: "Buka /login, cek panel akun demo.",
      personaImpact: "Onboarding shift baru lebih lambat.",
      suggestedFix: "Tampilkan ketiga kartu demo dengan tombol isi otomatis.",
    });
  } else {
    await demoButtons.filter({ hasText: "Staf" }).first().click();
    await page.waitForTimeout(300);
    const emailVal = await page.locator('input[type="email"]').inputValue();
    if (emailVal !== loginEmail) {
      addFinding({
        severity: "medium",
        page: "/login",
        title: "Tombol demo Staf tidak mengisi surel",
        steps: 'Klik kartu demo "Staf".',
        personaImpact: "Operator mengira akun demo rusak.",
        suggestedFix: "Perbaiki handler fillAccount pada kartu demo.",
      });
    }
  }

  await page.locator('input[type="email"]').fill("");
  await page.locator('input[type="password"], input[type="text"]').fill("");
  await page.locator('form button[type="submit"]').click();
  await page.waitForTimeout(600);
  const emptyAlert = await page.getByText(/Input Tidak Valid|wajib diisi/i).first().isVisible().catch(() => false);
  if (emptyAlert) {
    await page.getByRole("button", { name: /^OK$/i }).click().catch(() => {});
    await page.waitForTimeout(400);
  }
  const validationVisible =
    (await page.getByText(/wajib diisi/i).count()) > 0 ||
    (await page.getByText(/Input Tidak Valid/i).count()) > 0;
  await shot(page, "02-login-validation-empty");
  if (!validationVisible) {
    addFinding({
      severity: "high",
      page: "/login",
      title: "Validasi kosong tidak jelas",
      steps: "Kosongkan form, klik Masuk.",
      personaImpact: "Form gagal tanpa petunjuk — operator mengira sistem down.",
      suggestedFix: "Tampilkan error inline di field + alert ringkas (sudah ada pola showAlert).",
      screenshot: "02-login-validation-empty.png",
    });
  }

  await page.locator('input[type="email"]').fill("wrong@skyhub.test");
  await page.locator('input[type="password"], input[type="text"]').fill("badpass");
  await page.locator('form button[type="submit"]').click();
  await page.waitForTimeout(1200);
  await shot(page, "02-login-wrong-creds");
  const credError =
    (await page.getByText(/kredensial|salah|tidak valid|gagal/i).count()) > 0 ||
    (await page.locator('[role="alertdialog"], .liquid-glass-panel-alert').count()) > 0;
  const backdropBlocks = await page.locator(".liquid-glass-backdrop").first().isVisible().catch(() => false);
  if (backdropBlocks) {
    const submitBlocked = await page
      .locator('form button[type="submit"]')
      .click({ trial: true, timeout: 2000 })
      .then(() => false)
      .catch(() => true);
    if (submitBlocked) {
      addFinding({
        severity: "high",
        page: "/login",
        title: "Backdrop alert glass memblokir submit form setelah error",
        steps: "Submit kredensial salah; coba klik Masuk lagi tanpa menutup dialog OK.",
        personaImpact: "Operator terkunci — tidak bisa retry login tanpa mencari tombol tutup.",
        suggestedFix: "Tutup backdrop saat AlertDialog onOk, atau jangan render backdrop penuh di atas form login.",
        screenshot: "02-login-wrong-creds.png",
      });
    }
    await page.getByRole("button", { name: /^OK$/i }).click().catch(() => {});
    await page.waitForTimeout(400);
  }

  if (!credError && !backdropBlocks) {
    addFinding({
      severity: "medium",
      page: "/login",
      title: "Error kredensial salah kurang terbaca",
      steps: "Masukkan surel/kata sandi salah, submit.",
      personaImpact: "Operator bingung apakah jaringan atau akun yang bermasalah.",
      suggestedFix: "Pastikan alert error tetap di atas form dengan judul terstruktur dari getLoginErrorDetail.",
    });
  }

  await dismissOverlays(page);
  await apiLogin(page);
  await page.goto(routeUrl("/dashboard"), { waitUntil: "domcontentloaded" });
  await waitForRouteContent(page, "/dashboard");
  const onDashboard = page.url().includes("/dashboard");
  if (!onDashboard) {
    addFinding({
      severity: "critical",
      page: "/login",
      title: "Login API tidak mengarahkan ke dashboard",
      steps: "POST /api/auth/login lalu buka /dashboard.",
      personaImpact: "Sesi tidak terbentuk — seluruh modul operasional tidak bisa diakses.",
      suggestedFix: "Periksa cookie session dan middleware auth pada port dev.",
    });
  }
}

async function auditDashboard(page) {
  await page.goto(routeUrl("/dashboard"), { waitUntil: "domcontentloaded" });
  if (!(await assertAuthenticated(page, "/dashboard"))) return;
  await waitForRouteContent(page, "/dashboard");
  await shot(page, "03-dashboard-default");

  const summaryLinks = page.locator(".dashboard-summary-strip a");
  const linkCount = await summaryLinks.count();
  if (linkCount === 0) {
    addFinding({
      severity: "critical",
      page: "/dashboard",
      title: "Strip ringkasan dashboard kosong",
      steps: "Login sebagai staf, buka /dashboard.",
      personaImpact: "Tidak ada pintasan ke modul kritis di awal shift.",
      suggestedFix: "Pastikan API /api/dashboard mengisi summary strip.",
    });
  } else {
    for (let i = 0; i < Math.min(linkCount, 3); i++) {
      const href = await summaryLinks.nth(i).getAttribute("href");
      if (href) {
        await summaryLinks.nth(i).click();
        await page.waitForTimeout(600);
        await page.goBack({ waitUntil: "domcontentloaded" });
        await waitForRouteContent(page, "/dashboard");
      }
    }
  }

  const dateFilter = page.locator('input[type="date"], .glass-date-trigger, button[aria-label*="tanggal"], button[aria-label*="Tanggal"]').first();
  if (await dateFilter.isVisible().catch(() => false)) {
    await dateFilter.click();
    await page.waitForTimeout(500);
    await shot(page, "03-dashboard-date-picker");
    const glass = await measureGlassReadability(page, "dashboard-date");
    if (glass.length) {
      addFinding({
        severity: "low",
        page: "/dashboard",
        title: "Date picker memakai efek glass/blur",
        steps: "Klik filter tanggal di dashboard.",
        personaImpact: "Kalender di bawah cahaya kuat bisa kurang tajam.",
        suggestedFix: "Gunakan latar solid --panel-bg pada popover kalender; pertahankan border radius.",
        screenshot: "03-dashboard-date-picker.png",
      });
    }
    await page.keyboard.press("Escape");
  }

  await page.getByRole("button", { name: /Pemberitahuan/i }).click().catch(() => {});
  await page.waitForTimeout(500);
  await shot(page, "03-dashboard-notifications");
  await page.keyboard.press("Escape");

  await checkOverflow(page, "/dashboard", "desktop");
}

async function auditShipmentLedger(page) {
  await page.goto(routeUrl("/shipment-ledger"), { waitUntil: "domcontentloaded" });
  await waitForRouteContent(page, "/shipment-ledger");
  await shot(page, "04-shipment-ledger-default");

  const createBtn = page.getByRole("button", { name: /^Buat$/i }).first();
  if (!(await createBtn.isVisible().catch(() => false))) {
    addFinding({
      severity: "high",
      page: "/shipment-ledger",
      title: "Tombol buat pengiriman tidak ditemukan",
      steps: "Buka Buku Pengiriman.",
      personaImpact: "Tidak bisa input AWB baru — blokir operasi.",
      suggestedFix: "Pastikan CTA Buat Pengiriman di header manifest tetap visible.",
    });
    return;
  }

  await createBtn.click();
  await page.waitForTimeout(700);
  await shot(page, "04-shipment-ledger-create-drawer");
  const drawer = page.locator(".ops-drawer-panel, .liquid-glass-panel-drawer").first();
  if (!(await drawer.isVisible().catch(() => false))) {
    addFinding({
      severity: "high",
      page: "/shipment-ledger",
      title: "Drawer buat pengiriman tidak terbuka",
      steps: 'Klik "Buat Pengiriman".',
      personaImpact: "Alur utama manifest terputus.",
      suggestedFix: "Periksa state OpsDrawer open + z-index overlay.",
      screenshot: "04-shipment-ledger-create-drawer.png",
    });
  } else {
    const drawerBox = await drawer.boundingBox();
    const viewport = page.viewportSize();
    if (drawerBox && viewport && drawerBox.y + drawerBox.height > viewport.height - 8) {
      addFinding({
        severity: "medium",
        page: "/shipment-ledger",
        title: "Drawer create terpotong di bawah viewport",
        steps: 'Buka drawer "Buat Pengiriman", cek footer tombol simpan.',
        personaImpact: "Tombol simpan tidak terlihat tanpa scroll — membingungkan di shift cepat.",
        suggestedFix: "Pastikan footer sticky OpsDrawer + body scroll internal (flex min-h-0).",
        screenshot: "04-shipment-ledger-create-drawer.png",
      });
    }
    const glass = await measureGlassReadability(page, "ledger-create-drawer");
    if (glass.some((g) => g.lowContrastRisk)) {
      addFinding({
        severity: "medium",
        page: "/shipment-ledger",
        title: "Kontras form drawer pengiriman rendah",
        steps: "Buka drawer buat pengiriman.",
        personaImpact: "Field AWB/komoditas sulit dibaca cepat.",
        suggestedFix: "Perkuat --glass-panel-bg-strong pada .ops-drawer-panel tanpa menghapus blur.",
      });
    }
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
  }

  const firstRow = page.locator("table tbody tr, [aria-label*='Buka detail AWB']").first();
  if (await firstRow.isVisible().catch(() => false)) {
    await firstRow.click();
    await page.waitForTimeout(800);
    await shot(page, "04-shipment-ledger-detail");

    const editBtn = page.getByRole("button", { name: /Ubah|Perbarui/i }).first();
    if (await editBtn.isVisible().catch(() => false)) {
      await editBtn.click();
      await page.waitForTimeout(600);
      await shot(page, "04-shipment-ledger-edit-drawer");
      await page.keyboard.press("Escape");
    }
  }

  const exportLink = page.locator('a[href*="/exports/shipments"]').first();
  if (await exportLink.isVisible().catch(() => false)) {
    const target = await exportLink.getAttribute("target");
    if (target !== "_blank") {
      addFinding({
        severity: "low",
        page: "/shipment-ledger",
        title: "Ekspor manifest tidak membuka tab baru",
        steps: "Periksa link cetak/ekspor di header.",
        personaImpact: "Operator kehilangan konteks filter saat cetak.",
        suggestedFix: 'Tambahkan target="_blank" rel="noopener" pada link ekspor.',
      });
    }
  }

  const filterSelect = page.locator(".glass-select-trigger").first();
  if (await filterSelect.isVisible().catch(() => false)) {
    await filterSelect.click();
    await page.waitForTimeout(500);
    await shot(page, "04-shipment-ledger-glass-select");
    await page.keyboard.press("Escape");
  }

  await checkOverflow(page, "/shipment-ledger", "desktop");

  // Create + delete test shipment via UI
  const testAwb = validAwb();
  await createBtn.click();
  await page.waitForTimeout(600);
  const commodity = page.locator('[data-field="commodity"] input, input[placeholder*="komoditas" i]').first();
  if (await commodity.isVisible().catch(() => false)) {
    await page.locator('input').filter({ has: page.locator('[data-field]') }).first().catch(() => {});
    const awbField = page.locator('input').filter({ hasNot: page.locator("[readonly]") }).nth(0);
    const fields = page.locator(".ops-drawer-panel input.input-field:not([readonly]):not([disabled])");
    const count = await fields.count();
    for (let i = 0; i < count; i++) {
      const ph = (await fields.nth(i).getAttribute("placeholder")) ?? "";
      const label = (await fields.nth(i).getAttribute("aria-label")) ?? "";
      if (/awb|resi/i.test(ph + label)) await fields.nth(i).fill(testAwb);
    }
    await commodity.fill("QA Audit Cargo");
    const origin = page.locator('input[placeholder*="CGK"], input[aria-label*="Asal" i]').first();
    const dest = page.locator('input[placeholder*="DPS"], input[aria-label*="Tujuan" i]').first();
    if (await origin.isVisible().catch(() => false)) await origin.fill("CGK");
    if (await dest.isVisible().catch(() => false)) await dest.fill("DPS");
    await page.getByRole("button", { name: /Buat Pengiriman/i }).last().click();
    await page.waitForTimeout(2500);
    await shot(page, "04-shipment-ledger-after-create");
  }
}

async function auditAwbTracking(page, knownAwb) {
  await page.goto(routeUrl("/awb-tracking"), { waitUntil: "domcontentloaded" });
  await waitForRouteContent(page, "/awb-tracking");
  await shot(page, "05-awb-tracking-default");

  const input = page.locator("#awb-tracking-input");
  const awb = knownAwb ?? "160-0000000";
  await input.fill(awb);
  await page.getByRole("button", { name: /Lacak|Cari/i }).first().click().catch(() => input.press("Enter"));
  await page.waitForTimeout(2000);
  await shot(page, "05-awb-tracking-result");

  const timeline = await page.getByText(/Linimasa Pelacakan/i).isVisible().catch(() => false);
  if (knownAwb && !timeline) {
    addFinding({
      severity: "high",
      page: "/awb-tracking",
      title: "Hasil pelacakan AWB valid tidak muncul",
      steps: `Cari AWB ${knownAwb}.`,
      personaImpact: "Operator tidak bisa konfirmasi status ke shipper — eskalasi telepon.",
      suggestedFix: "Periksa binding query ?awb= dan render linimasa.",
      screenshot: "05-awb-tracking-result.png",
    });
  }

  const reportBtn = page.getByRole("button", { name: /Laporkan Isu/i });
  if (knownAwb && (await reportBtn.isEnabled().catch(() => false))) {
    await reportBtn.click();
    await page.waitForTimeout(1500);
    await shot(page, "05-awb-tracking-report-issue");
  } else if (knownAwb) {
    addFinding({
      severity: "medium",
      page: "/awb-tracking",
      title: "Tombol Laporkan Isu nonaktif setelah hasil",
      steps: "Lacak AWB valid, coba laporkan isu.",
      personaImpact: "Tidak bisa eskalasi exception dari modul pelacakan.",
      suggestedFix: "Aktifkan tombol setelah shipment loaded; pertahankan tooltip penjelas.",
    });
  }

  const recent = page.getByText(/Pencarian Terakhir|Riwayat/i).first();
  if (await recent.isVisible().catch(() => false)) {
    const recentItem = page.locator("button, a").filter({ hasText: /\d{3}-\d+/ }).first();
    if (await recentItem.isVisible().catch(() => false)) {
      await recentItem.click();
      await page.waitForTimeout(1000);
      await shot(page, "05-awb-tracking-recent");
    }
  }

  await checkOverflow(page, "/awb-tracking", "desktop");
}

async function auditFlightBoard(page) {
  await page.goto(routeUrl("/flight-board"), { waitUntil: "domcontentloaded" });
  await waitForRouteContent(page, "/flight-board");
  await shot(page, "06-flight-board-default");

  const searchInput = page.locator("#flightboard-query, input[placeholder*='penerbangan' i]").first();
  if (await searchInput.isVisible().catch(() => false)) {
    await searchInput.fill("GA");
    await page.getByRole("button", { name: /Cari/i }).first().click();
    await page.waitForTimeout(1200);
    await shot(page, "06-flight-board-search");
  }

  const dateTrigger = page.locator(".glass-date-trigger").first();
  if (await dateTrigger.isVisible().catch(() => false)) {
    await dateTrigger.click();
    await page.waitForTimeout(500);
    await shot(page, "06-flight-board-date-picker");
    await page.keyboard.press("Escape");
  }

  const statusFilter = page.locator(".glass-select-trigger").first();
  if (await statusFilter.isVisible().catch(() => false)) {
    await statusFilter.click();
    await page.waitForTimeout(500);
    await shot(page, "06-flight-board-glass-select");
    await page.keyboard.press("Escape");
  }

  const flightRow = page.locator("table tbody tr button, table tbody tr").first();
  if (await flightRow.isVisible().catch(() => false)) {
    await flightRow.click();
    await page.waitForTimeout(800);
    await shot(page, "06-flight-board-detail");
    const editBtn = page.getByRole("button", { name: /Ubah Penerbangan/i });
    if (await editBtn.isVisible().catch(() => false)) {
      await editBtn.click();
      await page.waitForTimeout(600);
      await shot(page, "06-flight-board-edit-drawer");
      await page.keyboard.press("Escape");
    }
  }

  const createBtn = page.getByRole("button", { name: /Buat Penerbangan/i }).first();
  if (await createBtn.isVisible().catch(() => false)) {
    await createBtn.click();
    await page.waitForTimeout(600);
    await shot(page, "06-flight-board-create-drawer");
    await page.keyboard.press("Escape");
  }

  await checkOverflow(page, "/flight-board", "desktop");
}

async function auditAlerts(page) {
  await page.goto(routeUrl("/alerts"), { waitUntil: "domcontentloaded" });
  await waitForRouteContent(page, "/alerts");
  await shot(page, "07-alerts-default");

  const detailBtn = page.getByRole("button", { name: /Buka detail/i }).first();
  if (await detailBtn.isVisible().catch(() => false)) {
    await detailBtn.click();
    await page.waitForTimeout(1000);
    await shot(page, "07-alerts-detail-drawer");

    const ackBtn = page.getByRole("button", { name: /Akui|Tandai|Kerjakan/i }).first();
    const resolveBtn = page.getByRole("button", { name: /Selesai|Resolve|Tutup/i }).first();
    const hasWorkflow = (await ackBtn.isVisible().catch(() => false)) || (await resolveBtn.isVisible().catch(() => false));
    if (!hasWorkflow) {
      const autoResolveNote = await page.getByText(/selesai otomatis|Perbaiki di/i).isVisible().catch(() => false);
      if (!autoResolveNote) {
        addFinding({
          severity: "medium",
          page: "/alerts",
          title: "Drawer detail alert tanpa aksi atau penjelasan workflow",
          steps: 'Klik "Buka detail" pada alert pertama.',
          personaImpact: "Operator tidak tahu langkah berikutnya untuk menutup peringatan.",
          suggestedFix: "Tampilkan CTA Akui/Selesai atau copy 'Perbaiki di [modul]' konsisten.",
          screenshot: "07-alerts-detail-drawer.png",
        });
      }
    }
    await page.keyboard.press("Escape");
  }

  const workflowFilter = page.locator("#alerts-workflow").first();
  if (await workflowFilter.isVisible().catch(() => false)) {
    await workflowFilter.click();
    await page.waitForTimeout(400);
    await shot(page, "07-alerts-workflow-filter");
  }

  await checkOverflow(page, "/alerts", "desktop");
}

async function auditActivityLog(page) {
  await page.goto(routeUrl("/activity-log"), { waitUntil: "domcontentloaded" });
  await waitForRouteContent(page, "/activity-log");
  await shot(page, "08-activity-log-default");

  const search = page.locator('input[placeholder*="log" i], input[placeholder*="Cari" i]').first();
  if (await search.isVisible().catch(() => false)) {
    await search.fill("pengiriman");
    await page.waitForTimeout(1200);
    await shot(page, "08-activity-log-search");
  }

  const nextPage = page.getByRole("button", { name: /Berikutnya|Next|›/i }).first();
  if (await nextPage.isEnabled().catch(() => false)) {
    await nextPage.click();
    await page.waitForTimeout(800);
    await shot(page, "08-activity-log-page2");
  }

  await checkOverflow(page, "/activity-log", "desktop");
}

async function auditComplaints(page) {
  await page.goto(routeUrl("/complaints"), { waitUntil: "domcontentloaded" });
  await waitForRouteContent(page, "/complaints");
  await shot(page, "09-complaints-default");

  const row = page.locator("table tbody tr").first();
  if (await row.isVisible().catch(() => false)) {
    await row.click();
    await page.waitForTimeout(600);
    await shot(page, "09-complaints-expanded");

    const statusBtn = page.getByRole("button", { name: /Tinjau|Eskalasi|Selesai|Tutup|Ubah status/i }).first();
    if (await statusBtn.isVisible().catch(() => false)) {
      await statusBtn.click();
      await page.waitForTimeout(600);
      await shot(page, "09-complaints-status-modal");
      await page.keyboard.press("Escape");
    }
  } else {
    addFinding({
      severity: "low",
      page: "/complaints",
      title: "Tidak ada data keluhan untuk uji ubah status",
      steps: "Buka Kotak Keluhan dengan DB kosong.",
      personaImpact: "Tidak bisa verifikasi alur status di audit ini.",
      suggestedFix: "Seed minimal 1 keluhan demo untuk QA.",
    });
  }

  const topicFilter = page.locator(".glass-select-trigger").nth(1);
  if (await topicFilter.isVisible().catch(() => false)) {
    await topicFilter.click();
    await page.waitForTimeout(400);
    await shot(page, "09-complaints-glass-select");
    await page.keyboard.press("Escape");
  }

  await checkOverflow(page, "/complaints", "desktop");
}

async function auditSettings(page) {
  await page.goto(routeUrl("/settings"), { waitUntil: "domcontentloaded" });
  await waitForRouteContent(page, "/settings");
  await shot(page, "10-settings-default");

  const profileTab = page.getByRole("button", { name: /Profil/i }).first();
  if (await profileTab.isVisible().catch(() => false)) {
    await profileTab.click();
    await page.waitForTimeout(400);
  }

  const themeLight = page.getByRole("button", { name: /Terang/i }).first();
  const themeDark = page.getByRole("button", { name: /Gelap/i }).first();
  if (await themeDark.isVisible().catch(() => false)) {
    await themeDark.click();
    await page.waitForTimeout(600);
    await shot(page, "10-settings-dark-theme");
    await themeLight.click();
    await page.waitForTimeout(400);
  }

  const notifToggle = page.locator('input[type="checkbox"], button[role="switch"]').first();
  if (await notifToggle.isVisible().catch(() => false)) {
    await notifToggle.click().catch(() => {});
    await page.waitForTimeout(300);
  }

  const userMgmt = page.getByText(/Manajemen Pengguna|Kelola pengguna/i).first();
  const canManageUsers = await userMgmt.isVisible().catch(() => false);
  if (canManageUsers) {
    addFinding({
      severity: "low",
      page: "/settings",
      title: "Seksi manajemen pengguna terlihat untuk akun staf",
      steps: "Login staff@skyhub.test, buka Pengaturan.",
      personaImpact: "Jika tombol aktif, staf bisa kira punya hak admin — kebingungan akses.",
      suggestedFix: "Sembunyikan sepenuhnya blok admin untuk non-admin (bukan hanya disable).",
    });
  } else {
    const inviteHidden = (await page.getByRole("button", { name: /Tambah Pengguna/i }).count()) === 0;
    if (!inviteHidden) {
      addFinding({
        severity: "high",
        page: "/settings",
        title: "Tombol Tambah Pengguna terlihat untuk staf",
        steps: "Login sebagai staf, buka Pengaturan.",
        personaImpact: "Klik sia-sia atau error 403 — merusak kepercayaan sistem.",
        suggestedFix: "Render CTA admin hanya jika permissions.canManageUsers.",
      });
    }
  }

  await checkOverflow(page, "/settings", "desktop");
}

async function auditMobile(_page, browser) {
  const mobileContext = await browser.newContext({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    locale: "id-ID",
    colorScheme: "light",
  });
  const page = await mobileContext.newPage();
  await apiLogin(page);
  const mobileRoutes = [
    "/dashboard",
    "/shipment-ledger",
    "/awb-tracking",
    "/flight-board",
    "/alerts",
  ];

  for (const route of mobileRoutes) {
    await page.goto(routeUrl(route), { waitUntil: "domcontentloaded" });
    await waitForRouteContent(page, route);
    const slug = route.replace(/\//g, "_");
    await shot(page, `11-mobile${slug}`);

    const hamburger = page.locator(".mobile-hamburger-trigger").first();
    const hamburgerDisplay = await hamburger.evaluate((el) => getComputedStyle(el).display).catch(() => "none");
    if (!(await hamburger.isVisible().catch(() => false))) {
      addFinding({
        severity: hamburgerDisplay === "none" ? "high" : "critical",
        page: route,
        title: "Hamburger menu tidak terlihat di mobile 375px",
        steps: `Set viewport 375px + touch UA, buka ${route}.`,
        personaImpact: "Tidak bisa navigasi antar modul di lapangan.",
        suggestedFix:
          hamburgerDisplay === "none"
            ? "Ganti media query dari (pointer: coarse) ke max-width: 1023px agar hamburger tampil di semua viewport sempit."
            : "Pastikan .mobile-hamburger-trigger tidak tertutup elemen topbar.",
        screenshot: `11-mobile${slug}.png`,
      });
    } else {
      await hamburger.click();
      await page.waitForTimeout(600);
      await shot(page, `11-mobile${slug}-sidebar`);
      const sidebar = page.locator(".liquid-glass-panel-sidebar, aside nav").first();
      if (!(await sidebar.isVisible().catch(() => false))) {
        addFinding({
          severity: "high",
          page: route,
          title: "Sidebar mobile tidak terbuka",
          steps: "Tap hamburger di 375px.",
          personaImpact: "Menu terkunci — operator terjebak di satu halaman.",
          suggestedFix: "Periksa state mobileOpen + LiquidGlassOverlay sidebar variant.",
          screenshot: `11-mobile${slug}-sidebar.png`,
        });
      }
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
    }

    await checkOverflow(page, route, "mobile");
    await checkSmallTouchTargets(page, route);
  }

  await mobileContext.close();
}

async function auditGlassEffects(page) {
  await page.goto(routeUrl("/shipment-ledger"), { waitUntil: "domcontentloaded" });
  await waitForRouteContent(page, "/shipment-ledger");

  const createBtn = page.getByRole("button", { name: /^Buat$/i }).first();
  if (await createBtn.isVisible().catch(() => false)) {
    await createBtn.click();
    await page.waitForTimeout(700);
    const glass = await measureGlassReadability(page, "glass-audit-drawer");
    if (glass.length >= 2) {
      addFinding({
        severity: "medium",
        page: "/shipment-ledger (glass)",
        title: "Efek liquid-glass berat pada drawer operasional",
        steps: "Buka drawer CRUD, perhatikan blur + transparansi di atas tabel.",
        personaImpact: "Tampilan 'premium' terasa tidak realistis untuk ruang kontrol bandara; teks di belakang mengganggu fokus.",
        suggestedFix: "Pada variant drawer/sheet ops: kurangi --glass-blur ke 16–24px dan naikkan opacity panel ke 0.92 solid tint — pertahankan radius dan shadow.",
        screenshot: "12-glass-drawer.png",
      });
      await shot(page, "12-glass-drawer");
    }
    await page.keyboard.press("Escape");
  }

  const select = page.locator(".glass-select-trigger").first();
  if (await select.isVisible().catch(() => false)) {
    await select.click();
    await page.waitForTimeout(500);
    await shot(page, "12-glass-dropdown");
    const dropdownGlass = await measureGlassReadability(page, "glass-audit-dropdown");
    if (dropdownGlass.some((g) => /blur\((1[6-9]|[2-9]\d)px\)/.test(g.blur))) {
      addFinding({
        severity: "low",
        page: "global (dropdown)",
        title: "Dropdown glass-select blur tinggi",
        steps: "Buka filter GlassSelect di modul manapun.",
        personaImpact: "Opsi filter di atas data bergerak — sedikit mengganggu di monitor terang.",
        suggestedFix: "Gunakan --dropdown-glass-blur 12px + background solid 94% pada .liquid-glass-dropdown.",
        screenshot: "12-glass-dropdown.png",
      });
    }
    await page.keyboard.press("Escape");
  }
}

function prioritizeFindings() {
  const order = { critical: 0, high: 1, medium: 2, low: 3 };
  return [...findings].sort((a, b) => order[a.severity] - order[b.severity] || a.id.localeCompare(b.id));
}

function top10Fixes(sorted) {
  const seen = new Set();
  const picks = [];
  for (const f of sorted) {
    const key = f.title.slice(0, 60);
    if (seen.has(key)) continue;
    seen.add(key);
    picks.push({
      rank: picks.length + 1,
      id: f.id,
      severity: f.severity,
      page: f.page,
      fix: f.suggestedFix,
      title: f.title,
    });
    if (picks.length >= 10) break;
  }
  return picks;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  await mkdir(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: !headed, slowMo: headed ? 40 : 0 });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: "light",
    locale: "id-ID",
  });
  const page = await context.newPage();

  console.log(`Live UI audit → ${baseUrl}`);
  console.log(`Screenshots → ${outDir}`);

  let knownAwb = null;

  async function runStep(name, fn) {
    try {
      await fn();
    } catch (error) {
      console.error(`[${name}]`, error);
      addFinding({
        severity: "high",
        page: name,
        title: `Alur audit gagal: ${error.message.split("\n")[0]}`,
        steps: `Jalankan ulang langkah ${name} di live-ui-audit.mjs`,
        personaImpact: "Area ini belum teruji penuh — risiko defect tersembunyi.",
        suggestedFix: "Perbaiki blocker UI (overlay, timeout) lalu re-run audit.",
      });
      await dismissOverlays(page).catch(() => {});
    }
  }

  await runStep("/about-us", () => auditAboutUs(page));
  await runStep("/login", () => auditLogin(page));

  const shipmentsRes = await page.request.get(routeUrl("/api/shipments"));
  if (shipmentsRes.ok()) {
    const payload = await shipmentsRes.json();
    knownAwb = payload.shipments?.[0]?.awb ?? null;
  }

  await runStep("/dashboard", () => auditDashboard(page));
  await runStep("/shipment-ledger", () => auditShipmentLedger(page));
  await runStep("/awb-tracking", () => auditAwbTracking(page, knownAwb));
  await runStep("/flight-board", () => auditFlightBoard(page));
  await runStep("/alerts", () => auditAlerts(page));
  await runStep("/activity-log", () => auditActivityLog(page));
  await runStep("/complaints", () => auditComplaints(page));
  await runStep("/settings", () => auditSettings(page));
  await runStep("/glass-effects", () => auditGlassEffects(page));
  await runStep("/mobile", () => auditMobile(page, browser));

  const sorted = prioritizeFindings();
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    persona: "Petugas operator bandara Kelas C",
    credentials: loginEmail,
    viewportDesktop: "1440x900",
    viewportMobile: "375x812",
    screenshotDir: outDir,
    summary: {
      total: sorted.length,
      critical: sorted.filter((f) => f.severity === "critical").length,
      high: sorted.filter((f) => f.severity === "high").length,
      medium: sorted.filter((f) => f.severity === "medium").length,
      low: sorted.filter((f) => f.severity === "low").length,
    },
    findings: sorted,
    top10Fixes: top10Fixes(sorted),
  };

  const jsonPath = path.join(outDir, "live-audit-report.json");
  await writeFile(jsonPath, JSON.stringify(report, null, 2), "utf8");

  const mdPath = path.join(outDir, "live-audit-report.md");
  const md = [
    `# Live UI Audit — SkyHub Ops`,
    ``,
    `**Tanggal:** ${report.generatedAt}`,
    `**URL:** ${baseUrl}`,
    `**Persona:** ${report.persona}`,
    ``,
    `## Ringkasan`,
    `| Severity | Jumlah |`,
    `|----------|--------|`,
    `| Critical | ${report.summary.critical} |`,
    `| High | ${report.summary.high} |`,
    `| Medium | ${report.summary.medium} |`,
    `| Low | ${report.summary.low} |`,
    `| **Total** | **${report.summary.total}** |`,
    ``,
    `## Temuan`,
    `| ID | Severity | Halaman | Judul | Dampak Persona | Perbaikan |`,
    `|----|----------|---------|-------|----------------|-----------|`,
    ...sorted.map(
      (f) =>
        `| ${f.id} | ${f.severity} | ${f.page} | ${f.title.replace(/\|/g, "/")} | ${f.personaImpact.replace(/\|/g, "/").slice(0, 80)}… | ${f.suggestedFix.replace(/\|/g, "/").slice(0, 80)}… |`,
    ),
    ``,
    `## Top 10 Perbaikan Prioritas`,
    ...report.top10Fixes.map((t) => `${t.rank}. **[${t.severity}] ${t.title}** (${t.page}) — ${t.fix}`),
  ].join("\n");
  await writeFile(mdPath, md, "utf8");

  console.log("\n=== RINGKASAN ===");
  console.log(JSON.stringify(report.summary, null, 2));
  console.log(`\nLaporan: ${jsonPath}`);
  console.log(`Markdown: ${mdPath}`);

  await browser.close();
  process.exit(report.summary.critical > 0 ? 2 : 0);
}

main();