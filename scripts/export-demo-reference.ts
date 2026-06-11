import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { addDays, addHours, addMinutes, format, set } from "date-fns";
import { FlightStatus, ShipmentStatus } from "@prisma/client";
import {
  FLIGHT_STATUS_LABELS,
  ROLE_LABELS,
  SHIPMENT_STATUS_LABELS,
  USER_STATUS_LABELS,
} from "../src/lib/constants";
import {
  buildFlightNumber,
  getFlightVisualMeta,
  SUPPORTED_AIRLINE_CODES,
} from "../src/lib/flight-meta";
import { buildAwbFromSerial } from "../src/lib/validators";

const OUTPUT_DIR = join(process.cwd(), "docs", "demo-pdf");

const ROUTES = [
  { origin: "SOQ", destination: "CGK" },
  { origin: "SOQ", destination: "SUB" },
  { origin: "SOQ", destination: "DPS" },
  { origin: "SOQ", destination: "UPG" },
  { origin: "SOQ", destination: "BPN" },
  { origin: "SOQ", destination: "KNO" },
  { origin: "SOQ", destination: "PLM" },
  { origin: "SOQ", destination: "PNK" },
] as const;

const STATUS_CYCLE: ShipmentStatus[] = [
  ShipmentStatus.received,
  ShipmentStatus.sortation,
  ShipmentStatus.loaded_to_aircraft,
  ShipmentStatus.departed,
  ShipmentStatus.arrived,
  ShipmentStatus.hold,
];

const FLIGHT_STATUS_CYCLE: FlightStatus[] = [
  FlightStatus.on_time,
  FlightStatus.delayed,
  FlightStatus.departed,
];

const DASHBOARD_CHART_STATUS_CYCLE: ShipmentStatus[] = [
  ShipmentStatus.received,
  ShipmentStatus.sortation,
  ShipmentStatus.loaded_to_aircraft,
  ShipmentStatus.departed,
  ShipmentStatus.arrived,
];

const MIN_SEEDED_ROWS_PER_STATE = 1;
const SEEDED_FLIGHT_DAYS = 3;
const SEEDED_FLIGHTS_PER_DAY = FLIGHT_STATUS_CYCLE.length * MIN_SEEDED_ROWS_PER_STATE;
const SEEDED_SHIPMENT_COUNT = STATUS_CYCLE.length * MIN_SEEDED_ROWS_PER_STATE * 6;

const DEMO_HIGHLIGHT_AWB_INDICES = new Set([1, 12, 23, 34, 45, 56]);

const DEFAULT_PASSWORD = "operator123";
const BASE_URL = "http://localhost:3100";

function pick<T>(items: readonly T[], index: number): T {
  return items[index % items.length]!;
}

function buildAwb(index: number) {
  return buildAwbFromSerial("160", 1_000_000 + index);
}

function shipmentStatusForIndex(index: number): ShipmentStatus {
  const isDashboardChartSample = index < DASHBOARD_CHART_STATUS_CYCLE.length;
  return isDashboardChartSample ? DASHBOARD_CHART_STATUS_CYCLE[index]! : pick(STATUS_CYCLE, index);
}

function dayLabel(dayOffset: number) {
  if (dayOffset === 0) return "Hari ini";
  if (dayOffset === -1) return "Kemarin";
  if (dayOffset === 1) return "Besok";
  return `Offset ${dayOffset} hari`;
}

function buildCredentialsJson() {
  const accounts = [
    { name: "Mira Putri", email: "admin@skyhub.test", role: "admin", status: "active", station: "SOQ", note: "Demo admin, reset password, kelola tim" },
    { name: "Raka Pratama", email: "staff@skyhub.test", role: "staff", status: "active", station: "SOQ", note: "Akun utama demo operator" },
    { name: "Naila Putri", email: "staff2@skyhub.test", role: "staff", status: "active", station: "SOQ", note: "Staf kedua, stasiun sama" },
    { name: "Aldi Saputra", email: "staff3@skyhub.test", role: "staff", status: "active", station: "CGK", note: "Demo stasiun berbeda (CGK)" },
    { name: "Laras Wibowo", email: "staff4@skyhub.test", role: "staff", status: "active", station: "SUB", note: "Demo stasiun berbeda (SUB)" },
    { name: "Staf Operasional 05", email: "staff-extra-1@skyhub.test", role: "staff", status: "active", station: "SOQ", note: "Akun tambahan seed" },
    { name: "Dian Rahma", email: "invited-staff@skyhub.test", role: "staff", status: "invited", station: "SOQ", note: "Demo status belum aktif" },
    { name: "Undangan Staf 02", email: "invited-staff-2@skyhub.test", role: "staff", status: "invited", station: "SOQ", note: "Demo undangan kedua" },
    { name: "Bagas Prasetyo", email: "disabled-staff@skyhub.test", role: "staff", status: "disabled", station: "SOQ", note: "Demo akun dinonaktifkan" },
    { name: "Staf Nonaktif 02", email: "disabled-staff-2@skyhub.test", role: "staff", status: "disabled", station: "SOQ", note: "Demo nonaktif kedua" },
    { name: "Nadia Kusuma", email: "customer@skyhub.test", role: "customer", status: "active", station: "SOQ", note: "Akun pelanggan (portal publik)" },
    { name: "Teguh Santoso", email: "customer2@skyhub.test", role: "customer", status: "active", station: "CGK", note: "Pelanggan stasiun CGK" },
    { name: "Citra Melati", email: "customer3@skyhub.test", role: "customer", status: "active", station: "DPS", note: "Pelanggan stasiun DPS" },
  ].map((account) => ({
    ...account,
    password: DEFAULT_PASSWORD,
    role_label: ROLE_LABELS[account.role as keyof typeof ROLE_LABELS],
    status_label: USER_STATUS_LABELS[account.status as keyof typeof USER_STATUS_LABELS],
  }));

  return {
    sheet_type: "credentials",
    title: "Kredensial & Skenario Presentasi",
    subtitle: "SkyHub Cargo Ops · SIWEB Kelas C",
    organization: "SkyHub Cargo Ops",
    author: "Tim Presentasi",
    date: "Juni 2026",
    password_default: DEFAULT_PASSWORD,
    base_url: BASE_URL,
    accounts,
    urls: [
      { label: "Portal publik", path: "/about-us" },
      { label: "Cek resi publik", path: "/about-us#tracking" },
      { label: "Login operator", path: "/login" },
      { label: "Dashboard", path: "/dashboard" },
      { label: "Pelacakan AWB", path: "/awb-tracking" },
      { label: "Buku pengiriman", path: "/shipment-ledger" },
      { label: "Papan penerbangan", path: "/flight-board" },
      { label: "Pengaturan", path: "/settings" },
    ],
    quick_blocks: [
      { label: "Operator utama", lines: [`Email: staff@skyhub.test`, `Password: ${DEFAULT_PASSWORD}`] },
      { label: "Administrator", lines: [`Email: admin@skyhub.test`, `Password: ${DEFAULT_PASSWORD}`] },
      { label: "Cek resi publik", lines: [`AWB: ${buildAwb(1)}`, `URL: ${BASE_URL}/about-us#tracking`] },
    ],
    scenarios: [
      "Portal publik: buka /about-us#tracking, lacak AWB sorotan dari lembar Daftar AWB.",
      "Operator: login staff@skyhub.test, buka dashboard, buku pengiriman, pelacakan AWB.",
      "Admin: login admin@skyhub.test, kelola tim & reset password di Pengaturan.",
      "Error handling: coba disabled-staff@skyhub.test atau invited-staff@skyhub.test.",
    ],
    cheat_sheet: [
      `Operator: staff@skyhub.test / ${DEFAULT_PASSWORD}`,
      `Admin: admin@skyhub.test / ${DEFAULT_PASSWORD}`,
      `Publik AWB: ${BASE_URL}/about-us#tracking`,
      "Reset password: Admin → Pengaturan → Tim & Akses",
    ],
    footer_note: "Data selaras seed · Login UI tidak menampilkan kredensial",
  };
}

function buildAwbJson() {
  const now = new Date();
  const flights = Array.from({ length: SEEDED_FLIGHT_DAYS * SEEDED_FLIGHTS_PER_DAY }, (_, index) => {
    const airlineCode = pick(SUPPORTED_AIRLINE_CODES, index);
    const numberPart = String(index % 3 === 0 ? 1000 + index : 700 + index);
    const flightNumber = buildFlightNumber(airlineCode, numberPart);
    const route = pick(ROUTES, index);
    return { flightNumber, origin: route.origin, destination: route.destination };
  });

  const rows = Array.from({ length: SEEDED_SHIPMENT_COUNT }, (_, index) => {
    const flight = pick(flights, index);
    const awb = buildAwb(index);
    const status = shipmentStatusForIndex(index);

    return {
      index,
      awb,
      status_id: status,
      status_label: SHIPMENT_STATUS_LABELS[status],
      route: `${flight.origin} → ${flight.destination}`,
      flight_number: flight.flightNumber,
      highlight: DEMO_HIGHLIGHT_AWB_INDICES.has(index),
      note: DEMO_HIGHLIGHT_AWB_INDICES.has(index) ? "Sorotan demo" : "",
    };
  });

  return {
    sheet_type: "awb",
    title: "Daftar AWB Demo",
    subtitle: `${rows.length} nomor resi selaras seed`,
    organization: "SkyHub Cargo Ops",
    author: "Tim Presentasi",
    date: format(now, "dd MMM yyyy"),
    rows,
    footer_note: "Sorotan demo ditandai untuk presentasi cepat",
  };
}

function buildFlightsJson() {
  const now = new Date();
  const rows = Array.from({ length: SEEDED_FLIGHT_DAYS * SEEDED_FLIGHTS_PER_DAY }, (_, index) => {
    const airlineCode = pick(SUPPORTED_AIRLINE_CODES, index);
    const numberPart = String(index % 3 === 0 ? 1000 + index : 700 + index);
    const flightNumber = buildFlightNumber(airlineCode, numberPart);
    const route = pick(ROUTES, index);
    const status = pick(FLIGHT_STATUS_CYCLE, index);
    const meta = getFlightVisualMeta(flightNumber);

    const dayOffset = Math.floor(index / SEEDED_FLIGHTS_PER_DAY) - 1;
    const baseDay = addDays(now, dayOffset);
    const departureTime = set(baseDay, {
      hours: 1 + ((index * 3) % 22),
      minutes: (index % 6) * 10,
      seconds: 0,
      milliseconds: 0,
    });
    const cargoCutoffTime = addMinutes(departureTime, -(70 + (index % 4) * 10));
    const arrivalTime = addHours(departureTime, 2 + (index % 4));
    const gate = `${String.fromCharCode(65 + (index % 4))}${(index % 8) + 1}`;

    return {
      index,
      flight_number: flightNumber,
      airline: meta.airlineName,
      aircraft_type: meta.aircraftType,
      route: `${route.origin} → ${route.destination}`,
      status_label: FLIGHT_STATUS_LABELS[status],
      gate,
      day_label: dayLabel(dayOffset),
      cutoff_time: format(cargoCutoffTime, "HH:mm"),
      departure_time: format(departureTime, "HH:mm"),
      arrival_time: format(arrivalTime, "HH:mm"),
    };
  });

  return {
    sheet_type: "flights",
    title: "Daftar Penerbangan Demo",
    subtitle: `${rows.length} jadwal selaras seed`,
    organization: "SkyHub Cargo Ops",
    author: "Tim Presentasi",
    date: format(now, "dd MMM yyyy"),
    rows,
    footer_note: "Waktu relatif terhadap tanggal ekspor",
  };
}

function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const files = [
    ["kredensial.json", buildCredentialsJson()],
    ["daftar-awb.json", buildAwbJson()],
    ["daftar-penerbangan.json", buildFlightsJson()],
  ] as const;

  for (const [name, payload] of files) {
    const path = join(OUTPUT_DIR, name);
    writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    console.log(`Wrote ${path}`);
  }
}

main();