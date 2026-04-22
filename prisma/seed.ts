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

const STATUS_CYCLE: ShipmentStatus[] = [
  ShipmentStatus.received,
  ShipmentStatus.sortation,
  ShipmentStatus.loaded_to_aircraft,
  ShipmentStatus.departed,
  ShipmentStatus.arrived,
  ShipmentStatus.received,
  ShipmentStatus.sortation,
  ShipmentStatus.hold,
];

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

async function main() {
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
  await prisma.systemKpi.deleteMany();

  const now = new Date();
  await prisma.systemKpi.upsert({
    where: { id: "global" },
    update: {
      platformUptime: 99.98,
    },
    create: {
      id: "global",
      platformUptime: 99.98,
    },
  });

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
  ];

  const customerAccounts = [] as Awaited<ReturnType<typeof prisma.customerAccount.create>>[];
  for (const spec of accountSpecs) {
    customerAccounts.push(await prisma.customerAccount.create({ data: spec }));
  }

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
  ]);

  const [admin, staffPrimary, staffSecondary, customer, invitedStaff, disabledStaff] = users;

  const flights = [] as Awaited<ReturnType<typeof prisma.flight.create>>[];
  for (let index = 0; index < 40; index += 1) {
    const airlineCode = pick(SUPPORTED_AIRLINE_CODES, index);
    const numberPart = String(index % 3 === 0 ? 1000 + index : 700 + index);
    const flightNumber = buildFlightNumber(airlineCode, numberPart);
    const route = pick(ROUTES, index);

    const dayOffset = Math.floor(index / 8) - 2;
    const baseDay = addDays(now, dayOffset);
    const departureTime = set(baseDay, {
      hours: 5 + ((index * 3) % 17),
      minutes: (index % 4) * 10,
      seconds: 0,
      milliseconds: 0,
    });

    const arrivalTime = addHours(departureTime, 2 + (index % 4));
    const cargoCutoffTime = addMinutes(departureTime, -(70 + (index % 4) * 10));

    const status =
      departureTime.getTime() < now.getTime() - 45 * 60 * 1000
        ? FlightStatus.departed
        : index % 6 === 0
          ? FlightStatus.delayed
          : FlightStatus.on_time;

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
          aircraftType: meta.aircraftType,
          origin: route.origin,
          destination: route.destination,
          departureTime,
          arrivalTime,
          cargoCutoffTime,
          status,
          gate,
          remarks,
          imageUrl: meta.aircraftImageUrl,
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

  for (let index = 0; index < 400; index += 1) {
    const flight = pick(flights, index);
    const awb = buildAwb(index);
    const status = pick(STATUS_CYCLE, index);
    const ownerName = pick(OWNER_NAMES, index);
    const createdById = index % 9 === 0 ? admin.id : index % 2 === 0 ? staffPrimary.id : staffSecondary.id;
    const customerAccount = index % 2 === 0 ? pick(customerAccounts, index) : null;

    const receivedAt = subHours(now, (index % 72) + Math.floor(index / 100) * 8);
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
        commodity: pick(COMMODITIES, index),
        origin: flight.origin,
        destination: flight.destination,
        pieces: 2 + (index % 23),
        weightKg: 60 + (index % 40) * 12,
        volumeM3: Number((0.3 + (index % 8) * 0.25).toFixed(2)),
        specialHandling: pick(SPECIAL_HANDLING, index),
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
        customerAccountId: customerAccount?.id ?? null,
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
      customerAccountId: customerAccount?.id ?? null,
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

  for (let index = 0; index < 24; index += 1) {
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
