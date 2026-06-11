import { expect, test, type APIRequestContext, type Page } from "playwright/test";

const baseURL = process.env.APP_BASE_URL ?? "http://localhost:3000";
const password = process.env.QA_LOGIN_PASSWORD ?? "operator123";

const users = {
  admin: process.env.QA_ADMIN_EMAIL ?? "admin@skyhub.test",
  staff: process.env.QA_LOGIN_EMAIL ?? "staff@skyhub.test",
  customer: process.env.QA_CUSTOMER_EMAIL ?? "customer@skyhub.test",
  disabled: process.env.QA_DISABLED_EMAIL ?? "disabled-staff@skyhub.test",
  invited: process.env.QA_INVITED_EMAIL ?? "invited-staff@skyhub.test",
};

test.describe.configure({ mode: "serial" });

function uniqueSuffix() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-8);
}

function validAwb(prefix = "160") {
  const serial7 = `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-7).padStart(7, "0");
  const checkDigit = parseInt(serial7, 10) % 7;
  return `${prefix}-${serial7}${checkDigit}`;
}

function apiUrl(path: string) {
  return new URL(path, baseURL).toString();
}

async function login(request: APIRequestContext, email: string, expectedStatus = 200) {
  const response = await request.post(apiUrl("/api/auth/login"), {
    data: { email, password, remember: false },
  });
  expect(response.status()).toBe(expectedStatus);
  return response;
}

async function loginPage(page: Page, email = users.staff) {
  await page.request.post(apiUrl("/api/auth/intro"), { maxRedirects: 0 });
  await page.goto(apiUrl("/login"));
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"], input[type="text"]').fill(password);

  if (email === users.customer) {
    await page.locator('form button[type="submit"]').click();
    await expect(page.getByRole("heading", { name: /Pelanggan tidak memiliki akun masuk/i })).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
    return;
  }

  await Promise.all([page.waitForURL("**/dashboard"), page.locator('form button[type="submit"]').click()]);
}

test("@api unauthenticated API requests are rejected", async ({ request }) => {
  const response = await request.get(apiUrl("/api/shipments"));
  expect(response.status()).toBe(401);
});

test("@api cross-origin mutating requests are rejected", async ({ request }) => {
  const response = await request.post(apiUrl("/api/auth/login"), {
    headers: { Origin: "https://evil.example" },
    data: { email: users.staff, password },
  });
  expect(response.status()).toBe(403);
});

test("@api inactive and invited users cannot log in", async ({ request }) => {
  await login(request, users.disabled, 403);
  await login(request, users.invited, 403);
});

test("@api validation rejects invalid inputs", async ({ request }) => {
  test.setTimeout(120_000);

  await login(request, users.staff);

  const invalidAwb = await request.post(apiUrl("/api/shipments"), {
    data: {
      awb: "bad-awb",
      commodity: "General Cargo",
      origin: "CGK",
      destination: "DPS",
      pieces: 1,
      weightKg: 10,
      shipper: "QA Shipper",
      consignee: "QA Consignee",
      forwarder: "QA Forwarder",
      ownerName: "QA Owner",
    },
  });
  expect(invalidAwb.status()).toBe(400);

  const invalidStatus = await request.get(apiUrl("/api/flights?status=cancelled"));
  expect(invalidStatus.status()).toBe(400);

  const invalidSchedule = await request.post(apiUrl("/api/flights"), {
    data: {
      flightNumber: `JT-${uniqueSuffix().slice(0, 4)}`,
      aircraftType: "Boeing 737-900ER",
      origin: "CGK",
      destination: "DPS",
      cargoCutoffTime: "2026-04-25T15:00:00.000Z",
      departureTime: "2026-04-25T14:00:00.000Z",
      arrivalTime: "2026-04-25T16:00:00.000Z",
      status: "on_time",
    },
  });
  expect(invalidSchedule.status()).toBe(400);

  const guardAwb = validAwb();
  const guardedShipmentResponse = await request.post(apiUrl("/api/shipments"), {
    data: {
      awb: guardAwb,
      commodity: "Guarded Cargo",
      cargoMode: "Udara",
      senderPhone: "081234567890",
      origin: "CGK",
      destination: "DPS",
      pieces: 1,
      weightKg: 8,
      shipper: "Guard Shipper",
      consignee: "Guard Consignee",
      forwarder: "Guard Forwarder",
      ownerName: "Guard Owner",
    },
  });
  expect(guardedShipmentResponse.status()).toBe(200);
  const guardedShipment = (await guardedShipmentResponse.json()).shipment;

  const invalidTransition = await request.patch(apiUrl(`/api/shipments/${guardedShipment.id}`), {
    data: { status: "arrived" },
  });
  expect(invalidTransition.status()).toBe(400);
  expect((await invalidTransition.json()).code).toBe("SHIPMENT_STATUS_TRANSITION_INVALID");

  const holdShipment = await request.patch(apiUrl(`/api/shipments/${guardedShipment.id}`), {
    data: { status: "hold" },
  });
  expect(holdShipment.status()).toBe(200);

  const activeAlertResolve = await request.post(apiUrl("/api/alerts"), {
    data: {
      alertKey: `shipment-hold:${guardedShipment.id}`,
      action: "resolve",
    },
  });
  expect(activeAlertResolve.status()).toBe(400);
  expect((await activeAlertResolve.json()).code).toBe("ALERT_STILL_ACTIVE");

  const routeGuardFlightResponse = await request.post(apiUrl("/api/flights"), {
    data: {
      flightNumber: `JT-${uniqueSuffix().slice(0, 4)}`,
      aircraftType: "Boeing 737-900ER",
      origin: "CGK",
      destination: "DPS",
      cargoCutoffTime: "2099-04-25T12:00:00.000Z",
      departureTime: "2099-04-25T13:00:00.000Z",
      arrivalTime: "2099-04-25T15:00:00.000Z",
      status: "on_time",
    },
  });
  expect(routeGuardFlightResponse.status()).toBe(200);
  const routeGuardFlight = (await routeGuardFlightResponse.json()).flight;

  const routeMismatchShipment = await request.post(apiUrl("/api/shipments"), {
    data: {
      awb: validAwb(),
      commodity: "Route Guard Cargo",
      cargoMode: "Udara",
      senderPhone: "081234567890",
      origin: "CGK",
      destination: "SUB",
      pieces: 1,
      weightKg: 8,
      flightId: routeGuardFlight.id,
      shipper: "Guard Shipper",
      consignee: "Guard Consignee",
      forwarder: "Guard Forwarder",
      ownerName: "Guard Owner",
    },
  });
  expect(routeMismatchShipment.status()).toBe(400);
  expect((await routeMismatchShipment.json()).code).toBe("FLIGHT_ROUTE_MISMATCH");

  await Promise.all([
    request.delete(apiUrl(`/api/flights/${routeGuardFlight.id}`), { timeout: 45_000 }),
    request.delete(apiUrl(`/api/shipments/${guardedShipment.id}`), { timeout: 45_000 }),
  ]);
});

test("@api flight search and pagination follow unguided chapter 10 requirements", async ({ request }) => {
  await login(request, users.staff);

  const firstPage = await request.get(apiUrl("/api/flights?page=1&pageSize=3"));
  expect(firstPage.status()).toBe(200);
  const firstPayload = await firstPage.json();
  expect(firstPayload.pagination).toMatchObject({
    page: 1,
    pageSize: 3,
  });
  expect(firstPayload.pagination.totalItems).toBeGreaterThanOrEqual(firstPayload.flights.length);
  expect(firstPayload.pagination.totalPages).toBeGreaterThanOrEqual(1);
  expect(firstPayload.flights.length).toBeLessThanOrEqual(3);

  const search = await request.get(apiUrl("/api/flights?query=CGK&page=1&pageSize=5"));
  expect(search.status()).toBe(200);
  const searchPayload = await search.json();
  expect(searchPayload.pagination.page).toBe(1);
  expect(searchPayload.flights.length).toBeLessThanOrEqual(5);

  const emptyDate = await request.get(apiUrl("/api/flights?date=2099-01-01&page=1&pageSize=5"));
  expect(emptyDate.status()).toBe(200);
  const emptyDatePayload = await emptyDate.json();
  expect(emptyDatePayload.pagination).toMatchObject({
    page: 1,
    pageSize: 5,
    totalItems: 0,
    totalPages: 1,
  });
  expect(emptyDatePayload.flights).toHaveLength(0);

  const boundedPage = await request.get(apiUrl("/api/flights?page=9999&pageSize=3"));
  expect(boundedPage.status()).toBe(200);
  const boundedPayload = await boundedPage.json();
  expect(boundedPayload.pagination.page).toBeLessThanOrEqual(boundedPayload.pagination.totalPages);

  const invalidPage = await request.get(apiUrl("/api/flights?page=0"));
  expect(invalidPage.status()).toBe(400);

  const invalidPageSize = await request.get(apiUrl("/api/flights?pageSize=51"));
  expect(invalidPageSize.status()).toBe(400);
});

test("@crud shipment CRUD, document upload, notification update, and archive work", async ({ request }) => {
  test.setTimeout(90_000);

  await login(request, users.staff);

  const awb = validAwb();
  const shipmentCreate = await request.post(apiUrl("/api/shipments"), {
    data: {
      awb,
      sentAt: "2026-05-22",
      commodity: "QA Test Cargo",
      cargoMode: "Udara",
      senderPhone: "081234567890",
      origin: "CGK",
      destination: "DPS",
      pieces: 2,
      weightKg: 12.5,
      volumeM3: 0.4,
      serviceType: "Express Priority",
      vehicleName: "QA Cargo Unit",
      vehicleType: "Pesawat",
      vehicleCode: "PK-QA1",
      vehicleCapacityKg: 1200,
      vehicleStatus: "Aktif",
      goodsStatus: "Diproses",
      transactionStatus: "Pending",
      shipper: "QA Shipper",
      consignee: "QA Consignee",
      forwarder: "QA Forwarder",
      ownerName: "QA Owner",
      notes: "Created by regression suite",
    },
  });
  expect(shipmentCreate.status()).toBe(200);
  const created = (await shipmentCreate.json()).shipment;
  expect(created.awb).toBe(awb);
  expect(created.senderPhone).toBe("081234567890");
  expect(created.serviceType).toBe("Express Priority");
  expect(created.shippingRate).toBe(625000);
  expect(created.vehicleCode).toBe("PK-QA1");

  const shipmentLookup = await request.get(apiUrl(`/api/shipments?awb=${encodeURIComponent(awb)}`));
  expect(shipmentLookup.status()).toBe(200);
  expect((await shipmentLookup.json()).shipment.awb).toBe(awb);

  const shipmentSearch = await request.get(apiUrl(`/api/shipments?query=${encodeURIComponent("QA Cargo Unit")}`));
  expect(shipmentSearch.status()).toBe(200);
  expect((await shipmentSearch.json()).shipments.some((shipment: { awb: string }) => shipment.awb === awb)).toBe(true);

  const shipmentUpdate = await request.patch(apiUrl(`/api/shipments/${created.id}`), {
    data: {
      status: "hold",
      goodsStatus: "Dalam Pengiriman",
      transactionStatus: "Belum Lunas",
      notes: "Regression review note",
    },
  });
  expect(shipmentUpdate.status()).toBe(200);
  const updatedShipment = (await shipmentUpdate.json()).shipment;
  expect(updatedShipment.status).toBe("hold");
  expect(updatedShipment.shippingRate).toBe(625000);
  expect(updatedShipment.goodsStatus).toBe("Dalam Pengiriman");

  const upload = await request.post(apiUrl(`/api/shipments/${created.id}/documents`), {
    multipart: {
      file: {
        name: "qa-regression.csv",
        mimeType: "text/csv",
        buffer: Buffer.from("awb,status\n160-00000000,ok\n"),
      },
    },
  });

  if (upload.status() === 503) {
    const body = await upload.json();
    expect(body.code).toBe("BLOB_TOKEN_REQUIRED");
  } else {
    expect(upload.status()).toBe(200);
    const document = (await upload.json()).document;
    expect(document.fileName).toBe("qa-regression.csv");

    const deleteDoc = await request.delete(apiUrl(`/api/shipments/${created.id}/documents/${document.id}`));
    expect(deleteDoc.status()).toBe(200);
  }

  const markAll = await request.post(apiUrl("/api/notifications/mark-all-read"));
  expect(markAll.status()).toBe(200);

  const reportIssue = await request.post(apiUrl("/api/awb/report-issue"), { data: { awb } });
  expect(reportIssue.status()).toBe(200);

  const alertList = await request.get(apiUrl("/api/alerts"));
  expect(alertList.status()).toBe(200);
  const alertPayload = await alertList.json();
  const awbIssueAlert = alertPayload.alerts.find(
    (alert: { kind: string; entityLabel: string; title: string }) =>
      alert.kind === "reported-awb-issue" && alert.entityLabel === awb,
  );
  expect(awbIssueAlert?.title).toBe("Isu AWB dilaporkan");

  const resolveAwbIssue = await request.post(apiUrl("/api/alerts"), {
    data: { alertKey: `reported-awb-issue:${created.id}`, action: "resolve" },
  });
  expect(resolveAwbIssue.status()).toBe(200);

  const alertListAfterResolve = await request.get(apiUrl("/api/alerts"));
  expect(alertListAfterResolve.status()).toBe(200);
  const alertPayloadAfterResolve = await alertListAfterResolve.json();
  expect(
    alertPayloadAfterResolve.alerts.some(
      (alert: { kind: string; entityLabel: string }) =>
        alert.kind === "reported-awb-issue" && alert.entityLabel === awb,
    ),
  ).toBe(false);

  const archive = await request.delete(apiUrl(`/api/shipments/${created.id}`));
  expect(archive.status()).toBe(200);

  const deletedLookup = await request.get(apiUrl(`/api/shipments?awb=${encodeURIComponent(awb)}`));
  expect(deletedLookup.status()).toBe(200);
  expect((await deletedLookup.json()).shipment).toBeNull();
});

test("@crud flight create, update, and archive work", async ({ request }) => {
  await login(request, users.staff);

  const suffix = uniqueSuffix().slice(0, 4);
  const flightNumber = `JT-${suffix}`;
  const flightCreate = await request.post(apiUrl("/api/flights"), {
    data: {
      flightNumber,
      aircraftType: "Boeing 737-900ER",
      origin: "CGK",
      destination: "DPS",
      cargoCutoffTime: "2026-04-25T12:00:00.000Z",
      departureTime: "2026-04-25T13:00:00.000Z",
      arrivalTime: "2026-04-25T15:00:00.000Z",
      status: "on_time",
      gate: "QA1",
      remarks: "Created by regression suite",
    },
  });
  expect(flightCreate.status()).toBe(200);
  const flight = (await flightCreate.json()).flight;

  const flightUpdate = await request.patch(apiUrl(`/api/flights/${flight.id}`), {
    data: {
      flightNumber,
      aircraftType: "Boeing 737-900ER",
      origin: "CGK",
      destination: "DPS",
      cargoCutoffTime: "2026-04-25T12:30:00.000Z",
      departureTime: "2026-04-25T13:30:00.000Z",
      arrivalTime: "2026-04-25T15:30:00.000Z",
      status: "delayed",
      gate: "QA2",
    },
  });
  expect(flightUpdate.status()).toBe(200);

  const searchAfterUpdate = await request.get(apiUrl(`/api/flights?query=${encodeURIComponent(flightNumber)}&page=1&pageSize=5`));
  expect(searchAfterUpdate.status()).toBe(200);
  expect((await searchAfterUpdate.json()).flights.some((item: { flightNumber: string }) => item.flightNumber === flightNumber)).toBe(true);

  const deleteFlight = await request.delete(apiUrl(`/api/flights/${flight.id}`));
  expect(deleteFlight.status()).toBe(200);

  const searchAfterDelete = await request.get(apiUrl(`/api/flights?query=${encodeURIComponent(flightNumber)}&page=1&pageSize=5`));
  expect(searchAfterDelete.status()).toBe(200);
  expect((await searchAfterDelete.json()).flights.some((item: { flightNumber: string }) => item.flightNumber === flightNumber)).toBe(false);
});

test("@crud settings update and restore works", async ({ request }) => {
  await login(request, users.admin);

  const originalResponse = await request.get(apiUrl("/api/settings"));
  expect(originalResponse.status()).toBe(200);
  const original = await originalResponse.json();
  const originalSettings = original.settings ?? {};
  const nextTheme = originalSettings.theme === "dark" ? "light" : "dark";

  try {
    const update = await request.patch(apiUrl("/api/settings"), {
      data: {
        name: `${original.profile.name} QA`,
        theme: nextTheme,
        compactRows: !Boolean(originalSettings.compactRows),
        sidebarCollapsed: !Boolean(originalSettings.sidebarCollapsed),
        autoRefresh: true,
        refreshIntervalSeconds: 15,
        soundAlert: false,
      },
    });
    expect(update.status()).toBe(200);
    const updated = await update.json();
    expect(updated.profile.station).toBe(original.profile.station);
    expect(updated.settings.theme).toBe(nextTheme);
  } finally {
    await request.patch(apiUrl("/api/settings"), {
      data: {
        name: original.profile.name,
        theme: originalSettings.theme,
        compactRows: originalSettings.compactRows,
        sidebarCollapsed: originalSettings.sidebarCollapsed,
        autoRefresh: originalSettings.autoRefresh,
        refreshIntervalSeconds: originalSettings.refreshIntervalSeconds,
        soundAlert: originalSettings.soundAlert,
        accentColor: originalSettings.accentColor,
      },
    });
  }
});

test("@crud admin can manage users and customer accounts", async ({ request }) => {
  await login(request, users.admin);

  const code = `QA${uniqueSuffix().slice(0, 6)}`;
  const accountCreate = await request.post(apiUrl("/api/customer-accounts"), {
    data: {
      code,
      name: `QA Account ${code}`,
      contactName: "QA Contact",
      contactEmail: `${code.toLowerCase()}@example.test`,
      contactPhone: "0800000000",
    },
  });
  expect(accountCreate.status()).toBe(200);
  const account = (await accountCreate.json()).customerAccount;

  const accountUpdate = await request.patch(apiUrl(`/api/customer-accounts/${account.id}`), {
    data: { status: "disabled" },
  });
  expect(accountUpdate.status()).toBe(200);

  const invite = await request.post(apiUrl("/api/users"), {
    data: {
      name: `QA User ${code}`,
      email: `qa-user-${code.toLowerCase()}@example.test`,
      role: "staff",
      station: "CGK",
    },
  });
  expect(invite.status()).toBe(200);
  const invited = (await invite.json()).user;

  const forbiddenCustomerCapability = await request.patch(apiUrl(`/api/users/${invited.id}`), {
    data: {
      role: "customer",
      status: "active",
      station: "DPS",
      capabilities: ["shipment:create"],
    },
  });
  expect(forbiddenCustomerCapability.status()).toBe(400);
  expect((await forbiddenCustomerCapability.json()).code).toBe("CUSTOMER_CAPABILITY_FORBIDDEN");

  const userUpdate = await request.patch(apiUrl(`/api/users/${invited.id}`), {
    data: { status: "disabled", station: "DPS" },
  });
  expect(userUpdate.status()).toBe(200);
});

test("@api staff and customer role boundaries are enforced", async ({ request }) => {
  test.setTimeout(90_000);

  await login(request, users.admin);
  const adminSettings = await request.get(apiUrl("/api/settings"));
  expect(adminSettings.status()).toBe(200);
  const adminSettingsPayload = await adminSettings.json();
  const targetAccountId = adminSettingsPayload.customerAccounts[0]?.id;
  await request.post(apiUrl("/api/auth/logout"));

  await login(request, users.staff);
  expect((await request.get(apiUrl("/api/users"))).status()).toBe(403);
  expect((await request.get(apiUrl("/api/customer-accounts"))).status()).toBe(403);
  const staffSettings = await request.get(apiUrl("/api/settings"));
  expect(staffSettings.status()).toBe(200);
  const staffSettingsPayload = await staffSettings.json();
  expect(staffSettingsPayload.users).toHaveLength(1);
  expect(staffSettingsPayload.permissions.canManageUsers).toBe(false);
  expect(staffSettingsPayload.permissions.canManageCustomerAccounts).toBe(false);
  const blockedStaffCreateUser = await request.post(apiUrl("/api/users"), {
    data: {
      name: "QA Blocked Staff User",
      email: `qa-blocked-staff-${uniqueSuffix()}@example.test`,
      role: "staff",
      station: "CGK",
    },
  });
  expect(blockedStaffCreateUser.status()).toBe(403);
  if (targetAccountId) {
    const blockedStaffAccountPatch = await request.patch(apiUrl(`/api/customer-accounts/${targetAccountId}`), {
      data: { name: "QA Staff Bypass" },
    });
    expect(blockedStaffAccountPatch.status()).toBe(403);
  }
  await request.post(apiUrl("/api/auth/logout"));

  const blockedCustomerLogin = await request.post(apiUrl("/api/auth/login"), {
    data: { email: users.customer, password, remember: false },
  });
  expect(blockedCustomerLogin.status()).toBe(403);
  expect((await blockedCustomerLogin.json()).code).toBe("customer_login_disabled");
  expect((await request.get(apiUrl("/api/settings"))).status()).toBe(401);
});

test("@e2e core pages and role redirects render", async ({ page }) => {
  test.setTimeout(120_000);

  await page.goto(apiUrl("/login"));
  await expect(page).toHaveURL(/\/login/);
  await expect(page).toHaveTitle("Masuk | SkyHub");
  await expect(page.getByText("Autentikasi akun")).toBeVisible();

  await loginPage(page, users.staff);

  const pageTitles = [
    ["/dashboard", "Pusat Kendali | SkyHub"],
    ["/shipment-ledger", "Buku Pengiriman | SkyHub"],
    ["/awb-tracking", "Pelacakan AWB | SkyHub"],
    ["/flight-board", "Manajemen Pesawat | SkyHub"],
    ["/alerts", "Pusat Peringatan | SkyHub"],
    ["/activity-log", "Catatan Aktivitas | SkyHub"],
    ["/settings", "Pengaturan | SkyHub"],
  ] as const;

  for (const [route, title] of pageTitles) {
    await page.goto(apiUrl(route));
    await expect(page).toHaveTitle(title);
    await expect(page.locator("body")).toContainText("SkyHub");
  }

  for (const route of ["/query", "/seed"]) {
    await page.goto(apiUrl(route), { waitUntil: "domcontentloaded" }).catch((error: Error) => {
      if (!error.message.includes("ERR_ABORTED")) throw error;
    });
    await expect(page, `${route} harus dibatasi untuk admin`).toHaveURL(/\/dashboard/);
  }

  await page.goto(apiUrl("/alerts"));
  await page.getByRole("button", { name: /Buka detail/i }).first().click();
  await expect(
    page.getByText("Peringatan selesai otomatis setelah data di modul sumber sudah beres."),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Perbaiki di").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Selesai" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reset" })).toHaveCount(0);

  await page.goto(apiUrl("/reports"), { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto(apiUrl("/shipment-ledger"));
  await expect(page.getByText("Daftar AWB")).toBeVisible({ timeout: 15_000 });
  const shipmentPrintLink = page.locator('a[href*="/exports/shipments"]');
  await expect(shipmentPrintLink).toHaveAttribute("target", "_blank", { timeout: 15_000 });
  await expect(shipmentPrintLink).toHaveAttribute("rel", /noopener/);

  await page.goto(apiUrl("/flight-board"));
  await expect(page.getByRole("heading", { name: /Manajemen Pesawat/ })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/Batas Kargo T-70/)).toBeVisible();
  await expect(page.getByText("Berangkat (WITA)")).toBeVisible();
  const flightPrintLink = page.locator('a[href*="/exports/flights"]');
  await expect(flightPrintLink).toHaveAttribute("target", "_blank", { timeout: 15_000 });
  await expect(flightPrintLink).toHaveAttribute("rel", /noopener/);
  await page.setViewportSize({ width: 1256, height: 1044 });
  await page.locator('button:has-text("GA-1000")').first().click();
  await expect(page.getByText("Penerbangan Terpilih").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Ubah Penerbangan" })).toBeVisible();
  const flightBoardLayout = await page.evaluate(() => {
    const metric = (selector: string) => {
      const element = document.querySelector(selector);
      const rect = element?.getBoundingClientRect();
      return rect ? { found: true, x: rect.x, y: rect.y, width: rect.width, height: rect.height } : { found: false };
    };
    const manifest = metric(".flightboard-manifest-panel");
    const detailDrawer = metric(".flightboard-detail-modal");
    const doc = document.documentElement;
    return {
      manifest,
      detailDrawer,
      drawerOpen: detailDrawer.found && (detailDrawer.width ?? 0) > 0 && (detailDrawer.height ?? 0) > 0,
      horizontalOverflow: doc.scrollWidth > doc.clientWidth + 1,
    };
  });
  expect(flightBoardLayout.manifest.found).toBe(true);
  expect(flightBoardLayout.drawerOpen).toBe(true);
  expect(flightBoardLayout.horizontalOverflow).toBe(false);

  await page.goto(apiUrl("/settings"));
  await expect(page.getByRole("button", { name: /Preferensi/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Profil Akun dan akses saya/ })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Terang" })).toBeVisible();

  const requestedAwb = validAwb();
  const trackingShipment = await page.request.post(apiUrl("/api/shipments"), {
    data: {
      awb: requestedAwb,
      commodity: "QA Tracking Cargo",
      senderPhone: "081234567890",
      origin: "CGK",
      destination: "DPS",
      pieces: 1,
      weightKg: 8,
      shipper: "QA Shipper",
      consignee: "QA Consignee",
      forwarder: "QA Forwarder",
      ownerName: "QA Owner",
    },
  });
  expect(trackingShipment.status()).toBe(200);
  const firstAwb = (await trackingShipment.json()).shipment.awb;
  expect(firstAwb).toBeTruthy();

  await page.goto(apiUrl(`/awb-tracking?awb=${encodeURIComponent(firstAwb)}`));
  await expect(page.getByText(firstAwb).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Linimasa Pelacakan")).toBeVisible({ timeout: 15_000 });

  await page.goto(apiUrl("/api/auth/logout"), { waitUntil: "domcontentloaded" }).catch((error: Error) => {
    if (!error.message.includes("ERR_ABORTED")) throw error;
  });
  await page.context().clearCookies();
  await loginPage(page, users.customer);

  for (const route of ["/dashboard", "/shipment-ledger", "/flight-board", "/alerts", "/activity-log", "/settings", "/exports/shipments", "/exports/flights", "/exports/activity-log"]) {
    await page.goto(apiUrl(route), { waitUntil: "domcontentloaded" }).catch((error: Error) => {
      if (!error.message.includes("ERR_ABORTED")) throw error;
    });
    await expect(page, route).toHaveURL(/\/login/);
  }

  await page.goto(apiUrl("/about-us#tracking"));
  await expect(page.getByText(/Cek Resi Publik|Cek Resi/i).first()).toBeVisible();
});

test("@e2e notifications menu can mark items read", async ({ page }) => {
  test.setTimeout(60_000);

  await loginPage(page, users.staff);
  await page.goto(apiUrl("/dashboard"));

  await page.getByRole("button", { name: /Pemberitahuan/ }).click();
  await expect(page.getByText("Pemberitahuan").first()).toBeVisible();
  const markAllButton = page.getByRole("button", { name: "Tandai semua" });

  if (await markAllButton.isEnabled()) {
    await markAllButton.click();
    await expect(page.getByText("0 belum dibaca")).toBeVisible();
  } else {
    await expect(markAllButton).toBeDisabled();
    await expect(page.getByText("0 belum dibaca")).toBeVisible();
  }
});

test("@e2e export and print pages render tables", async ({ page }) => {
  test.setTimeout(60_000);

  await page.addInitScript(() => {
    const printState = window as unknown as { __printCalls: number; print: () => void };
    printState.__printCalls = 0;
    printState.print = () => {
      printState.__printCalls += 1;
    };
  });

  await loginPage(page, users.staff);
  const shipments = await page.request.get(apiUrl("/api/shipments"));
  expect(shipments.status()).toBe(200);
  const firstAwb = (await shipments.json()).shipments[0]?.awb;
  expect(firstAwb).toBeTruthy();

  for (const route of ["/exports/shipments", "/exports/flights", "/exports/activity-log"]) {
    await page.emulateMedia({ media: "screen" });
    await page.goto(apiUrl(route));
    await expect(page.getByRole("button", { name: "KEMBALI" })).toBeVisible();
    await expect(page.getByRole("button", { name: "CETAK" })).toBeVisible();
    await expect(page.locator("table").first()).toBeVisible();
    await page.emulateMedia({ media: "print" });
    await page.waitForFunction(() => (window as unknown as { __printCalls: number }).__printCalls > 0, null, {
      timeout: 8_000,
    });
  }

  await page.emulateMedia({ media: "screen" });
  await page.goto(apiUrl(`/exports/awb?awb=${encodeURIComponent(firstAwb)}`));
  await expect(page.getByRole("button", { name: "KEMBALI" })).toBeVisible();
  await expect(page.getByRole("button", { name: "CETAK" })).toBeVisible();
  await expect(page.locator("table").first()).toBeVisible();
  await expect(page.getByText(firstAwb).first()).toBeVisible();
  await page.emulateMedia({ media: "print" });
  await page.waitForFunction(() => (window as unknown as { __printCalls: number }).__printCalls > 0, null, {
    timeout: 8_000,
  });
});
