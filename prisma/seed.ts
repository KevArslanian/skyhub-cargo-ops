import { hashSync } from "bcryptjs";
import { addHours, addMinutes, set, subHours, subMinutes } from "date-fns";
import { FlightStatus, PrismaClient, ShipmentStatus, UserRole } from "@prisma/client";
import { SHIPMENT_STATUS_LABELS } from "../src/lib/constants";
import { getFlightVisualMeta } from "../src/lib/flight-meta";

const prisma = new PrismaClient();

function makeTracking(status: ShipmentStatus, createdAt: Date, location: string, message: string, actorName: string) {
  return { status, createdAt, location, message, actorName };
}

function demoDocument(fileName: string, mimeType: string, fileSize: number) {
  return {
    fileName,
    mimeType,
    fileSize,
    storageUrl: mimeType.includes("csv") ? "/demo-assets/sample-data.csv" : "/demo-assets/sample-document.pdf",
  };
}

function todayAt(baseDate: Date, hour: number, minute: number) {
  return set(baseDate, {
    hours: hour,
    minutes: minute,
    seconds: 0,
    milliseconds: 0,
  });
}

type SeedShipment = {
  awb: string;
  commodity: string;
  origin: string;
  destination: string;
  pieces: number;
  weightKg: number;
  volumeM3: number;
  specialHandling: string;
  docStatus: string;
  readiness: string;
  shipper: string;
  consignee: string;
  forwarder: string;
  ownerName: string;
  notes: string;
  status: ShipmentStatus;
  flightNumber: string;
  createdById: string;
  customerAccountId?: string | null;
  receivedAt: Date;
  trackingLogs: ReturnType<typeof makeTracking>[];
  documents: ReturnType<typeof demoDocument>[];
};

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

  const now = new Date();

  const customerAccount = await prisma.customerAccount.create({
    data: {
      code: "NUSFRESH",
      name: "PT Nusantara Fresh Cargo",
      contactName: "Ayu Mahendra",
      contactEmail: "ops@nusantarafresh.test",
      contactPhone: "+62-811-7000-123",
      status: "active",
    },
  });

  const users = await Promise.all([
    prisma.user.create({
      data: {
        name: "Nadia Kusuma",
        email: "customer@skyhub.test",
        passwordHash: hashSync("operator123", 10),
        role: UserRole.customer,
        station: "SOQ",
        customerAccountId: customerAccount.id,
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
        name: "Rina Sari",
        email: "supervisor@skyhub.test",
        passwordHash: hashSync("operator123", 10),
        role: UserRole.supervisor,
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
            refreshIntervalSeconds: 5,
            timezone: "Asia/Makassar",
          },
        },
      },
    }),
    prisma.user.create({
      data: {
        name: "Andika",
        email: "operator@skyhub.test",
        passwordHash: hashSync("operator123", 10),
        role: UserRole.operator,
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
        name: "Mira Putri",
        email: "admin@skyhub.test",
        passwordHash: hashSync("operator123", 10),
        role: UserRole.admin,
        station: "SOQ",
        settings: {
          create: {
            theme: "dark",
            compactRows: false,
            sidebarCollapsed: true,
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
        name: "Dian Rahma",
        email: "invited-ops@skyhub.test",
        passwordHash: hashSync("operator123", 10),
        role: UserRole.operator,
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
        email: "disabled-supervisor@skyhub.test",
        passwordHash: hashSync("operator123", 10),
        role: UserRole.supervisor,
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

  const [customer, supervisor, operator, admin, invitedOperator, disabledSupervisor] = users;

  const flightSpecs = [
    {
      flightNumber: "GA-714",
      origin: "SOQ",
      destination: "CGK",
      departureTime: addHours(now, 2),
      arrivalTime: addHours(now, 5),
      cargoCutoffTime: addMinutes(now, 72),
      status: FlightStatus.on_time,
      gate: "A3",
      remarks: "Priority electronics and cool-chain cargo.",
    },
    {
      flightNumber: "SJ-182",
      origin: "SOQ",
      destination: "SUB",
      departureTime: addHours(now, 4),
      arrivalTime: addHours(now, 7),
      cargoCutoffTime: addHours(now, 2),
      status: FlightStatus.delayed,
      gate: "B1",
      remarks: "Weather holding. Recheck final load list before cutoff.",
    },
    {
      flightNumber: "QG-931",
      origin: "SOQ",
      destination: "UPG",
      departureTime: addHours(now, 5),
      arrivalTime: addHours(now, 6),
      cargoCutoffTime: addHours(now, 3),
      status: FlightStatus.on_time,
      gate: "B4",
      remarks: "Dense manifest for afternoon feeder sector.",
    },
    {
      flightNumber: "ID-7210",
      origin: "SOQ",
      destination: "DPS",
      departureTime: addHours(now, 6),
      arrivalTime: addHours(now, 9),
      cargoCutoffTime: addHours(now, 4),
      status: FlightStatus.on_time,
      gate: "C2",
      remarks: "Seafood and pharma mixed load.",
    },
    {
      flightNumber: "GA-410",
      origin: "SOQ",
      destination: "BDO",
      departureTime: addHours(now, 8),
      arrivalTime: addHours(now, 11),
      cargoCutoffTime: addHours(now, 6),
      status: FlightStatus.on_time,
      gate: "A5",
      remarks: "Textile components and urgent spare parts.",
    },
    {
      flightNumber: "QG-812",
      origin: "SOQ",
      destination: "PNK",
      departureTime: addHours(now, 9),
      arrivalTime: addHours(now, 12),
      cargoCutoffTime: addHours(now, 7),
      status: FlightStatus.on_time,
      gate: "C4",
      remarks: "Regional replenishment linehaul.",
    },
    {
      flightNumber: "ID-6570",
      origin: "SOQ",
      destination: "PLM",
      departureTime: subHours(now, 3),
      arrivalTime: addMinutes(now, 40),
      cargoCutoffTime: subHours(now, 4),
      status: FlightStatus.departed,
      gate: "D1",
      remarks: "Departed on adjusted slot.",
    },
    {
      flightNumber: "GA-180",
      origin: "SOQ",
      destination: "KNO",
      departureTime: subHours(now, 1),
      arrivalTime: addHours(now, 2),
      cargoCutoffTime: subHours(now, 2),
      status: FlightStatus.departed,
      gate: "A1",
      remarks: "Morning trunk flight already airborne.",
    },
    {
      flightNumber: "GA-520",
      origin: "SOQ",
      destination: "BPN",
      departureTime: subHours(now, 5),
      arrivalTime: subHours(now, 2),
      cargoCutoffTime: subHours(now, 6),
      status: FlightStatus.departed,
      gate: "A6",
      remarks: "Completed with full payload.",
    },
  ];

  const flightMap = new Map<string, Awaited<ReturnType<typeof prisma.flight.create>>>();
  for (const spec of flightSpecs) {
    const meta = getFlightVisualMeta(spec.flightNumber);
    const flight = await prisma.flight.create({
      data: {
        flightNumber: spec.flightNumber,
        aircraftType: meta.aircraftType,
        origin: spec.origin,
        destination: spec.destination,
        departureTime: spec.departureTime,
        arrivalTime: spec.arrivalTime,
        cargoCutoffTime: spec.cargoCutoffTime,
        status: spec.status,
        gate: spec.gate,
        remarks: spec.remarks,
        imageUrl: meta.aircraftImageUrl,
      },
    });
    flightMap.set(spec.flightNumber, flight);
  }

  const shipments: SeedShipment[] = [
    {
      awb: "160-12345678",
      commodity: "Elektronik Konsumer",
      origin: "SOQ",
      destination: "CGK",
      pieces: 18,
      weightKg: 642,
      volumeM3: 2.8,
      specialHandling: "ELI",
      docStatus: "Complete",
      readiness: "Ready",
      shipper: "PT Sinar Digital",
      consignee: "PT Nusantara Elektrik",
      forwarder: "SkyHub",
      ownerName: "Andika",
      notes: "Prioritas penerbangan sore.",
      status: ShipmentStatus.sortation,
      flightNumber: "GA-714",
      createdById: operator.id,
      customerAccountId: customerAccount.id,
      receivedAt: subMinutes(now, 55),
      trackingLogs: [
        makeTracking(ShipmentStatus.received, subMinutes(now, 55), "Gudang Udara", "Kargo diterima di gudang udara.", "Andika"),
        makeTracking(ShipmentStatus.sortation, subMinutes(now, 28), "Area Sortation", "Label dan manifest tervalidasi.", "Rina Sari"),
      ],
      documents: [demoDocument("manifest-ga714.pdf", "application/pdf", 182040)],
    },
    {
      awb: "160-23456789",
      commodity: "Bahan Baku Tekstil",
      origin: "SOQ",
      destination: "SUB",
      pieces: 24,
      weightKg: 810,
      volumeM3: 3.1,
      specialHandling: "",
      docStatus: "Partial",
      readiness: "Pending",
      shipper: "CV Sorong Textile",
      consignee: "PT Jawa Fabric",
      forwarder: "SkyHub",
      ownerName: "Andika",
      notes: "Menunggu revisi AWB.",
      status: ShipmentStatus.received,
      flightNumber: "SJ-182",
      createdById: operator.id,
      customerAccountId: customerAccount.id,
      receivedAt: subMinutes(now, 42),
      trackingLogs: [
        makeTracking(ShipmentStatus.received, subMinutes(now, 42), "Gudang Udara", "Data masuk menunggu verifikasi airway bill.", "Andika"),
      ],
      documents: [],
    },
    {
      awb: "160-34567890",
      commodity: "Suku Cadang Mesin",
      origin: "SOQ",
      destination: "PLM",
      pieces: 9,
      weightKg: 364,
      volumeM3: 1.5,
      specialHandling: "HEA",
      docStatus: "Complete",
      readiness: "Ready",
      shipper: "PT Papua Teknik",
      consignee: "PT Sumatera Marine",
      forwarder: "SkyHub",
      ownerName: "Rina Sari",
      notes: "Sudah berangkat.",
      status: ShipmentStatus.departed,
      flightNumber: "ID-6570",
      createdById: supervisor.id,
      receivedAt: subHours(now, 6),
      trackingLogs: [
        makeTracking(ShipmentStatus.received, subHours(now, 6), "Gudang Udara", "Kargo diterima.", "Andika"),
        makeTracking(ShipmentStatus.sortation, subHours(now, 5), "Area Sortation", "Masuk proses sortation.", "Rina Sari"),
        makeTracking(ShipmentStatus.loaded_to_aircraft, subHours(now, 4), "Apron D1", "Kargo dimuat ke pesawat.", "Rina Sari"),
        makeTracking(ShipmentStatus.departed, subHours(now, 3), "Runway", "Flight departed.", "System"),
      ],
      documents: [demoDocument("awb-16034567890.pdf", "application/pdf", 98012)],
    },
    {
      awb: "160-45678901",
      commodity: "Produk Farmasi",
      origin: "SOQ",
      destination: "CGK",
      pieces: 6,
      weightKg: 215,
      volumeM3: 0.9,
      specialHandling: "COL",
      docStatus: "Complete",
      readiness: "Ready",
      shipper: "PT Medika Timur",
      consignee: "PT Klinik Nusantara",
      forwarder: "SkyHub",
      ownerName: "Rina Sari",
      notes: "Perlu pemantauan suhu.",
      status: ShipmentStatus.loaded_to_aircraft,
      flightNumber: "GA-714",
      createdById: supervisor.id,
      receivedAt: subHours(now, 3),
      trackingLogs: [
        makeTracking(ShipmentStatus.received, subHours(now, 3), "Cold Storage", "Produk diterima di cold storage.", "Andika"),
        makeTracking(ShipmentStatus.sortation, subHours(now, 2), "Cold Sortation", "Validasi cool chain selesai.", "Rina Sari"),
        makeTracking(ShipmentStatus.loaded_to_aircraft, subMinutes(now, 50), "Apron A3", "Muat ke unit GA-714.", "Rina Sari"),
      ],
      documents: [demoDocument("temp-log-farmasi.csv", "text/csv", 4299)],
    },
    {
      awb: "160-56789012",
      commodity: "Komoditas Pangan",
      origin: "SOQ",
      destination: "SUB",
      pieces: 14,
      weightKg: 512,
      volumeM3: 2.2,
      specialHandling: "PER",
      docStatus: "Complete",
      readiness: "Ready",
      shipper: "Koperasi Petani Papua",
      consignee: "Pasar Induk Surabaya",
      forwarder: "SkyHub",
      ownerName: "Andika",
      notes: "Delay karena cuaca.",
      status: ShipmentStatus.sortation,
      flightNumber: "SJ-182",
      createdById: operator.id,
      receivedAt: subHours(now, 2),
      trackingLogs: [
        makeTracking(ShipmentStatus.received, subHours(now, 2), "Gudang Udara", "Pangan diterima dan ditimbang.", "Andika"),
        makeTracking(ShipmentStatus.sortation, subMinutes(now, 35), "Area Sortation", "Menunggu slot muat akibat delay.", "Rina Sari"),
      ],
      documents: [demoDocument("food-clearance.pdf", "application/pdf", 88382)],
    },
    {
      awb: "160-67890123",
      commodity: "Komponen Telekomunikasi",
      origin: "SOQ",
      destination: "KNO",
      pieces: 11,
      weightKg: 289,
      volumeM3: 1.2,
      specialHandling: "ELI",
      docStatus: "Complete",
      readiness: "Ready",
      shipper: "PT Satelit Papua",
      consignee: "PT Konektivitas Sumatra",
      forwarder: "SkyHub",
      ownerName: "Rina Sari",
      notes: "Flight sudah airborne.",
      status: ShipmentStatus.departed,
      flightNumber: "GA-180",
      createdById: supervisor.id,
      receivedAt: subHours(now, 8),
      trackingLogs: [
        makeTracking(ShipmentStatus.received, subHours(now, 8), "Gudang Udara", "Shipment diterima.", "Andika"),
        makeTracking(ShipmentStatus.sortation, subHours(now, 7), "Area Sortation", "Manifest tervalidasi.", "Rina Sari"),
        makeTracking(ShipmentStatus.loaded_to_aircraft, subHours(now, 3), "Apron A1", "Loaded to aircraft.", "Rina Sari"),
        makeTracking(ShipmentStatus.departed, subHours(now, 1), "Runway", "Flight departed.", "System"),
      ],
      documents: [demoDocument("handover-telekomunikasi.pdf", "application/pdf", 114201)],
    },
    {
      awb: "160-78901234",
      commodity: "Seafood Chilled",
      origin: "SOQ",
      destination: "DPS",
      pieces: 16,
      weightKg: 590,
      volumeM3: 2.4,
      specialHandling: "COL",
      docStatus: "Complete",
      readiness: "Ready",
      shipper: "PT Samudra Timur",
      consignee: "PT Bali Fresh Market",
      forwarder: "SkyHub",
      ownerName: "Andika",
      notes: "Muatan prioritas market arrival.",
      status: ShipmentStatus.sortation,
      flightNumber: "ID-7210",
      createdById: operator.id,
      receivedAt: subMinutes(now, 32),
      trackingLogs: [
        makeTracking(ShipmentStatus.received, subMinutes(now, 32), "Cold Dock", "Seafood diterima dan diperiksa suhu.", "Andika"),
        makeTracking(ShipmentStatus.sortation, subMinutes(now, 18), "Cold Sortation", "Menunggu proses loading final.", "Rina Sari"),
      ],
      documents: [demoDocument("cold-chain-sheet.csv", "text/csv", 3612)],
    },
    {
      awb: "160-89012345",
      commodity: "Dokumen Ekspor",
      origin: "SOQ",
      destination: "BDO",
      pieces: 3,
      weightKg: 18,
      volumeM3: 0.1,
      specialHandling: "",
      docStatus: "Complete",
      readiness: "Ready",
      shipper: "PT Mitra Administrasi",
      consignee: "CV Bandung Trade",
      forwarder: "SkyHub",
      ownerName: "Rina Sari",
      notes: "Light courier pallet.",
      status: ShipmentStatus.received,
      flightNumber: "GA-410",
      createdById: supervisor.id,
      receivedAt: subMinutes(now, 16),
      trackingLogs: [
        makeTracking(ShipmentStatus.received, subMinutes(now, 16), "Control Counter", "Dokumen ekspor diterima.", "Andika"),
      ],
      documents: [demoDocument("export-doc-pack.pdf", "application/pdf", 42118)],
    },
    {
      awb: "160-90123456",
      commodity: "Aksesori Fashion",
      origin: "SOQ",
      destination: "PNK",
      pieces: 20,
      weightKg: 274,
      volumeM3: 1.8,
      specialHandling: "",
      docStatus: "Complete",
      readiness: "Ready",
      shipper: "CV Timur Apparel",
      consignee: "PT Ponti Mode",
      forwarder: "SkyHub",
      ownerName: "Andika",
      notes: "Regional replenishment cargo.",
      status: ShipmentStatus.received,
      flightNumber: "QG-812",
      createdById: operator.id,
      receivedAt: subMinutes(now, 12),
      trackingLogs: [
        makeTracking(ShipmentStatus.received, subMinutes(now, 12), "Gudang Udara", "Paket fashion diterima.", "Andika"),
      ],
      documents: [],
    },
    {
      awb: "160-11223344",
      commodity: "Printed Material",
      origin: "SOQ",
      destination: "UPG",
      pieces: 7,
      weightKg: 148,
      volumeM3: 0.7,
      specialHandling: "",
      docStatus: "Complete",
      readiness: "Ready",
      shipper: "PT Papua Print",
      consignee: "PT UPG Media",
      forwarder: "SkyHub",
      ownerName: "Mira Putri",
      notes: "Scheduled feeder cargo.",
      status: ShipmentStatus.loaded_to_aircraft,
      flightNumber: "QG-931",
      createdById: admin.id,
      receivedAt: subHours(now, 1),
      trackingLogs: [
        makeTracking(ShipmentStatus.received, subHours(now, 1), "Gudang Udara", "Material cetak diterima.", "Andika"),
        makeTracking(ShipmentStatus.sortation, subMinutes(now, 40), "Area Sortation", "Manifest approved.", "Rina Sari"),
        makeTracking(ShipmentStatus.loaded_to_aircraft, subMinutes(now, 10), "Apron B4", "Loaded untuk flight feeder.", "Mira Putri"),
      ],
      documents: [demoDocument("print-manifest.pdf", "application/pdf", 38219)],
    },
    {
      awb: "160-22334455",
      commodity: "Medical Devices",
      origin: "SOQ",
      destination: "CGK",
      pieces: 5,
      weightKg: 121,
      volumeM3: 0.6,
      specialHandling: "HEA",
      docStatus: "Complete",
      readiness: "Ready",
      shipper: "PT Alat Medis Papua",
      consignee: "PT Medis Sentral",
      forwarder: "SkyHub",
      ownerName: "Rina Sari",
      notes: "Urgent hospital replenishment.",
      status: ShipmentStatus.received,
      flightNumber: "GA-714",
      createdById: supervisor.id,
      receivedAt: subMinutes(now, 8),
      trackingLogs: [
        makeTracking(ShipmentStatus.received, subMinutes(now, 8), "Priority Counter", "Medical devices diterima untuk priority load.", "Rina Sari"),
      ],
      documents: [demoDocument("device-clearance.pdf", "application/pdf", 62118)],
    },
    {
      awb: "160-33445566",
      commodity: "Chemical Samples",
      origin: "SOQ",
      destination: "BPN",
      pieces: 4,
      weightKg: 92,
      volumeM3: 0.5,
      specialHandling: "DGR",
      docStatus: "Review",
      readiness: "Pending",
      shipper: "PT Lab Timur",
      consignee: "PT Energy Test",
      forwarder: "SkyHub",
      ownerName: "Mira Putri",
      notes: "DG declaration perlu paraf supervisor.",
      status: ShipmentStatus.hold,
      flightNumber: "GA-520",
      createdById: admin.id,
      receivedAt: todayAt(now, 10, 15),
      trackingLogs: [
        makeTracking(ShipmentStatus.received, todayAt(now, 10, 15), "DG Acceptance", "Chemical samples diterima.", "Mira Putri"),
        makeTracking(ShipmentStatus.hold, todayAt(now, 11, 5), "DG Acceptance", "Shipment ditahan menunggu validasi dokumen DG.", "Mira Putri"),
      ],
      documents: [demoDocument("dg-declaration.pdf", "application/pdf", 80221)],
    },
    {
      awb: "160-44556677",
      commodity: "Retail Display Kit",
      origin: "SOQ",
      destination: "DPS",
      pieces: 12,
      weightKg: 205,
      volumeM3: 1.1,
      specialHandling: "",
      docStatus: "Complete",
      readiness: "Ready",
      shipper: "PT Retail Visual",
      consignee: "PT Bali Promo",
      forwarder: "SkyHub",
      ownerName: "Andika",
      notes: "Event cargo.",
      status: ShipmentStatus.received,
      flightNumber: "ID-7210",
      createdById: operator.id,
      receivedAt: subMinutes(now, 5),
      trackingLogs: [
        makeTracking(ShipmentStatus.received, subMinutes(now, 5), "Gudang Udara", "Display kit diterima untuk event cargo.", "Andika"),
      ],
      documents: [],
    },
    {
      awb: "160-55667788",
      commodity: "Regional Parts Box",
      origin: "SOQ",
      destination: "UPG",
      pieces: 10,
      weightKg: 188,
      volumeM3: 0.8,
      specialHandling: "",
      docStatus: "Complete",
      readiness: "Ready",
      shipper: "PT Sparepart Timur",
      consignee: "PT Makassar Servis",
      forwarder: "SkyHub",
      ownerName: "Rina Sari",
      notes: "Feeder linehaul consolidated.",
      status: ShipmentStatus.arrived,
      flightNumber: "QG-931",
      createdById: supervisor.id,
      customerAccountId: customerAccount.id,
      receivedAt: subHours(now, 10),
      trackingLogs: [
        makeTracking(ShipmentStatus.received, subHours(now, 10), "Gudang Udara", "Parts box diterima.", "Andika"),
        makeTracking(ShipmentStatus.sortation, subHours(now, 9), "Area Sortation", "Sortation selesai.", "Rina Sari"),
        makeTracking(ShipmentStatus.loaded_to_aircraft, subHours(now, 8), "Apron B4", "Shipment dimuat ke pesawat.", "Rina Sari"),
        makeTracking(ShipmentStatus.departed, subHours(now, 7), "Runway", "Flight departed.", "System"),
        makeTracking(ShipmentStatus.arrived, subHours(now, 4), "UPG Cargo Terminal", "Shipment tiba di terminal tujuan.", "System"),
      ],
      documents: [demoDocument("arrival-proof-55667788.pdf", "application/pdf", 50123)],
    },
  ];

  for (const shipment of shipments) {
    const flight = flightMap.get(shipment.flightNumber);
    const created = await prisma.shipment.create({
      data: {
        awb: shipment.awb,
        commodity: shipment.commodity,
        origin: shipment.origin,
        destination: shipment.destination,
        pieces: shipment.pieces,
        weightKg: shipment.weightKg,
        volumeM3: shipment.volumeM3,
        specialHandling: shipment.specialHandling,
        docStatus: shipment.docStatus,
        readiness: shipment.readiness,
        shipper: shipment.shipper,
        consignee: shipment.consignee,
        forwarder: shipment.forwarder,
        ownerName: shipment.ownerName,
        notes: shipment.notes,
        status: shipment.status,
        flightId: flight?.id ?? null,
        createdById: shipment.createdById,
        customerAccountId: shipment.customerAccountId ?? null,
        receivedAt: shipment.receivedAt,
        trackingLogs: {
          create: shipment.trackingLogs,
        },
        documents: {
          create: shipment.documents,
        },
      },
    });

    await prisma.activityLog.createMany({
      data: [
        {
          userId: shipment.createdById,
          action: "Buat Shipment",
          targetType: "shipment",
          targetId: created.id,
          targetLabel: created.awb,
          description: `Shipment ${created.awb} dibuat untuk rute ${created.origin} -> ${created.destination}.`,
          level: "success",
        },
        {
          userId: shipment.createdById,
          action: "Ubah Status",
          targetType: "tracking",
          targetId: created.id,
          targetLabel: created.awb,
          description: `Status terbaru ${created.awb}: ${SHIPMENT_STATUS_LABELS[created.status]}.`,
          level: created.status === ShipmentStatus.hold ? "warning" : "info",
        },
      ],
    });
  }

  await prisma.activityLog.createMany({
      data: [
        {
          userId: customer.id,
          action: "Login",
          targetType: "session",
          targetLabel: "Portal Pelanggan",
          description: "Pelanggan login untuk memantau shipment akun PT Nusantara Fresh Cargo.",
          level: "info",
          createdAt: subMinutes(now, 24),
        },
        {
          userId: operator.id,
          action: "Login",
          targetType: "session",
          targetLabel: "Konsol Operasional",
          description: "Operator login ke sistem shift pagi.",
          level: "info",
          createdAt: subMinutes(now, 18),
        },
        {
          userId: supervisor.id,
          action: "Cetak Laporan",
          targetType: "report",
          targetLabel: "Ringkasan Papan Flight",
          description: "Supervisor mencetak ringkasan penerbangan harian.",
          level: "success",
          createdAt: subHours(now, 3),
        },
        {
          userId: admin.id,
          action: "Perbarui Pengaturan",
          targetType: "settings",
          targetLabel: "Preferensi Tampilan",
          description: "Admin menguji mode gelap dan sidebar terlipat.",
          level: "info",
          createdAt: subHours(now, 7),
        },
        {
          userId: operator.id,
          action: "Laporkan Isu",
          targetType: "tracking",
          targetLabel: "160-33445566",
          description: "Operator menandai isu deklarasi DG untuk ditinjau supervisor.",
          level: "warning",
          createdAt: subMinutes(now, 46),
        },
        {
          userId: admin.id,
          action: "Undang Pengguna",
          targetType: "user",
          targetLabel: invitedOperator.email,
          description: "Admin menambahkan operator baru untuk shift cadangan.",
          level: "success",
          createdAt: subHours(now, 12),
        },
        {
          userId: admin.id,
          action: "Perbarui Hak Akses Pengguna",
          targetType: "user",
          targetLabel: disabledSupervisor.email,
          description: "Akses supervisor nonaktif ditandai nonaktif setelah review roster.",
          level: "warning",
          createdAt: subHours(now, 16),
        },
      ],
    });

  await prisma.notification.createMany({
      data: [
        {
          userId: customer.id,
          title: "Dokumen sedang ditinjau",
          message: "Satu shipment akun Anda masih berstatus dokumen parsial dan menunggu validasi internal.",
          href: "/shipment-ledger?status=received",
          type: "warning",
          read: false,
          createdAt: subMinutes(now, 16),
        },
        {
          userId: customer.id,
          title: "Shipment telah tiba",
          message: "AWB 160-55667788 sudah tercatat tiba di terminal tujuan.",
          href: "/awb-tracking?awb=160-55667788",
          type: "success",
          read: false,
          createdAt: subHours(now, 3),
        },
        {
          userId: operator.id,
          title: "AWB perlu validasi",
          message: "Nomor AWB 160-23456789 masih menunggu koreksi input sebelum dapat diproses.",
          href: "/awb-tracking?awb=160-23456789",
          type: "warning",
          read: false,
          createdAt: subMinutes(now, 20),
        },
        {
          userId: operator.id,
          title: "Cutoff mendekat",
          message: "GA-714 akan menutup penerimaan kargo dalam 72 menit.",
          href: "/flight-board?query=GA-714",
          type: "info",
          read: false,
          createdAt: subMinutes(now, 12),
        },
        {
          userId: supervisor.id,
          title: "Delay penerbangan",
          message: "SJ-182 mengalami keterlambatan dan membutuhkan peninjauan muatan prioritas.",
          href: "/flight-board?query=SJ-182",
          type: "warning",
          read: false,
          createdAt: subMinutes(now, 38),
        },
        {
          userId: admin.id,
          title: "Exception DG",
          message: "Shipment 160-33445566 masih hold karena deklarasi DG belum final.",
          href: "/awb-tracking?awb=160-33445566",
          type: "warning",
          read: false,
          createdAt: subHours(now, 1),
        },
        {
          userId: invitedOperator.id,
          title: "Undangan akun siap",
          message: "Akun operator cadangan sudah dibuat dan menunggu aktivasi pertama.",
          href: "/settings",
          type: "info",
          read: false,
          createdAt: subHours(now, 8),
        },
        {
          userId: disabledSupervisor.id,
          title: "Akses dinonaktifkan",
          message: "Akun supervisor ini ditahan sementara sampai roster berikutnya dipulihkan.",
          href: "/settings",
          type: "warning",
          read: true,
          createdAt: subHours(now, 15),
        },
      ],
    });

    await prisma.recentAwbSearch.createMany({
      data: [
        { userId: customer.id, awb: "160-12345678", createdAt: subMinutes(now, 28) },
        { userId: customer.id, awb: "160-23456789", createdAt: subMinutes(now, 19) },
        { userId: operator.id, awb: "160-12345678", createdAt: subMinutes(now, 30) },
        { userId: operator.id, awb: "160-45678901", createdAt: subMinutes(now, 26) },
        { userId: operator.id, awb: "160-33445566", createdAt: subMinutes(now, 22) },
        { userId: operator.id, awb: "160-55667788", createdAt: subMinutes(now, 14) },
        { userId: supervisor.id, awb: "160-78901234", createdAt: subHours(now, 2) },
        { userId: admin.id, awb: "160-22334455", createdAt: subHours(now, 5) },
      ],
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
