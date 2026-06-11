import { hashSync } from "bcryptjs";
import { addDays, addHours, addMinutes, set, subDays, subHours, subMinutes } from "date-fns";
import {
  ComplaintStatus,
  ComplaintTopic,
  FlightStatus,
  PrismaClient,
  ShipmentDocStatus,
  ShipmentReadiness,
  ShipmentStatus,
  ShipmentTransactionStatus,
  UserRole,
} from "@prisma/client";
import { SHIPMENT_STATUS_LABELS } from "../src/lib/constants";
import {
  buildFlightNumber,
  getFlightVisualMeta,
  SUPPORTED_AIRLINE_CODES,
} from "../src/lib/flight-meta";
import { buildAwbFromSerial, isValidAwbChecksum } from "../src/lib/validators";

const prisma = new PrismaClient();
const PASSWORD_HASH = hashSync("operator123", 10);

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

const AIRCRAFT_SPECS = [
  { registration: "PK-SHA", airlineCode: "GA", type: "Boeing 737-800F", capacityKg: 18500 },
  { registration: "PK-SHB", airlineCode: "JT", type: "Boeing 737-900ER", capacityKg: 17200 },
  { registration: "PK-SHC", airlineCode: "ID", type: "Airbus A320 Cargo", capacityKg: 16000 },
  { registration: "PK-SHD", airlineCode: "QG", type: "Airbus A320neo", capacityKg: 15800 },
  { registration: "PK-SHE", airlineCode: "SJ", type: "Boeing 737-500", capacityKg: 12400 },
  { registration: "PK-SHF", airlineCode: "IU", type: "Boeing 737-800", capacityKg: 17000 },
  { registration: "PK-SHG", airlineCode: "IN", type: "ATR 72 Cargo", capacityKg: 7500 },
  { registration: "PK-SHH", airlineCode: "TR", type: "Boeing 737 MAX 8", capacityKg: 18000 },
  { registration: "PK-SHI", airlineCode: "8B", type: "Airbus A321P2F", capacityKg: 27000 },
  { registration: "PK-SHJ", airlineCode: "IP", type: "Boeing 737-400F", capacityKg: 19000 },
] as const;

const COMMODITIES = [
  "Elektronik Konsumer",
  "Produk Farmasi",
  "Seafood Chilled",
  "Komponen Telekomunikasi",
  "Suku Cadang Mesin",
  "Dokumen Ekspor",
  "Aksesori Fashion",
  "Printed Material",
  "Medical Devices",
  "Chemical Samples",
  "Komoditas Pangan",
  "Retail Display Kit",
] as const;

const COMMODITY_SPECS = COMMODITIES.map((name, index) => ({
  code: `CMD-${String(index + 1).padStart(2, "0")}`,
  name,
  category: index % 3 === 0 ? "High Value" : index % 3 === 1 ? "Temperature Control" : "General Cargo",
}));

const SHIPPERS = [
  "PT Sinar Digital",
  "PT Medika Timur",
  "PT Samudra Timur",
  "PT Satelit Papua",
  "PT Papua Teknik",
  "PT Mitra Administrasi",
  "CV Timur Apparel",
  "PT Papua Print",
  "PT Alat Medis Papua",
  "PT Lab Timur",
  "Koperasi Petani Papua",
  "PT Retail Visual",
] as const;

const CONSIGNEES = [
  "PT Nusantara Elektrik",
  "PT Klinik Nusantara",
  "PT Bali Fresh Market",
  "PT Konektivitas Sumatra",
  "PT Sumatera Marine",
  "CV Bandung Trade",
  "PT Ponti Mode",
  "PT UPG Media",
  "PT Medis Sentral",
  "PT Energy Test",
  "Pasar Induk Surabaya",
  "PT Bali Promo",
] as const;

const OWNER_NAMES = ["Raka Pratama", "Naila Putri", "Dimas Rafi", "Mira Putri"] as const;

const SPECIAL_HANDLING = ["", "ELI", "COL", "PER", "DGR", "HEA"] as const;
const CARGO_MODES = ["Darat", "Udara", "Laut"] as const;
const SERVICE_TYPES = ["Economy", "Standard", "Express Priority"] as const;
const VEHICLE_TYPES = {
  Darat: "Truk Box",
  Udara: "Pesawat",
  Laut: "Kapal Cargo",
} as const;

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

const MIN_SEEDED_ROWS_PER_STATE = 1;
const SEEDED_FLIGHT_DAYS = 3;
const SEEDED_FLIGHTS_PER_DAY = FLIGHT_STATUS_CYCLE.length * MIN_SEEDED_ROWS_PER_STATE;
const SEEDED_SHIPMENT_COUNT = STATUS_CYCLE.length * MIN_SEEDED_ROWS_PER_STATE * 6;

const DASHBOARD_CHART_STATUS_CYCLE: ShipmentStatus[] = [
  ShipmentStatus.received,
  ShipmentStatus.sortation,
  ShipmentStatus.loaded_to_aircraft,
  ShipmentStatus.departed,
  ShipmentStatus.arrived,
];
const DASHBOARD_CHART_HOURS = [2, 6, 10, 14, 18, 22] as const;
const DASHBOARD_CHART_RATES = [560_000, 820_000, 1_260_000, 940_000, 680_000, 1_580_000] as const;

function pick<T>(items: readonly T[], index: number): T {
  return items[index % items.length]!;
}

function buildAwb(index: number) {
  const awb = buildAwbFromSerial("160", 1_000_000 + index);
  if (!isValidAwbChecksum(awb)) {
    throw new Error(`Seed AWB gagal checksum IATA Modulo 7: ${awb}`);
  }
  return awb;
}

function buildDocument(filePrefix: string, awb: string, index: number) {
  return {
    fileName: `${filePrefix}-${awb}.pdf`,
    mimeType: "application/pdf",
    fileSize: 62000 + (index % 40000),
    storageUrl: "/demo-assets/sample-document.pdf",
  };
}

function buildTrackingLogs(status: ShipmentStatus, receivedAt: Date, ownerName: string) {
  const logs: Array<{
    status: ShipmentStatus;
    message: string;
    location: string;
    actorName: string;
    createdAt: Date;
  }> = [
    {
      status: ShipmentStatus.received,
      message: "Shipment diterima di gudang udara.",
      location: "Gudang Udara",
      actorName: ownerName,
      createdAt: receivedAt,
    },
  ];

  if (status === ShipmentStatus.hold) {
    logs.push({
      status: ShipmentStatus.hold,
      message: "Shipment ditahan untuk review dokumen operasional.",
      location: "Review Desk",
      actorName: ownerName,
      createdAt: addMinutes(receivedAt, 45),
    });
    return logs;
  }

  if (
    status === ShipmentStatus.sortation ||
    status === ShipmentStatus.loaded_to_aircraft ||
    status === ShipmentStatus.departed ||
    status === ShipmentStatus.arrived
  ) {
    logs.push({
      status: ShipmentStatus.sortation,
      message: "Manifest dan label telah tervalidasi.",
      location: "Area Sortation",
      actorName: ownerName,
      createdAt: addMinutes(receivedAt, 35),
    });
  }

  if (
    status === ShipmentStatus.loaded_to_aircraft ||
    status === ShipmentStatus.departed ||
    status === ShipmentStatus.arrived
  ) {
    logs.push({
      status: ShipmentStatus.loaded_to_aircraft,
      message: "Shipment dimuat ke aircraft.",
      location: "Apron",
      actorName: ownerName,
      createdAt: addMinutes(receivedAt, 80),
    });
  }

  if (status === ShipmentStatus.departed || status === ShipmentStatus.arrived) {
    logs.push({
      status: ShipmentStatus.departed,
      message: "Flight departed sesuai manifest.",
      location: "Runway",
      actorName: "System",
      createdAt: addMinutes(receivedAt, 150),
    });
  }

  if (status === ShipmentStatus.arrived) {
    logs.push({
      status: ShipmentStatus.arrived,
      message: "Shipment tiba di terminal tujuan.",
      location: "Terminal Tujuan",
      actorName: "System",
      createdAt: addMinutes(receivedAt, 260),
    });
  }

  return logs;
}

function determineDocumentStatus(index: number, status: ShipmentStatus) {
  if (status === ShipmentStatus.hold) return ShipmentDocStatus.Partial;
  if (index % 6 === 0) return ShipmentDocStatus.Partial;
  return ShipmentDocStatus.Complete;
}

function determineReadiness(docStatus: ShipmentDocStatus, status: ShipmentStatus) {
  if (status === ShipmentStatus.hold) return ShipmentReadiness.Pending;
  if (docStatus !== ShipmentDocStatus.Complete) return ShipmentReadiness.Pending;
  return ShipmentReadiness.Ready;
}

function determineTransactionStatus(index: number, shippingRate: number) {
  if (shippingRate <= 0) return ShipmentTransactionStatus.Tidak_Ditagih;
  if (index % 6 === 0) return ShipmentTransactionStatus.Lunas;
  return ShipmentTransactionStatus.Belum_Lunas;
}

async function createManyInChunks<T extends Record<string, unknown>>(
  items: T[],
  chunkSize: number,
  handler: (chunk: T[]) => Promise<void>,
) {
  for (let index = 0; index < items.length; index += chunkSize) {
    const chunk = items.slice(index, index + chunkSize);
    if (chunk.length) {
      await handler(chunk);
    }
  }
}

function assertMinimumSeededRows(label: string, counts: Record<string, number>, states: readonly string[]) {
  const missingStates = states.filter((state) => (counts[state] ?? 0) < MIN_SEEDED_ROWS_PER_STATE);
  if (missingStates.length) {
    throw new Error(
      `${label} seed requires at least ${MIN_SEEDED_ROWS_PER_STATE} rows per state. Missing: ${missingStates
        .map((state) => `${state}=${counts[state] ?? 0}`)
        .join(", ")}`,
    );
  }
}

async function main() {
  await prisma.alertState.deleteMany();
  await prisma.publicComplaint.deleteMany();
  await prisma.recentAwbSearch.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.shipmentDocument.deleteMany();
  await prisma.trackingLog.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.flight.deleteMany();
  await prisma.userSetting.deleteMany();
  await prisma.user.deleteMany();
  await prisma.customerAccount.deleteMany();
  await prisma.commodity.deleteMany();
  await prisma.aircraft.deleteMany();
  await prisma.systemKpi.deleteMany();

  const now = new Date();
  for (let index = 0; index < 4; index += 1) {
    await prisma.systemKpi.create({
      data: {
        id: index === 0 ? "global" : `kpi-${String(index).padStart(2, "0")}`,
        platformUptime: Number((99.9 - index * 0.03).toFixed(2)),
      },
    });
  }

  const aircraft = [] as Awaited<ReturnType<typeof prisma.aircraft.create>>[];
  for (const spec of AIRCRAFT_SPECS) {
    aircraft.push(await prisma.aircraft.create({ data: spec }));
  }

  const commodities = [] as Awaited<ReturnType<typeof prisma.commodity.create>>[];
  for (const spec of COMMODITY_SPECS) {
    commodities.push(await prisma.commodity.create({ data: spec }));
  }

  const accountSpecs = [
    {
      code: "NUSFRESH",
      name: "PT Nusantara Fresh Cargo",
      contactName: "Ayu Mahendra",
      contactEmail: "ops@nusantarafresh.test",
      contactPhone: "+62-811-7000-123",
      status: "active" as const,
    },
    {
      code: "PAPUATECH",
      name: "PT Papua Teknik Mandiri",
      contactName: "Rizky Ananta",
      contactEmail: "dispatch@papuatech.test",
      contactPhone: "+62-811-7000-224",
      status: "active" as const,
    },
    {
      code: "SAMUDRA",
      name: "PT Samudra Distribusi Timur",
      contactName: "Sinta Rahma",
      contactEmail: "control@samudra.test",
      contactPhone: "+62-811-7000-325",
      status: "active" as const,
    },
    {
      code: "METROLINE",
      name: "PT Metroline Partner",
      contactName: "Bagus Hidayat",
      contactEmail: "ops@metroline.test",
      contactPhone: "+62-811-7000-426",
      status: "active" as const,
    },
    {
      code: "BALIEXP",
      name: "PT Bali Express Logistik",
      contactName: "Kadek Pramana",
      contactEmail: "cargo@baliexpress.test",
      contactPhone: "+62-811-7000-527",
      status: "active" as const,
    },
    {
      code: "KALTIMSUP",
      name: "PT Kaltim Supply Chain",
      contactName: "Maya Lestari",
      contactEmail: "ops@kaltimsupply.test",
      contactPhone: "+62-811-7000-628",
      status: "active" as const,
    },
    {
      code: "MEDANHUB",
      name: "PT Medan Hub Cargo",
      contactName: "Fadli Akbar",
      contactEmail: "control@medanhub.test",
      contactPhone: "+62-811-7000-729",
      status: "active" as const,
    },
    {
      code: "SUMSELGO",
      name: "PT Sumsel Go Freight",
      contactName: "Rani Puspita",
      contactEmail: "ops@sumselgo.test",
      contactPhone: "+62-811-7000-830",
      status: "active" as const,
    },
    {
      code: "PONTILOG",
      name: "PT Pontianak Logistik Prima",
      contactName: "Arman Yusuf",
      contactEmail: "dispatch@pontilog.test",
      contactPhone: "+62-811-7000-931",
      status: "active" as const,
    },
    {
      code: "BANDUNGX",
      name: "PT Bandung Xpress Cargo",
      contactName: "Sari Permata",
      contactEmail: "ops@bandungx.test",
      contactPhone: "+62-811-7001-032",
      status: "active" as const,
    },
  ];

  const customerAccounts = [] as Awaited<ReturnType<typeof prisma.customerAccount.create>>[];
  for (const spec of accountSpecs.slice(0, 6)) {
    customerAccounts.push(await prisma.customerAccount.create({ data: spec }));
  }

  for (let index = 0; index < MIN_SEEDED_ROWS_PER_STATE; index += 1) {
    customerAccounts.push(
      await prisma.customerAccount.create({
        data: {
          code: `HOLDACC${String(index + 1).padStart(2, "0")}`,
          name: `PT Arsip Pelanggan ${String(index + 1).padStart(2, "0")}`,
          contactName: `Kontak Arsip ${index + 1}`,
          contactEmail: `archive-${index + 1}@customer.test`,
          contactPhone: `+62-811-7100-${String(index + 1).padStart(3, "0")}`,
          status: "disabled",
        },
      }),
    );
  }

  const activeCustomerAccounts = customerAccounts.filter((account) => account.status === "active");
  const customerPrimaryAccount = customerAccounts[0]!;

  const users = await Promise.all([
    prisma.user.create({
      data: {
        name: "Mira Putri",
        email: "admin@skyhub.test",
        passwordHash: PASSWORD_HASH,
        role: UserRole.admin,
        station: "SOQ",
        settings: {
          create: {
            theme: "dark",
            compactRows: false,
            sidebarCollapsed: false,
            cutoffAlert: true,
            exceptionAlert: true,
            soundAlert: true,
            emailDigest: true,
            autoRefresh: true,
            refreshIntervalSeconds: 10,
            timezone: "Asia/Makassar",
          },
        },
      },
    }),
    prisma.user.create({
      data: {
        name: "Raka Pratama",
        email: "staff@skyhub.test",
        passwordHash: PASSWORD_HASH,
        role: UserRole.staff,
        station: "SOQ",
        settings: {
          create: {
            theme: "light",
            compactRows: true,
            sidebarCollapsed: false,
            cutoffAlert: true,
            exceptionAlert: true,
            soundAlert: false,
            emailDigest: false,
            autoRefresh: true,
            refreshIntervalSeconds: 15,
            timezone: "Asia/Makassar",
          },
        },
      },
    }),
    prisma.user.create({
      data: {
        name: "Naila Putri",
        email: "staff2@skyhub.test",
        passwordHash: PASSWORD_HASH,
        role: UserRole.staff,
        station: "SOQ",
        settings: {
          create: {
            theme: "light",
            compactRows: false,
            sidebarCollapsed: false,
            cutoffAlert: true,
            exceptionAlert: true,
            soundAlert: false,
            emailDigest: false,
            autoRefresh: true,
            refreshIntervalSeconds: 8,
            timezone: "Asia/Makassar",
          },
        },
      },
    }),
    prisma.user.create({
      data: {
        name: "Nadia Kusuma",
        email: "customer@skyhub.test",
        passwordHash: PASSWORD_HASH,
        role: UserRole.customer,
        station: "SOQ",
        customerAccountId: customerPrimaryAccount.id,
        settings: {
          create: {
            theme: "light",
            compactRows: false,
            sidebarCollapsed: false,
            cutoffAlert: true,
            exceptionAlert: true,
            soundAlert: false,
            emailDigest: false,
            autoRefresh: true,
            refreshIntervalSeconds: 15,
            timezone: "Asia/Makassar",
          },
        },
      },
    }),
    prisma.user.create({
      data: {
        name: "Dian Rahma",
        email: "invited-staff@skyhub.test",
        passwordHash: PASSWORD_HASH,
        role: UserRole.staff,
        station: "SOQ",
        status: "invited",
        settings: {
          create: {
            theme: "light",
            compactRows: false,
            sidebarCollapsed: false,
            cutoffAlert: true,
            exceptionAlert: true,
            soundAlert: false,
            emailDigest: false,
            autoRefresh: true,
            refreshIntervalSeconds: 15,
            timezone: "Asia/Makassar",
          },
        },
      },
    }),
    prisma.user.create({
      data: {
        name: "Bagas Prasetyo",
        email: "disabled-staff@skyhub.test",
        passwordHash: PASSWORD_HASH,
        role: UserRole.staff,
        station: "SOQ",
        status: "disabled",
        settings: {
          create: {
            theme: "dark",
            compactRows: false,
            sidebarCollapsed: true,
            cutoffAlert: true,
            exceptionAlert: true,
            soundAlert: false,
            emailDigest: true,
            autoRefresh: false,
            refreshIntervalSeconds: 30,
            timezone: "Asia/Makassar",
          },
        },
      },
    }),
    prisma.user.create({
      data: {
        name: "Aldi Saputra",
        email: "staff3@skyhub.test",
        passwordHash: PASSWORD_HASH,
        role: UserRole.staff,
        station: "CGK",
        settings: {
          create: {
            theme: "light",
            compactRows: true,
            sidebarCollapsed: false,
            cutoffAlert: true,
            exceptionAlert: true,
            soundAlert: false,
            emailDigest: false,
            autoRefresh: true,
            refreshIntervalSeconds: 10,
            timezone: "Asia/Makassar",
          },
        },
      },
    }),
    prisma.user.create({
      data: {
        name: "Laras Wibowo",
        email: "staff4@skyhub.test",
        passwordHash: PASSWORD_HASH,
        role: UserRole.staff,
        station: "SUB",
        settings: {
          create: {
            theme: "dark",
            compactRows: false,
            sidebarCollapsed: false,
            cutoffAlert: true,
            exceptionAlert: true,
            soundAlert: true,
            emailDigest: false,
            autoRefresh: true,
            refreshIntervalSeconds: 12,
            timezone: "Asia/Makassar",
          },
        },
      },
    }),
    prisma.user.create({
      data: {
        name: "Teguh Santoso",
        email: "customer2@skyhub.test",
        passwordHash: PASSWORD_HASH,
        role: UserRole.customer,
        station: "CGK",
        customerAccountId: customerAccounts[1]!.id,
        settings: {
          create: {
            theme: "light",
            compactRows: false,
            sidebarCollapsed: false,
            cutoffAlert: true,
            exceptionAlert: true,
            soundAlert: false,
            emailDigest: true,
            autoRefresh: true,
            refreshIntervalSeconds: 15,
            timezone: "Asia/Makassar",
          },
        },
      },
    }),
    prisma.user.create({
      data: {
        name: "Citra Melati",
        email: "customer3@skyhub.test",
        passwordHash: PASSWORD_HASH,
        role: UserRole.customer,
        station: "DPS",
        customerAccountId: customerAccounts[2]!.id,
        settings: {
          create: {
            theme: "light",
            compactRows: true,
            sidebarCollapsed: true,
            cutoffAlert: true,
            exceptionAlert: true,
            soundAlert: false,
            emailDigest: true,
            autoRefresh: true,
            refreshIntervalSeconds: 20,
            timezone: "Asia/Makassar",
          },
        },
      },
    }),
  ]);

  const [admin, staffPrimary, staffSecondary, customer, invitedStaff, disabledStaff] = users;

  for (let index = 0; index < 1; index += 1) {
    await prisma.user.create({
      data: {
        name: `Staf Operasional ${String(index + 5).padStart(2, "0")}`,
        email: `staff-extra-${index + 1}@skyhub.test`,
        passwordHash: PASSWORD_HASH,
        role: UserRole.staff,
        station: pick(["SOQ", "CGK", "SUB", "DPS"], index),
        status: "active",
        settings: {
          create: {
            theme: index % 2 === 0 ? "light" : "dark",
            compactRows: index % 2 === 0,
            sidebarCollapsed: false,
            cutoffAlert: true,
            exceptionAlert: true,
            soundAlert: false,
            emailDigest: false,
            autoRefresh: true,
            refreshIntervalSeconds: 10,
            timezone: "Asia/Makassar",
          },
        },
      },
    });
  }

  for (let index = 0; index < 1; index += 1) {
    await prisma.user.create({
      data: {
        name: `Undangan Staf ${String(index + 2).padStart(2, "0")}`,
        email: `invited-staff-${index + 2}@skyhub.test`,
        passwordHash: PASSWORD_HASH,
        role: UserRole.staff,
        station: pick(["SOQ", "CGK", "SUB", "DPS"], index),
        status: "invited",
        settings: {
          create: {
            theme: "light",
            compactRows: false,
            sidebarCollapsed: false,
            cutoffAlert: true,
            exceptionAlert: true,
            soundAlert: false,
            emailDigest: false,
            autoRefresh: true,
            refreshIntervalSeconds: 15,
            timezone: "Asia/Makassar",
          },
        },
      },
    });
  }

  for (let index = 0; index < 1; index += 1) {
    await prisma.user.create({
      data: {
        name: `Staf Nonaktif ${String(index + 2).padStart(2, "0")}`,
        email: `disabled-staff-${index + 2}@skyhub.test`,
        passwordHash: PASSWORD_HASH,
        role: UserRole.staff,
        station: pick(["SOQ", "CGK", "SUB", "DPS"], index),
        status: "disabled",
        settings: {
          create: {
            theme: "dark",
            compactRows: false,
            sidebarCollapsed: true,
            cutoffAlert: true,
            exceptionAlert: true,
            soundAlert: false,
            emailDigest: true,
            autoRefresh: false,
            refreshIntervalSeconds: 30,
            timezone: "Asia/Makassar",
          },
        },
      },
    });
  }

  const flights = [] as Awaited<ReturnType<typeof prisma.flight.create>>[];
  for (let index = 0; index < SEEDED_FLIGHT_DAYS * SEEDED_FLIGHTS_PER_DAY; index += 1) {
    const airlineCode = pick(SUPPORTED_AIRLINE_CODES, index);
    const numberPart = String(index % 3 === 0 ? 1000 + index : 700 + index);
    const flightNumber = buildFlightNumber(airlineCode, numberPart);
    const route = pick(ROUTES, index);
    const routeAircraft = pick(aircraft, index);

    const dayOffset = Math.floor(index / SEEDED_FLIGHTS_PER_DAY) - 1;
    const baseDay = addDays(now, dayOffset);
    const departureTime = set(baseDay, {
      hours: 1 + ((index * 3) % 22),
      minutes: (index % 6) * 10,
      seconds: 0,
      milliseconds: 0,
    });

    const arrivalTime = addHours(departureTime, 2 + (index % 4));
    const cargoCutoffTime = addMinutes(departureTime, -(70 + (index % 4) * 10));

    const status = pick(FLIGHT_STATUS_CYCLE, index);

    const gate = `${String.fromCharCode(65 + (index % 4))}${(index % 8) + 1}`;
    const remarks =
      status === FlightStatus.delayed
        ? "Penerbangan tertunda, pantau update slot keberangkatan."
        : status === FlightStatus.departed
          ? "Penerbangan telah berangkat sesuai manifest."
          : "Penerbangan siap proses muat sesuai jadwal.";

    const meta = getFlightVisualMeta(flightNumber);

    flights.push(
      await prisma.flight.create({
        data: {
          flightNumber,
          aircraftType: routeAircraft.type || meta.aircraftType,
          origin: route.origin,
          destination: route.destination,
          departureTime,
          arrivalTime,
          cargoCutoffTime,
          status,
          gate,
          remarks,
          imageUrl: meta.aircraftImageUrl,
          aircraftId: routeAircraft.id,
        },
      }),
    );
  }

  const createdShipments: Array<{
    id: string;
    awb: string;
    status: ShipmentStatus;
    createdById: string;
    customerAccountId: string | null;
    flightNumber: string;
    receivedAt: Date;
  }> = [];

  const activityRows: Array<{
    userId: string | null;
    action: string;
    targetType: string;
    targetId?: string;
    targetLabel: string;
    description: string;
    level: string;
    createdAt: Date;
  }> = [];

  for (let index = 0; index < SEEDED_SHIPMENT_COUNT; index += 1) {
    const flight = pick(flights, index);
    const awb = buildAwb(index);
    const isDashboardChartSample = index < DASHBOARD_CHART_STATUS_CYCLE.length;
    const status = isDashboardChartSample ? DASHBOARD_CHART_STATUS_CYCLE[index]! : pick(STATUS_CYCLE, index);
    const ownerName = pick(OWNER_NAMES, index);
    const createdById = index % 9 === 0 ? admin.id : index % 2 === 0 ? staffPrimary.id : staffSecondary.id;
    const customerAccount = pick(activeCustomerAccounts, Math.floor(index / STATUS_CYCLE.length));
    const commodityMaster = pick(commodities, index);
    const cargoMode = pick(CARGO_MODES, index);
    const vehicleType = VEHICLE_TYPES[cargoMode];
    const serviceType = pick(SERVICE_TYPES, index);
    const goodsStatus =
      status === ShipmentStatus.arrived
        ? "Sampai Tujuan"
        : status === ShipmentStatus.hold
          ? "Pending"
          : status === ShipmentStatus.departed || status === ShipmentStatus.loaded_to_aircraft
            ? "Dalam Pengiriman"
            : "Diproses";

    const receivedAt = isDashboardChartSample
      ? set(now, {
          hours: DASHBOARD_CHART_HOURS[index],
          minutes: (index + 1) * 7,
          seconds: 0,
          milliseconds: 0,
        })
      : index === 5
        ? set(now, {
            hours: DASHBOARD_CHART_HOURS[5],
            minutes: 20,
            seconds: 0,
            milliseconds: 0,
          })
        : subHours(now, (index % 72) + Math.floor(index / 100) * 8);
    const weightKg = isDashboardChartSample ? 48 + index * 14 : 60 + (index % 40) * 12;
    const serviceRate =
      serviceType === "Express Priority" ? 50_000 : serviceType === "Standard" ? 30_000 : 20_000;
    const shippingRate = isDashboardChartSample
      ? DASHBOARD_CHART_RATES[index]
      : index === 5
        ? DASHBOARD_CHART_RATES[5]
        : Math.round(weightKg * serviceRate);
    const transactionStatus = determineTransactionStatus(index, shippingRate);
    const docStatus = isDashboardChartSample && index === 0
      ? ShipmentDocStatus.Partial
      : determineDocumentStatus(index, status);
    const readiness = transactionStatus === ShipmentTransactionStatus.Belum_Lunas
      ? ShipmentReadiness.Pending
      : determineReadiness(docStatus, status);

    const trackingLogs = buildTrackingLogs(status, receivedAt, ownerName);

    const documents = [] as Array<ReturnType<typeof buildDocument>>;
    if (index % 3 === 0) {
      documents.push(buildDocument("manifest", awb, index));
    }
    if (index % 7 === 0) {
      documents.push(buildDocument("support", awb, index + 1));
    }

    const shipment = await prisma.shipment.create({
      data: {
        awb,
        sentAt: receivedAt,
        commodity: commodityMaster.name,
        cargoMode,
        senderPhone: `08${String(1200000000 + index).slice(0, 10)}`,
        origin: flight.origin,
        destination: flight.destination,
        pieces: 1,
        weightKg,
        volumeM3: Number((0.3 + (index % 8) * 0.25).toFixed(2)),
        specialHandling: pick(SPECIAL_HANDLING, index),
        serviceType,
        shippingRate,
        vehicleName: `SkyHub ${vehicleType} ${String((index % 9) + 1).padStart(2, "0")}`,
        vehicleType,
        vehicleCode: cargoMode === "Udara" ? flight.flightNumber : `${cargoMode.slice(0, 2).toUpperCase()}-${index + 100}`,
        vehicleCapacityKg: cargoMode === "Udara" ? 18000 : cargoMode === "Laut" ? 60000 : 9000,
        vehicleStatus: index % 11 === 0 ? "Maintenance" : "Aktif",
        goodsStatus,
        transactionStatus,
        docStatus,
        readiness,
        shipper: pick(SHIPPERS, index),
        consignee: pick(CONSIGNEES, index),
        forwarder: "SkyHub",
        ownerName,
        notes:
          status === ShipmentStatus.hold
            ? "Perlu review dokumen sebelum proses lanjut."
            : status === ShipmentStatus.arrived
              ? "Shipment sudah tiba di terminal tujuan."
              : "Diproses sesuai workflow operasional.",
        status,
        flightId: flight.id,
        createdById,
        customerAccountId: customerAccount.id,
        receivedAt,
        trackingLogs: {
          create: trackingLogs,
        },
        documents: {
          create: documents,
        },
      },
    });

    createdShipments.push({
      id: shipment.id,
      awb,
      status,
      createdById,
      customerAccountId: customerAccount.id,
      flightNumber: flight.flightNumber,
      receivedAt,
    });

  }

  const practiceStaleAt = subHours(now, 8);
  const practiceShipments = createdShipments.filter(
    (shipment) => shipment.customerAccountId !== customerPrimaryAccount.id,
  );
  const receivedShipments = practiceShipments.filter((shipment) => shipment.status === ShipmentStatus.received);
  const sortationShipments = practiceShipments.filter((shipment) => shipment.status === ShipmentStatus.sortation);
  const holdShipmentsForPractice = practiceShipments.filter((shipment) => shipment.status === ShipmentStatus.hold);
  const delayedFlights = flights.filter((flight) => flight.status === FlightStatus.delayed);
  const onTimeFlights = flights.filter((flight) => flight.status === FlightStatus.on_time);

  const unassignedTargets = receivedShipments.slice(0, 2);
  for (const shipment of unassignedTargets) {
    await prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        flightId: null,
        status: ShipmentStatus.received,
        updatedAt: subHours(now, 1),
        notes: "Belum dipasangkan ke penerbangan, menunggu slot manifest berikutnya.",
      },
    });
  }

  const staleTargets = sortationShipments.slice(0, 1);
  for (const shipment of staleTargets) {
    await prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        status: ShipmentStatus.sortation,
        updatedAt: practiceStaleAt,
        notes: "Status sortation belum bergerak lebih dari 6 jam, perlu scan ulang.",
      },
    });
  }

  const cutoffFlight = onTimeFlights[0] ?? flights[0];
  if (cutoffFlight) {
    const cutoffTime = addMinutes(now, 45);
    await prisma.flight.update({
      where: { id: cutoffFlight.id },
      data: {
        cargoCutoffTime: cutoffTime,
        departureTime: addHours(cutoffTime, 2),
        remarks: "Batas terima kargo mendekat, masih ada manifest pending untuk diprioritaskan.",
      },
    });

    const cutoffShipmentTargets = sortationShipments.slice(1, 3);
    for (const shipment of cutoffShipmentTargets) {
      await prisma.shipment.update({
        where: { id: shipment.id },
        data: {
          flightId: cutoffFlight.id,
          readiness: ShipmentReadiness.Pending,
          docStatus: ShipmentDocStatus.Partial,
          status: ShipmentStatus.sortation,
          updatedAt: subMinutes(now, 25),
        },
      });
    }
  }

  const capacityFlight =
    flights.find((flight) => {
      const linkedAircraft = aircraft.find((item) => item.id === flight.aircraftId);
      return linkedAircraft && linkedAircraft.capacityKg <= 8000;
    }) ?? flights[0];
  if (capacityFlight) {
    const capacityTargets = sortationShipments.slice(3, 5);
    let totalWeight = 0;
    for (const [index, shipment] of capacityTargets.entries()) {
      const weightKg = 3600 + index * 400;
      totalWeight += weightKg;
      await prisma.shipment.update({
        where: { id: shipment.id },
        data: {
          flightId: capacityFlight.id,
          weightKg,
          status: ShipmentStatus.sortation,
          readiness: ShipmentReadiness.Ready,
          docStatus: ShipmentDocStatus.Complete,
          updatedAt: subMinutes(now, 12 + index),
        },
      });
    }

    await prisma.flight.update({
      where: { id: capacityFlight.id },
      data: {
        remarks: `Muatan manifest ${totalWeight} kg mendekati batas kapasitas, siapkan rencana limpahan.`,
      },
    });
  }

  const reportedIssueTargets = holdShipmentsForPractice.slice(0, 2).length
    ? holdShipmentsForPractice.slice(0, 2)
    : practiceShipments.slice(0, 2);

  const demoShipment = reportedIssueTargets[0] ?? practiceShipments[0];
  const demoHoldShipment = holdShipmentsForPractice[0] ?? practiceShipments[1];
  const demoSortationShipment = sortationShipments[0] ?? practiceShipments[2];
  const demoFlight = cutoffFlight ?? flights[0];
  const demoCapacityFlight = capacityFlight ?? flights[1] ?? flights[0];

  activityRows.push(
    {
      userId: staffPrimary.id,
      action: "Buat Pengiriman",
      targetType: "shipment",
      targetId: demoShipment?.id,
      targetLabel: demoShipment?.awb ?? "SKH-DEMO-AWB",
      description: `Pengiriman baru ${demoShipment?.awb ?? "SKH-DEMO-AWB"} dibuat untuk rute ${demoFlight?.origin ?? "CGK"} -> ${demoFlight?.destination ?? "DPS"} (240 kg, Express).`,
      level: "success",
      createdAt: subMinutes(now, 88),
    },
    {
      userId: staffSecondary.id,
      action: "Ubah Status",
      targetType: "shipment",
      targetId: demoHoldShipment?.id,
      targetLabel: demoHoldShipment?.awb ?? "SKH-DEMO-HOLD",
      description: `Status ${demoHoldShipment?.awb ?? "SKH-DEMO-HOLD"} berubah dari Sortasi ke Tertahan: dokumen partial, menunggu review staf.`,
      level: "warning",
      createdAt: subMinutes(now, 72),
    },
    {
      userId: customer.id,
      action: "Laporkan Isu",
      targetType: "tracking",
      targetId: reportedIssueTargets[0]?.id,
      targetLabel: reportedIssueTargets[0]?.awb ?? "SKH-DEMO-ISSUE",
      description: `Pelanggan melaporkan AWB ${reportedIssueTargets[0]?.awb ?? "SKH-DEMO-ISSUE"} belum bergerak sesuai estimasi.`,
      level: "warning",
      createdAt: subMinutes(now, 35),
    },
    {
      userId: staffPrimary.id,
      action: "Tangani Peringatan",
      targetType: "alert",
      targetLabel: "shipment-hold:demo",
      description: "Staf menandai peringatan pengiriman tertahan sedang ditangani di meja sortasi.",
      level: "info",
      createdAt: subMinutes(now, 42),
    },
    {
      userId: staffSecondary.id,
      action: "Keluhan Publik Masuk",
      targetType: "complaint",
      targetLabel: "SKH-DEMO-0001",
      description: "Keluhan pengiriman masuk dari halaman Tentang Kami dan menunggu tinjauan.",
      level: "warning",
      createdAt: subMinutes(now, 55),
    },
    {
      userId: staffPrimary.id,
      action: "Perbarui Status Keluhan",
      targetType: "complaint",
      targetLabel: "SKH-DEMO-0002",
      description: "Staf memindahkan keluhan penerbangan ke status ditinjau.",
      level: "info",
      createdAt: subMinutes(now, 48),
    },
    {
      userId: staffPrimary.id,
      action: "Perbarui Penerbangan",
      targetType: "flight",
      targetId: demoFlight?.id,
      targetLabel: demoFlight?.flightNumber ?? "GA-402",
      description: `Batas terima kargo ${demoFlight?.flightNumber ?? "GA-402"} diperketat; manifest pending diprioritaskan sebelum keberangkatan.`,
      level: "warning",
      createdAt: subMinutes(now, 30),
    },
    {
      userId: staffSecondary.id,
      action: "Perbarui Penerbangan",
      targetType: "flight",
      targetId: demoCapacityFlight?.id,
      targetLabel: demoCapacityFlight?.flightNumber ?? "GA-118",
      description: `Muatan manifest ${demoCapacityFlight?.flightNumber ?? "GA-118"} mendekati batas kapasitas, rencana limpahan disiapkan.`,
      level: "warning",
      createdAt: subMinutes(now, 18),
    },
    {
      userId: staffPrimary.id,
      action: "Unggah Dokumen",
      targetType: "document",
      targetId: demoSortationShipment?.id,
      targetLabel: `manifest-${demoSortationShipment?.awb ?? "demo"}.pdf`,
      description: `manifest-${demoSortationShipment?.awb ?? "demo"}.pdf diunggah untuk pengiriman ${demoSortationShipment?.awb ?? "SKH-DEMO-DOC"}.`,
      level: "success",
      createdAt: subMinutes(now, 64),
    },
    {
      userId: admin.id,
      action: "Undang Pengguna",
      targetType: "user",
      targetLabel: invitedStaff.email,
      description: "Admin menambahkan akun staff cadangan untuk roster berikutnya.",
      level: "success",
      createdAt: subHours(now, 6),
    },
    {
      userId: admin.id,
      action: "Perbarui Hak Akses Pengguna",
      targetType: "user",
      targetLabel: disabledStaff.email,
      description: "Akun staff nonaktif ditandai disabled setelah evaluasi roster.",
      level: "warning",
      createdAt: subHours(now, 10),
    },
    {
      userId: admin.id,
      action: "Buat Akun Pelanggan",
      targetType: "customer-account",
      targetLabel: customerPrimaryAccount.name,
      description: `Akun pelanggan ${customerPrimaryAccount.name} dibuat untuk portal pelacakan B2B.`,
      level: "success",
      createdAt: subHours(now, 14),
    },
    {
      userId: staffSecondary.id,
      action: "Validasi Gagal",
      targetType: "shipment",
      targetId: demoSortationShipment?.id,
      targetLabel: demoSortationShipment?.awb ?? "SKH-DEMO-ERR",
      description: `Validasi gagal ${demoSortationShipment?.awb ?? "SKH-DEMO-ERR"}: berat manifest melebihi slot tersisa pada ${demoCapacityFlight?.flightNumber ?? "GA-118"}.`,
      level: "error",
      createdAt: subMinutes(now, 95),
    },
  );

  const complaintSpecs: Array<{
    ticketCode: string;
    reporterName: string;
    contact: string;
    topic: ComplaintTopic;
    referenceNo: string | null;
    message: string;
    status: ComplaintStatus;
    handledById: string | null;
    handledByName: string | null;
    handledAt: Date | null;
    resolutionNote: string | null;
    escalationDesk?: string | null;
    escalationReason?: string | null;
    escalatedAt?: Date | null;
    escalatedById?: string | null;
    escalatedByName?: string | null;
    createdAt: Date;
  }> = [
    {
      ticketCode: "SKH-DEMO-0001",
      reporterName: "Andi Wijaya",
      contact: "andi.wijaya@email.test",
      topic: ComplaintTopic.shipment,
      referenceNo: reportedIssueTargets[0]?.awb ?? practiceShipments[0]?.awb ?? null,
      message: "AWB saya sudah 2 hari tidak ada update status di portal pelacakan.",
      status: ComplaintStatus.new,
      handledById: null,
      handledByName: null,
      handledAt: null,
      resolutionNote: null,
      createdAt: subHours(now, 5),
    },
    {
      ticketCode: "SKH-DEMO-0002",
      reporterName: "Siti Rahmawati",
      contact: "+62-812-4400-221",
      topic: ComplaintTopic.flight,
      referenceNo: delayedFlights[0]?.flightNumber ?? flights[0]?.flightNumber ?? null,
      message: "Penerbangan tertunda tanpa pemberitahuan resmi ke shipper kami.",
      status: ComplaintStatus.in_review,
      handledById: staffPrimary.id,
      handledByName: staffPrimary.name,
      handledAt: subMinutes(now, 40),
      resolutionNote: null,
      createdAt: subHours(now, 8),
    },
    {
      ticketCode: "SKH-DEMO-0003",
      reporterName: "Budi Santoso",
      contact: "budi.santoso@logistik.test",
      topic: ComplaintTopic.document,
      referenceNo: holdShipmentsForPractice[0]?.awb ?? practiceShipments[1]?.awb ?? null,
      message: "Invoice dan manifest tidak cocok untuk satu AWB yang sama.",
      status: ComplaintStatus.resolved,
      handledById: staffSecondary.id,
      handledByName: staffSecondary.name,
      handledAt: subHours(now, 2),
      resolutionNote: "Dokumen sudah diselaraskan dan dikirim ulang ke pelanggan.",
      createdAt: subHours(now, 20),
    },
    {
      ticketCode: "SKH-DEMO-0004",
      reporterName: "Rina Melati",
      contact: "+62-813-5500-884",
      topic: ComplaintTopic.service,
      referenceNo: null,
      message: "Respon tim customer service di luar jam operasional terlalu lambat.",
      status: ComplaintStatus.closed,
      handledById: admin.id,
      handledByName: admin.name,
      handledAt: subHours(now, 12),
      resolutionNote: "SLA respon dijelaskan ulang dan nomor darurat operasional dibagikan.",
      createdAt: subDays(now, 2),
    },
    {
      ticketCode: "SKH-DEMO-0005",
      reporterName: "Hendra Kusuma",
      contact: "hendra.k@partner.test",
      topic: ComplaintTopic.other,
      referenceNo: null,
      message: "Permintaan kunjungan gudang untuk audit internal belum ditindaklanjuti.",
      status: ComplaintStatus.escalated,
      handledById: staffPrimary.id,
      handledByName: staffPrimary.name,
      handledAt: subHours(now, 2),
      resolutionNote: null,
      escalationDesk: "Duty Manager Bandara",
      escalationReason: "Perlu persetujuan akses area gudang dan penjadwalan pendamping keamanan.",
      escalatedAt: subHours(now, 1),
      escalatedById: staffPrimary.id,
      escalatedByName: staffPrimary.name,
      createdAt: subHours(now, 3),
    },
  ];

  for (const spec of complaintSpecs) {
    await prisma.publicComplaint.create({ data: spec });
  }

  await createManyInChunks(activityRows, 500, async (chunk) => {
    await prisma.activityLog.createMany({ data: chunk });
  });

  const notifications: Array<{
    userId: string;
    title: string;
    message: string;
    href: string | null;
    type: string;
    read: boolean;
    createdAt: Date;
  }> = [];

  const holdShipments = createdShipments.filter((shipment) => shipment.status === ShipmentStatus.hold);
  const customerShipments = createdShipments.filter(
    (shipment) => shipment.customerAccountId === customerPrimaryAccount.id,
  );

  for (let index = 0; index < 10; index += 1) {
    const shipment = pick(holdShipments.length ? holdShipments : createdShipments, index);
    notifications.push({
      userId: staffPrimary.id,
      title: "Perlu Review Shipment",
      message: `AWB ${shipment.awb} memerlukan tindak lanjut operasional.`,
      href: `/awb-tracking?awb=${shipment.awb}`,
      type: "warning",
      read: index % 5 === 0,
      createdAt: subMinutes(now, 6 + index * 4),
    });
  }

  for (let index = 0; index < 8; index += 1) {
    const flight = pick(flights, index);
    notifications.push({
      userId: staffSecondary.id,
      title: "Update Papan Flight",
      message: `Pantau status ${flight.flightNumber} untuk sinkronisasi manifest terbaru.`,
      href: `/flight-board?query=${flight.flightNumber}`,
      type: index % 6 === 0 ? "warning" : "info",
      read: index % 4 === 0,
      createdAt: subMinutes(now, 8 + index * 6),
    });
  }

  for (let index = 0; index < 10; index += 1) {
    const shipment = pick(customerShipments.length ? customerShipments : createdShipments, index);
    notifications.push({
      userId: customer.id,
      title: shipment.status === ShipmentStatus.arrived ? "Shipment Tiba" : "Update Tracking",
      message:
        shipment.status === ShipmentStatus.arrived
          ? `AWB ${shipment.awb} tercatat tiba di tujuan.`
          : `AWB ${shipment.awb} mengalami pembaruan status operasional.`,
      href: `/awb-tracking?awb=${shipment.awb}`,
      type: shipment.status === ShipmentStatus.arrived ? "success" : "info",
      read: index % 3 === 0,
      createdAt: subMinutes(now, 10 + index * 7),
    });
  }

  notifications.push(
    {
      userId: invitedStaff.id,
      title: "Undangan Akun Siap",
      message: "Akun staff cadangan siap diaktifkan saat roster berikutnya dimulai.",
      href: "/settings",
      type: "info",
      read: false,
      createdAt: subHours(now, 4),
    },
    {
      userId: disabledStaff.id,
      title: "Akses Dinonaktifkan",
      message: "Akun ini dinonaktifkan sementara sampai jadwal kerja dipulihkan.",
      href: "/settings",
      type: "warning",
      read: true,
      createdAt: subHours(now, 9),
    },
  );

  await createManyInChunks(notifications, 300, async (chunk) => {
    await prisma.notification.createMany({ data: chunk });
  });

  const recentSearches: Array<{ userId: string; awb: string; createdAt: Date }> = [];

  for (let index = 0; index < 8; index += 1) {
    const shipment = pick(customerShipments.length ? customerShipments : createdShipments, index);
    recentSearches.push({
      userId: customer.id,
      awb: shipment.awb,
      createdAt: subMinutes(now, 3 + index * 5),
    });
  }

  for (let index = 0; index < 10; index += 1) {
    const shipment = pick(createdShipments, index * 2);
    recentSearches.push({
      userId: staffPrimary.id,
      awb: shipment.awb,
      createdAt: subMinutes(now, 4 + index * 4),
    });
  }

  for (let index = 0; index < 8; index += 1) {
    const shipment = pick(createdShipments, index * 3);
    recentSearches.push({
      userId: admin.id,
      awb: shipment.awb,
      createdAt: subMinutes(now, 6 + index * 8),
    });
  }

  await createManyInChunks(recentSearches, 400, async (chunk) => {
    await prisma.recentAwbSearch.createMany({ data: chunk });
  });

  const shipmentStatusCounts = await prisma.shipment.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  assertMinimumSeededRows(
    "Shipment",
    Object.fromEntries(shipmentStatusCounts.map((item) => [item.status, item._count._all])),
    STATUS_CYCLE,
  );

  const customerShipmentStatusCounts = await prisma.shipment.groupBy({
    by: ["status"],
    where: { customerAccountId: customerPrimaryAccount.id },
    _count: { _all: true },
  });
  assertMinimumSeededRows(
    "Primary customer shipment",
    Object.fromEntries(customerShipmentStatusCounts.map((item) => [item.status, item._count._all])),
    STATUS_CYCLE,
  );

  const flightStatusCounts = await prisma.flight.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  assertMinimumSeededRows(
    "Flight",
    Object.fromEntries(flightStatusCounts.map((item) => [item.status, item._count._all])),
    FLIGHT_STATUS_CYCLE,
  );

  const userStatusCounts = await prisma.user.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  assertMinimumSeededRows(
    "User",
    Object.fromEntries(userStatusCounts.map((item) => [item.status, item._count._all])),
    ["active", "invited", "disabled"],
  );

  const accountStatusCounts = await prisma.customerAccount.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  assertMinimumSeededRows(
    "Customer account",
    Object.fromEntries(accountStatusCounts.map((item) => [item.status, item._count._all])),
    ["active", "disabled"],
  );

  const activityLevelCounts = await prisma.activityLog.groupBy({
    by: ["level"],
    _count: { _all: true },
  });
  assertMinimumSeededRows(
    "Activity log",
    Object.fromEntries(activityLevelCounts.map((item) => [item.level, item._count._all])),
    ["success", "info", "warning", "error"],
  );

  const complaintStatusCounts = await prisma.publicComplaint.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  assertMinimumSeededRows(
    "Public complaint",
    Object.fromEntries(complaintStatusCounts.map((item) => [item.status, item._count._all])),
    ["new", "in_review", "escalated", "resolved", "closed"],
  );

  const complaintTopicCounts = await prisma.publicComplaint.groupBy({
    by: ["topic"],
    _count: { _all: true },
  });
  assertMinimumSeededRows(
    "Public complaint topic",
    Object.fromEntries(complaintTopicCounts.map((item) => [item.topic, item._count._all])),
    ["shipment", "flight", "document", "service", "other"],
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
