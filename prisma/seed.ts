import { hashSync } from "bcryptjs";
import { addDays, addHours, addMinutes, set, subHours, subMinutes } from "date-fns";
import { FlightStatus, PrismaClient, ShipmentStatus, UserRole } from "@prisma/client";
import { SHIPMENT_STATUS_LABELS } from "../src/lib/constants";
import {
  buildFlightNumber,
  getFlightVisualMeta,
  SUPPORTED_AIRLINE_CODES,
} from "../src/lib/flight-meta";

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

const CITY_SPECS = [
  { code: "SOQ", name: "Sorong", province: "Papua Barat Daya" },
  { code: "CGK", name: "Tangerang", province: "Banten" },
  { code: "SUB", name: "Surabaya", province: "Jawa Timur" },
  { code: "DPS", name: "Denpasar", province: "Bali" },
  { code: "UPG", name: "Makassar", province: "Sulawesi Selatan" },
  { code: "BPN", name: "Balikpapan", province: "Kalimantan Timur" },
  { code: "KNO", name: "Deli Serdang", province: "Sumatera Utara" },
  { code: "PLM", name: "Palembang", province: "Sumatera Selatan" },
  { code: "PNK", name: "Pontianak", province: "Kalimantan Barat" },
  { code: "BDO", name: "Bandung", province: "Jawa Barat" },
] as const;

const AIRPORT_SPECS = [
  { code: "SOQ", name: "Domine Eduard Osok" },
  { code: "CGK", name: "Soekarno-Hatta" },
  { code: "SUB", name: "Juanda" },
  { code: "DPS", name: "I Gusti Ngurah Rai" },
  { code: "UPG", name: "Sultan Hasanuddin" },
  { code: "BPN", name: "Sultan Aji Muhammad Sulaiman Sepinggan" },
  { code: "KNO", name: "Kualanamu" },
  { code: "PLM", name: "Sultan Mahmud Badaruddin II" },
  { code: "PNK", name: "Supadio" },
  { code: "BDO", name: "Husein Sastranegara" },
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

const CARGO_ITEM_SPECS = [
  "Smartphone Retail Pack",
  "Vaksin Klinik",
  "Lobster Chilled Box",
  "Router BTS",
  "Bearing Mesin",
  "Dokumen Tender",
  "Tas Fashion",
  "Brosur Promosi",
  "Monitor Pasien",
  "Sample Laboratorium",
  "Kopi Kemasan",
  "Display Acrylic",
] as const;

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
const SERVICE_TYPES = ["Biasa", "Cepat", "VVIP"] as const;
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

const MIN_SEEDED_ROWS_PER_STATE = 10;
const SEEDED_FLIGHT_DAYS = 3;
const SEEDED_FLIGHTS_PER_DAY = FLIGHT_STATUS_CYCLE.length * MIN_SEEDED_ROWS_PER_STATE;
const SEEDED_SHIPMENT_COUNT = STATUS_CYCLE.length * MIN_SEEDED_ROWS_PER_STATE * 10;

function pick<T>(items: readonly T[], index: number): T {
  return items[index % items.length]!;
}

function buildAwb(index: number) {
  return `160-${String(10000000 + index).padStart(8, "0")}`;
}

function buildDocument(filePrefix: string, awb: string, index: number) {
  const useCsv = index % 3 === 0;
  return {
    fileName: `${filePrefix}-${awb}.${useCsv ? "csv" : "pdf"}`,
    mimeType: useCsv ? "text/csv" : "application/pdf",
    fileSize: useCsv ? 3000 + (index % 900) : 62000 + (index % 40000),
    storageUrl: useCsv ? "/demo-assets/sample-data.csv" : "/demo-assets/sample-document.pdf",
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
  if (status === ShipmentStatus.hold) return "Review";
  if (index % 6 === 0) return "Partial";
  return "Complete";
}

function determineReadiness(docStatus: string, status: ShipmentStatus) {
  if (status === ShipmentStatus.hold) return "Pending";
  if (docStatus !== "Complete") return "Pending";
  return "Ready";
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
  await prisma.recentAwbSearch.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.shipmentDocument.deleteMany();
  await prisma.trackingLog.deleteMany();
  await prisma.shipmentItem.deleteMany();
  await prisma.shipmentDetail.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.flight.deleteMany();
  await prisma.userSetting.deleteMany();
  await prisma.user.deleteMany();
  await prisma.customerAccount.deleteMany();
  await prisma.cargoItem.deleteMany();
  await prisma.tariff.deleteMany();
  await prisma.commodity.deleteMany();
  await prisma.aircraft.deleteMany();
  await prisma.airport.deleteMany();
  await prisma.city.deleteMany();
  await prisma.systemKpi.deleteMany();

  const now = new Date();
  for (let index = 0; index < 10; index += 1) {
    await prisma.systemKpi.create({
      data: {
        id: index === 0 ? "global" : `kpi-${String(index).padStart(2, "0")}`,
        platformUptime: Number((99.9 - index * 0.03).toFixed(2)),
      },
    });
  }

  const cities = [] as Awaited<ReturnType<typeof prisma.city.create>>[];
  for (const spec of CITY_SPECS) {
    cities.push(await prisma.city.create({ data: spec }));
  }

  const cityByCode = new Map(cities.map((city) => [city.code, city]));
  const airports = [] as Awaited<ReturnType<typeof prisma.airport.create>>[];
  for (const spec of AIRPORT_SPECS) {
    const city = cityByCode.get(spec.code);
    if (!city) throw new Error(`Missing city for airport ${spec.code}`);
    airports.push(
      await prisma.airport.create({
        data: {
          ...spec,
          cityId: city.id,
        },
      }),
    );
  }

  const airportByCode = new Map(airports.map((airport) => [airport.code, airport]));

  const aircraft = [] as Awaited<ReturnType<typeof prisma.aircraft.create>>[];
  for (const spec of AIRCRAFT_SPECS) {
    aircraft.push(await prisma.aircraft.create({ data: spec }));
  }

  const commodities = [] as Awaited<ReturnType<typeof prisma.commodity.create>>[];
  for (const spec of COMMODITY_SPECS) {
    commodities.push(await prisma.commodity.create({ data: spec }));
  }

  const cargoItems = [] as Awaited<ReturnType<typeof prisma.cargoItem.create>>[];
  for (let index = 0; index < CARGO_ITEM_SPECS.length; index += 1) {
    cargoItems.push(
      await prisma.cargoItem.create({
        data: {
          sku: `ITEM-${String(index + 1).padStart(3, "0")}`,
          name: CARGO_ITEM_SPECS[index]!,
          commodityId: pick(commodities, index).id,
          unit: index % 4 === 0 ? "box" : "pcs",
        },
      }),
    );
  }

  const tariffs = [] as Awaited<ReturnType<typeof prisma.tariff.create>>[];
  for (let index = 0; index < 10; index += 1) {
    const route = pick([...ROUTES, { origin: "SOQ", destination: "BDO" }, { origin: "CGK", destination: "SOQ" }], index);
    const originAirport = airportByCode.get(route.origin);
    const destinationAirport = airportByCode.get(route.destination);
    if (!originAirport || !destinationAirport) {
      throw new Error(`Missing tariff airport for ${route.origin}-${route.destination}`);
    }
    tariffs.push(
      await prisma.tariff.create({
        data: {
          code: `TRF-${route.origin}-${route.destination}`,
          originAirportId: originAirport.id,
          destinationAirportId: destinationAirport.id,
          serviceType: index % 2 === 0 ? "Regular" : "Priority",
          pricePerKg: 18000 + index * 1250,
          minimumCharge: 250000 + index * 15000,
        },
      }),
    );
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
  for (const spec of accountSpecs) {
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
            refreshIntervalSeconds: 5,
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

  for (let index = 0; index < 2; index += 1) {
    await prisma.user.create({
      data: {
        name: `Staff Operasional ${String(index + 5).padStart(2, "0")}`,
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

  for (let index = 0; index < 9; index += 1) {
    await prisma.user.create({
      data: {
        name: `Undangan Staff ${String(index + 2).padStart(2, "0")}`,
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

  for (let index = 0; index < 9; index += 1) {
    await prisma.user.create({
      data: {
        name: `Staff Nonaktif ${String(index + 2).padStart(2, "0")}`,
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
    const routeOriginAirport = airportByCode.get(route.origin);
    const routeDestinationAirport = airportByCode.get(route.destination);
    const routeAircraft = pick(aircraft, index);
    if (!routeOriginAirport || !routeDestinationAirport) {
      throw new Error(`Missing flight airport for ${route.origin}-${route.destination}`);
    }

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
          originAirportId: routeOriginAirport.id,
          destinationAirportId: routeDestinationAirport.id,
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
    const status = pick(STATUS_CYCLE, index);
    const ownerName = pick(OWNER_NAMES, index);
    const createdById = index % 9 === 0 ? admin.id : index % 2 === 0 ? staffPrimary.id : staffSecondary.id;
    const customerAccount = pick(activeCustomerAccounts, Math.floor(index / STATUS_CYCLE.length));
    const commodityMaster = pick(commodities, index);
    const tariff = pick(tariffs, index);
    const firstCargoItem = pick(cargoItems, index);
    const secondCargoItem = pick(cargoItems, index + 3);
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

    const receivedAt = subHours(now, (index % 72) + Math.floor(index / 100) * 8);
    const weightKg = 60 + (index % 40) * 12;
    const docStatus = determineDocumentStatus(index, status);
    const readiness = determineReadiness(docStatus, status);

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
        pieces: 2 + (index % 23),
        weightKg,
        volumeM3: Number((0.3 + (index % 8) * 0.25).toFixed(2)),
        specialHandling: pick(SPECIAL_HANDLING, index),
        serviceType,
        shippingRate: Math.max(tariff.minimumCharge, Math.round(weightKg * tariff.pricePerKg)),
        vehicleName: `SkyHub ${vehicleType} ${String((index % 9) + 1).padStart(2, "0")}`,
        vehicleType,
        vehicleCode: cargoMode === "Udara" ? flight.flightNumber : `${cargoMode.slice(0, 2).toUpperCase()}-${index + 100}`,
        vehicleCapacityKg: cargoMode === "Udara" ? 18000 : cargoMode === "Laut" ? 60000 : 9000,
        vehicleStatus: index % 11 === 0 ? "Maintenance" : "Aktif",
        goodsStatus,
        transactionStatus: status === ShipmentStatus.arrived ? "Selesai" : index % 4 === 0 ? "Lunas" : "Pending",
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
        commodityId: commodityMaster.id,
        originAirportId: flight.originAirportId,
        destinationAirportId: flight.destinationAirportId,
        tariffId: tariff.id,
        receivedAt,
        detail: {
          create: {
            serviceLevel: index % 2 === 0 ? "Regular" : "Priority",
            packagingType: index % 3 === 0 ? "Thermal Box" : index % 3 === 1 ? "Carton" : "Pallet",
            insuranceValue: 500000 + index * 7500,
            declaredValue: 1000000 + index * 12500,
          },
        },
        shipmentItems: {
          create: [
            {
              cargoItemId: firstCargoItem.id,
              quantity: 1 + (index % 6),
              declaredValue: 250000 + index * 5000,
            },
            {
              cargoItemId: secondCargoItem.id,
              quantity: 2 + (index % 4),
              declaredValue: 175000 + index * 3500,
            },
          ],
        },
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

    activityRows.push(
      {
        userId: createdById,
        action: "Buat Shipment",
        targetType: "shipment",
        targetId: shipment.id,
        targetLabel: awb,
        description: `Shipment ${awb} dibuat untuk rute ${shipment.origin} -> ${shipment.destination}.`,
        level: "success",
        createdAt: addMinutes(receivedAt, 4),
      },
      {
        userId: createdById,
        action: "Ubah Status",
        targetType: "tracking",
        targetId: shipment.id,
        targetLabel: awb,
        description: `Status terbaru ${awb}: ${SHIPMENT_STATUS_LABELS[status]}.`,
        level: status === ShipmentStatus.hold ? "warning" : "info",
        createdAt: addMinutes(receivedAt, 16),
      },
    );
  }

  activityRows.push(
    {
      userId: customer.id,
      action: "Login",
      targetType: "session",
      targetLabel: "Portal Pelanggan",
      description: "Pelanggan login untuk memantau shipment akun perusahaan.",
      level: "info",
      createdAt: subMinutes(now, 24),
    },
    {
      userId: staffPrimary.id,
      action: "Login",
      targetType: "session",
      targetLabel: "Konsol Operasional",
      description: "Staff login ke sistem untuk memantau workflow harian.",
      level: "info",
      createdAt: subMinutes(now, 20),
    },
    {
      userId: admin.id,
      action: "Perbarui Pengaturan",
      targetType: "settings",
      targetLabel: "Preferensi Tampilan",
      description: "Admin memperbarui preferensi workspace lintas tim.",
      level: "info",
      createdAt: subHours(now, 2),
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
  );

  for (let index = 0; index < MIN_SEEDED_ROWS_PER_STATE; index += 1) {
    const shipment = pick(createdShipments, index * 11);
    activityRows.push({
      userId: admin.id,
      action: "Validasi Gagal",
      targetType: "shipment",
      targetId: shipment.id,
      targetLabel: shipment.awb,
      description: `Simulasi error validasi untuk AWB ${shipment.awb} agar state galat audit tetap terisi.`,
      level: "error",
      createdAt: subMinutes(now, 90 + index * 9),
    });
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

  for (let index = 0; index < 36; index += 1) {
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

  for (let index = 0; index < 28; index += 1) {
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

  for (let index = 0; index < 36; index += 1) {
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

  for (let index = 0; index < 30; index += 1) {
    const shipment = pick(customerShipments.length ? customerShipments : createdShipments, index);
    recentSearches.push({
      userId: customer.id,
      awb: shipment.awb,
      createdAt: subMinutes(now, 3 + index * 5),
    });
  }

  for (let index = 0; index < 35; index += 1) {
    const shipment = pick(createdShipments, index * 2);
    recentSearches.push({
      userId: staffPrimary.id,
      awb: shipment.awb,
      createdAt: subMinutes(now, 4 + index * 4),
    });
  }

  for (let index = 0; index < 25; index += 1) {
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
