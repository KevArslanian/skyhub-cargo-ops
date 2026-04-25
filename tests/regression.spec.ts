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
  await Promise.all([
    page.waitForURL(email === users.customer ? "**/awb-tracking" : "**/dashboard"),
    page.locator('form button[type="submit"]').click(),
  ]);
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
});

test("@crud shipment CRUD, document upload, notification update, and archive work", async ({ request }) => {
  await login(request, users.staff);

  const awb = `160-${uniqueSuffix()}`;
  const shipmentCreate = await request.post(apiUrl("/api/shipments"), {
    data: {
      awb,
      commodity: "QA Test Cargo",
      origin: "CGK",
      destination: "DPS",
      pieces: 2,
      weightKg: 12.5,
      volumeM3: 0.4,
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

  const shipmentLookup = await request.get(apiUrl(`/api/shipments?awb=${encodeURIComponent(awb)}`));
  expect(shipmentLookup.status()).toBe(200);
  expect((await shipmentLookup.json()).shipment.awb).toBe(awb);

  const shipmentUpdate = await request.patch(apiUrl(`/api/shipments/${created.id}`), {
    data: {
      status: "hold",
      docStatus: "Review",
      readiness: "Pending",
      notes: "Regression review note",
    },
  });
  expect(shipmentUpdate.status()).toBe(200);
  expect((await shipmentUpdate.json()).shipment.status).toBe("hold");

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

  const archive = await request.delete(apiUrl(`/api/shipments/${created.id}`));
  expect(archive.status()).toBe(200);
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

  const archive = await request.patch(apiUrl(`/api/flights/${flight.id}`), {
    data: { archived: true },
  });
  expect(archive.status()).toBe(200);
});

test("@crud settings update and restore works", async ({ request }) => {
  await login(request, users.admin);

  const originalResponse = await request.get(apiUrl("/api/settings"));
  expect(originalResponse.status()).toBe(200);
  const original = await originalResponse.json();
  const originalSettings = original.settings ?? {};
  const nextStation = original.profile.station === "UPG" ? "SOQ" : "UPG";
  const nextTheme = originalSettings.theme === "dark" ? "light" : "dark";

  try {
    const update = await request.patch(apiUrl("/api/settings"), {
      data: {
        name: `${original.profile.name} QA`,
        station: nextStation,
        theme: nextTheme,
        compactRows: !Boolean(originalSettings.compactRows),
        sidebarCollapsed: !Boolean(originalSettings.sidebarCollapsed),
        autoRefresh: true,
        refreshIntervalSeconds: 15,
        cutoffAlert: true,
        exceptionAlert: true,
        soundAlert: false,
        emailDigest: false,
      },
    });
    expect(update.status()).toBe(200);
    const updated = await update.json();
    expect(updated.profile.station).toBe(nextStation);
    expect(updated.settings.theme).toBe(nextTheme);
  } finally {
    await request.patch(apiUrl("/api/settings"), {
      data: {
        name: original.profile.name,
        station: original.profile.station,
        ...originalSettings,
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

  const userUpdate = await request.patch(apiUrl(`/api/users/${invited.id}`), {
    data: { status: "disabled", station: "DPS" },
  });
  expect(userUpdate.status()).toBe(200);
});

test("@api staff and customer role boundaries are enforced", async ({ request }) => {
  await login(request, users.staff);
  expect((await request.get(apiUrl("/api/users"))).status()).toBe(403);
  expect((await request.get(apiUrl("/api/customer-accounts"))).status()).toBe(403);
  await request.post(apiUrl("/api/auth/logout"));

  await login(request, users.customer);
  expect((await request.get(apiUrl("/api/flights"))).status()).toBe(403);
  expect((await request.get(apiUrl("/api/activity-log"))).status()).toBe(403);
  expect((await request.get(apiUrl("/api/shipments"))).status()).toBe(200);
  const blockedCreate = await request.post(apiUrl("/api/shipments"), {
    data: {
      commodity: "Blocked Customer Create",
      origin: "CGK",
      destination: "DPS",
      pieces: 1,
      weightKg: 1,
      shipper: "QA Shipper",
      consignee: "QA Consignee",
      forwarder: "QA Forwarder",
      ownerName: "QA Owner",
    },
  });
  expect(blockedCreate.status()).toBe(403);
});

test("@e2e core pages and role redirects render", async ({ page }) => {
  test.setTimeout(60_000);

  await page.goto(apiUrl("/login"));
  await expect(page).toHaveURL(/\/about-us/);

  await loginPage(page, users.staff);

  for (const route of ["/dashboard", "/shipment-ledger", "/awb-tracking", "/flight-board", "/activity-log", "/reports", "/settings"]) {
    await page.goto(apiUrl(route));
    await expect(page.locator("h1").first()).toBeVisible();
  }

  const shipments = await page.request.get(apiUrl("/api/shipments"));
  expect(shipments.status()).toBe(200);
  const firstAwb = (await shipments.json()).shipments[0]?.awb;
  expect(firstAwb).toBeTruthy();

  await page.goto(apiUrl(`/awb-tracking?awb=${encodeURIComponent(firstAwb)}`));
  await expect(page.getByText(firstAwb).first()).toBeVisible();
  await expect(page.getByText("Timeline Tracking")).toBeVisible();

  await page.request.post(apiUrl("/api/auth/logout"));
  await login(page.request, users.customer);
  await page.goto(apiUrl("/flight-board"));
  await expect(page).toHaveURL(/\/awb-tracking/);
});

test("@e2e notifications menu can mark items read", async ({ page }) => {
  test.setTimeout(60_000);

  await loginPage(page, users.staff);
  await page.goto(apiUrl("/dashboard"));

  await page.getByRole("button", { name: /Notifikasi/ }).click();
  await expect(page.getByText("Notifikasi").first()).toBeVisible();
  await page.getByRole("button", { name: "Tandai semua" }).click();
  await expect(page.getByText("0 belum dibaca")).toBeVisible();
});

test("@e2e export and print pages render tables", async ({ page }) => {
  test.setTimeout(60_000);

  await loginPage(page, users.staff);
  const shipments = await page.request.get(apiUrl("/api/shipments"));
  expect(shipments.status()).toBe(200);
  const firstAwb = (await shipments.json()).shipments[0]?.awb;
  expect(firstAwb).toBeTruthy();

  await page.emulateMedia({ media: "print" });

  for (const route of ["/exports/shipments", "/exports/flights", "/exports/activity-log"]) {
    await page.goto(apiUrl(route));
    await expect(page.locator("table").first()).toBeVisible();
  }

  await page.goto(apiUrl(`/exports/awb?awb=${encodeURIComponent(firstAwb)}`));
  await expect(page.locator("table").first()).toBeVisible();
  await expect(page.getByText(firstAwb).first()).toBeVisible();
});
