import { Prisma, ShipmentStatus } from "@prisma/client";
import { addMinutes, endOfDay, startOfDay } from "date-fns";
import {
  AccessError,
  canManageCustomerAccounts,
  canManageFlights,
  canManageShipments,
  canManageUsers,
  isInternalRole,
  scopeAwbWhere,
  scopeCustomerAccountWhere,
  scopeFlightWhere,
  scopeShipmentWhere,
  type AccessUser,
} from "./access";
import { AWB_REGEX, FLIGHT_STATUS_LABELS, ROLE_LABELS, SHIPMENT_STATUS_LABELS } from "./constants";
import {
  getFlightVisualMeta,
  getShipmentPriorityScore,
  isAllowedFlightNumber,
  normalizeFlightNumber,
} from "./flight-meta";
import { db } from "./prisma";
import { deleteDocumentBlob } from "./storage";

const shipmentInclude = Prisma.validator<Prisma.ShipmentInclude>()({
  flight: true,
  trackingLogs: {
    orderBy: { createdAt: "asc" },
  },
  documents: {
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
  },
  customerAccount: {
    select: {
      id: true,
      name: true,
      status: true,
    },
  },
});

const flightBoardInclude = Prisma.validator<Prisma.FlightInclude>()({
  shipments: {
    where: { archivedAt: null },
    include: shipmentInclude,
  },
});

type ShipmentRecord = Prisma.ShipmentGetPayload<{ include: typeof shipmentInclude }>;

function serializeTrackingLog(log: {
  id: string;
  status: ShipmentStatus;
  message: string;
  location: string;
  actorName: string | null;
  createdAt: Date;
}) {
  return {
    ...log,
    label: SHIPMENT_STATUS_LABELS[log.status],
    createdAt: log.createdAt.toISOString(),
  };
}

function getDocumentSummary(shipment: ShipmentRecord) {
  const activeDocuments = shipment.documents.filter((document) => !document.deletedAt);
  const latestDocument = activeDocuments[0] ?? null;

  return {
    docStatus: shipment.docStatus,
    count: activeDocuments.length,
    latestUploadedAt: latestDocument?.createdAt.toISOString() ?? null,
  };
}

function serializeShipment(shipment: ShipmentRecord, user: AccessUser) {
  const latestTrackingTimestamp = shipment.trackingLogs.reduce<Date | null>((latest, log) => {
    if (!latest || log.createdAt.getTime() > latest.getTime()) {
      return log.createdAt;
    }
    return latest;
  }, null);

  const documentSummary = getDocumentSummary(shipment);
  const isCustomer = user.role === "customer";

  return {
    id: shipment.id,
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
    notes: shipment.notes ?? "",
    status: shipment.status,
    statusLabel: SHIPMENT_STATUS_LABELS[shipment.status],
    receivedAt: shipment.receivedAt.toISOString(),
    updatedAt: (latestTrackingTimestamp ?? shipment.updatedAt).toISOString(),
    flightId: shipment.flightId,
    flightNumber: shipment.flight?.flightNumber ?? null,
    customerAccountId: shipment.customerAccountId,
    customerAccountName: shipment.customerAccount?.name ?? null,
    documentSummary,
    trackingLogs: shipment.trackingLogs.map(serializeTrackingLog),
    documents: isCustomer
      ? []
      : shipment.documents.map((document) => ({
          id: document.id,
          fileName: document.fileName,
          mimeType: document.mimeType,
          fileSize: document.fileSize,
          storageUrl: document.storageUrl,
          createdAt: document.createdAt.toISOString(),
          blobCleanupStatus: document.blobCleanupStatus,
        })),
  };
}

function serializeRoute(origin: string, destination: string) {
  return `${origin} -> ${destination}`;
}

function getShipmentOrderBy(sortBy?: string): Prisma.ShipmentOrderByWithRelationInput[] {
  if (sortBy === "received") {
    return [{ receivedAt: "desc" }];
  }

  return [{ updatedAt: "desc" }];
}

async function getActorWithRelations(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      settings: true,
      customerAccount: {
        select: {
          id: true,
          name: true,
          status: true,
        },
      },
    },
  });

  if (!user || user.status !== "active") {
    return null;
  }

  return user;
}

async function validateCustomerAccount(customerAccountId?: string | null) {
  if (!customerAccountId) {
    return null;
  }

  const account = await db.customerAccount.findUnique({
    where: { id: customerAccountId },
    select: {
      id: true,
      name: true,
      status: true,
    },
  });

  if (!account || account.status !== "active") {
    throw new AccessError("Akun pelanggan tidak aktif atau tidak ditemukan.", 400, "CUSTOMER_ACCOUNT_INVALID");
  }

  return account;
}

async function validateFlight(flightId?: string | null) {
  if (!flightId) {
    return null;
  }

  const flight = await db.flight.findFirst({
    where: {
      id: flightId,
      ...scopeFlightWhere(),
    },
    select: {
      id: true,
      flightNumber: true,
    },
  });

  if (!flight) {
    throw new AccessError("Flight tidak ditemukan atau sudah diarsipkan.", 400, "FLIGHT_INVALID");
  }

  return flight;
}

function ensureShipmentManager(user: AccessUser) {
  if (!canManageShipments(user)) {
    throw new AccessError("Perubahan shipment hanya untuk pengguna internal.", 403, "SHIPMENT_INTERNAL_ONLY");
  }
}

function ensureFlightManager(user: AccessUser) {
  if (!canManageFlights(user)) {
    throw new AccessError("Perubahan flight hanya untuk admin atau staff.", 403, "FLIGHT_MANAGER_ONLY");
  }
}

function ensureAllowedFlightNumber(flightNumber: string) {
  const normalized = normalizeFlightNumber(flightNumber);
  if (!isAllowedFlightNumber(normalized)) {
    throw new AccessError(
      "Format flight harus CODE-XXX/XXXX dengan kode maskapai yang tersedia.",
      400,
      "FLIGHT_CODE_NOT_ALLOWED",
    );
  }

  return normalized;
}

function ensureAdmin(user: AccessUser) {
  if (!canManageUsers(user)) {
    throw new AccessError("Aksi ini hanya untuk admin.", 403, "ADMIN_ONLY");
  }
}

function getUserFilters(user: AccessUser): Pick<Prisma.UserFindManyArgs, "where" | "orderBy"> {
  const orderBy: Prisma.UserFindManyArgs["orderBy"] = { createdAt: "asc" };

  if (user.role === "customer") {
    return {
      where: { id: user.id },
      orderBy,
    };
  }

  if (canManageUsers(user)) {
    return {
      orderBy,
    };
  }

  return {
    where: { id: user.id },
    orderBy,
  };
}

function serializeManagedUser(user: {
  id: string;
  name: string;
  email: string;
  role: AccessUser["role"];
  station: string;
  status: "active" | "invited" | "disabled";
  customerAccountId: string | null;
  customerAccount: { id: string; name: string } | null;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    station: user.station,
    status: user.status,
    customerAccountId: user.customerAccountId,
    customerAccountName: user.customerAccount?.name ?? null,
  };
}

function serializeCustomerAccount(account: {
  id: string;
  code: string;
  name: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  status: "active" | "disabled";
  users?: { id: string; name: string; email: string }[];
  shipments?: { id: string }[];
}) {
  return {
    id: account.id,
    code: account.code,
    name: account.name,
    contactName: account.contactName,
    contactEmail: account.contactEmail,
    contactPhone: account.contactPhone,
    status: account.status,
    userCount: account.users?.length ?? 0,
    shipmentCount: account.shipments?.length ?? 0,
  };
}

async function getShipmentRecordForMutation(shipmentId: string) {
  const shipment = await db.shipment.findUnique({
    where: { id: shipmentId },
    include: shipmentInclude,
  });

  if (!shipment) {
    throw new AccessError("Shipment tidak ditemukan.", 404, "SHIPMENT_NOT_FOUND");
  }

  return shipment;
}

async function generateUniqueAwb() {
  while (true) {
    const numeric = `${Math.floor(Math.random() * 90000000 + 10000000)}`;
    const awb = `160-${numeric}`;
    const existing = await db.shipment.findUnique({ where: { awb } });
    if (!existing) {
      return awb;
    }
  }
}

export async function getShellData(userId: string) {
  const [user, notifications] = await Promise.all([
    getActorWithRelations(userId),
    db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  if (!user || !user.settings) {
    return null;
  }

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      station: user.station,
      customerAccountName: user.customerAccount?.name ?? null,
    },
    settings: {
      theme: user.settings.theme,
      compactRows: user.settings.compactRows,
      sidebarCollapsed: user.settings.sidebarCollapsed,
      autoRefresh: user.settings.autoRefresh,
      refreshIntervalSeconds: user.settings.refreshIntervalSeconds,
      cutoffAlert: user.settings.cutoffAlert,
      exceptionAlert: user.settings.exceptionAlert,
      soundAlert: user.settings.soundAlert,
      emailDigest: user.settings.emailDigest,
    },
    notifications: notifications.map((notification) => ({
      id: notification.id,
      title: notification.title,
      message: notification.message,
      href: notification.href,
      type: notification.type,
      read: notification.read,
      createdAt: notification.createdAt.toISOString(),
    })),
  };
}

type InternalMetricsSnapshot = {
  now: Date;
  shipmentsToday: ShipmentRecord[];
  flightsToday: Array<{
    id: string;
    flightNumber: string;
    aircraftType: string;
    origin: string;
    destination: string;
    departureTime: Date;
    cargoCutoffTime: Date;
    status: "on_time" | "delayed" | "departed";
  }>;
  onTime: number;
  delayed: number;
  departed: number;
  holds: number;
};

async function getShipmentsWithDateFallback(scopedShipments: Prisma.ShipmentWhereInput) {
  const now = new Date();

  const todayShipments = await db.shipment.findMany({
    where: {
      ...scopedShipments,
      receivedAt: {
        gte: startOfDay(now),
        lte: endOfDay(now),
      },
    },
    include: shipmentInclude,
    orderBy: [{ receivedAt: "desc" }],
    take: 50,
  });

  if (todayShipments.length) {
    return { now, shipmentsToday: todayShipments };
  }

  const latestShipment = await db.shipment.findFirst({
    where: scopedShipments,
    orderBy: { receivedAt: "desc" },
    select: { receivedAt: true },
  });

  if (!latestShipment) {
    return { now, shipmentsToday: [] as ShipmentRecord[] };
  }

  const fallbackShipments = await db.shipment.findMany({
    where: {
      ...scopedShipments,
      receivedAt: {
        gte: startOfDay(latestShipment.receivedAt),
        lte: endOfDay(latestShipment.receivedAt),
      },
    },
    include: shipmentInclude,
    orderBy: [{ receivedAt: "desc" }],
    take: 50,
  });

  return { now, shipmentsToday: fallbackShipments };
}

async function getInternalMetricsSnapshot(scopedShipments: Prisma.ShipmentWhereInput): Promise<InternalMetricsSnapshot> {
  const [{ now, shipmentsToday }, flightsToday] = await Promise.all([
    getShipmentsWithDateFallback(scopedShipments),
    db.flight.findMany({
      where: scopeFlightWhere(),
      orderBy: { cargoCutoffTime: "asc" },
      take: 24,
      select: {
        id: true,
        flightNumber: true,
        aircraftType: true,
        origin: true,
        destination: true,
        departureTime: true,
        cargoCutoffTime: true,
        status: true,
      },
    }),
  ]);

  const onTime = flightsToday.filter((flight) => flight.status === "on_time").length;
  const delayed = flightsToday.filter((flight) => flight.status === "delayed").length;
  const departed = flightsToday.filter((flight) => flight.status === "departed").length;
  const holds = shipmentsToday.filter((shipment) => shipment.status === "hold").length;

  return {
    now,
    shipmentsToday,
    flightsToday,
    onTime,
    delayed,
    departed,
    holds,
  };
}

export async function getLandingMetricsData() {
  const [snapshot, systemKpi] = await Promise.all([
    getInternalMetricsSnapshot({ archivedAt: null }),
    db.systemKpi.findUnique({
      where: { id: "global" },
      select: { platformUptime: true },
    }),
  ]);

  const totalFlights = snapshot.flightsToday.length;
  const onTimeAccuracy = totalFlights ? Number(((snapshot.onTime / totalFlights) * 100).toFixed(1)) : 0;

  return {
    shipmentsToday: snapshot.shipmentsToday.length,
    activeFlights: totalFlights,
    onTimeAccuracy,
    platformUptime: Number((systemKpi?.platformUptime ?? 99.98).toFixed(2)),
    generatedAt: snapshot.now.toISOString(),
  };
}

export async function getDashboardData(user: AccessUser) {
  if (user.role === "customer") {
    const scopedWhere = scopeShipmentWhere(user);
    const [shipments, recentSearches] = await Promise.all([
      db.shipment.findMany({
        where: scopedWhere,
        include: shipmentInclude,
        orderBy: [{ updatedAt: "desc" }],
        take: 24,
      }),
      getRecentAwbSearches(user),
    ]);

    const serializedShipments = shipments.map((shipment) => serializeShipment(shipment, user));
    const actionShipments = serializedShipments.filter(
      (shipment) =>
        shipment.status === "hold" || shipment.docStatus.toLowerCase() !== "complete" || shipment.readiness.toLowerCase() !== "ready",
    );

    return {
      variant: "customer" as const,
      viewer: {
        role: user.role,
        customerAccountName: user.customerAccount?.name ?? null,
      },
      metrics: {
        activeShipments: serializedShipments.filter((shipment) => shipment.status !== "arrived").length,
        actionRequired: actionShipments.length,
        pendingDocuments: serializedShipments.filter((shipment) => shipment.docStatus.toLowerCase() !== "complete").length,
        arrived: serializedShipments.filter((shipment) => shipment.status === "arrived").length,
      },
      shipments: serializedShipments,
      actionItems: actionShipments.slice(0, 6).map((shipment) => ({
        id: shipment.id,
        awb: shipment.awb,
        title:
          shipment.status === "hold"
            ? "Shipment perlu penanganan"
            : shipment.docStatus.toLowerCase() !== "complete"
              ? "Dokumen masih menunggu validasi"
              : "Shipment perlu tindak lanjut",
        detail:
          shipment.status === "hold"
            ? `Shipment ${shipment.awb} masih tertahan dan sedang ditinjau tim internal.`
            : shipment.docStatus.toLowerCase() !== "complete"
              ? `Status dokumen ${shipment.awb} masih ${shipment.docStatus}.`
              : `Shipment ${shipment.awb} masih berstatus ${shipment.statusLabel}.`,
      })),
      documentSummary: serializedShipments.slice(0, 6).map((shipment) => ({
        id: shipment.id,
        awb: shipment.awb,
        docStatus: shipment.documentSummary.docStatus,
        count: shipment.documentSummary.count,
        latestUploadedAt: shipment.documentSummary.latestUploadedAt,
      })),
      recentSearches,
    };
  }

  const scopedShipments = scopeShipmentWhere(user);
  const [{ now, shipmentsToday, flightsToday, onTime, delayed, departed, holds }, recentActivity] = await Promise.all([
    getInternalMetricsSnapshot(scopedShipments),
    db.activityLog.findMany({
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const serializedShipments = shipmentsToday.map((shipment) => serializeShipment(shipment, user));

  return {
    variant: "internal" as const,
    viewer: {
      role: user.role,
    },
    metrics: {
      shipmentsToday: serializedShipments.length,
      activeFlights: flightsToday.length,
      onTime,
      delayed,
      departed,
      holds,
    },
    flightsSummary: flightsToday.map((flight) => {
      const meta = getFlightVisualMeta(flight.flightNumber, flight.aircraftType);
      return {
        id: flight.id,
        flightNumber: flight.flightNumber,
        route: serializeRoute(flight.origin, flight.destination),
        status: flight.status,
        statusLabel: FLIGHT_STATUS_LABELS[flight.status],
        departureTime: flight.departureTime.toISOString(),
        cargoCutoffTime: flight.cargoCutoffTime.toISOString(),
        cutoffAtRisk: flight.status !== "departed" && flight.cargoCutoffTime <= addMinutes(now, 120),
        airlineName: meta.airlineName,
        airlineLogoUrl: meta.airlineLogoUrl,
        aircraftType: meta.aircraftType,
        registration: meta.registration,
        imageUrl: meta.aircraftImageUrl,
        brandColor: meta.brandColor,
      };
    }),
    shipmentsToday: serializedShipments,
    alerts: serializedShipments
      .filter((shipment) => shipment.status === "hold" || shipment.docStatus.toLowerCase() !== "complete")
      .map((shipment) => ({
        id: shipment.id,
        awb: shipment.awb,
        title: shipment.status === "hold" ? "Shipment tertahan" : "Dokumen perlu ditinjau",
        detail:
          shipment.status === "hold"
            ? `Shipment ${shipment.awb} masih berstatus tertahan dan perlu penanganan tim operasional.`
            : `Shipment ${shipment.awb} memiliki status dokumen ${shipment.docStatus}.`,
      })),
    recentActivity: recentActivity.map((activity) => ({
      id: activity.id,
      action: activity.action,
      targetLabel: activity.targetLabel,
      description: activity.description,
      level: activity.level,
      userName: activity.user?.name ?? "Sistem",
      createdAt: activity.createdAt.toISOString(),
    })),
  };
}

export async function listShipments(
  user: AccessUser,
  filters?: {
    query?: string;
    status?: string;
    flight?: string;
    sortBy?: string;
  },
) {
  const where: Prisma.ShipmentWhereInput = {
    ...scopeShipmentWhere(user),
  };

  if (filters?.query) {
    where.OR = [
      { awb: { contains: filters.query } },
      { commodity: { contains: filters.query } },
      { shipper: { contains: filters.query } },
      { consignee: { contains: filters.query } },
      { ownerName: { contains: filters.query } },
    ];
  }

  if (filters?.status && filters.status !== "all") {
    where.status = filters.status as ShipmentStatus;
  }

  if (filters?.flight && filters.flight !== "all") {
    where.flight = { flightNumber: filters.flight };
  }

  const [shipments, flights, customerAccounts] = await Promise.all([
    db.shipment.findMany({
      where,
      include: shipmentInclude,
      orderBy: getShipmentOrderBy(filters?.sortBy),
    }),
    db.flight.findMany({
      where: scopeFlightWhere(),
      orderBy: { cargoCutoffTime: "asc" },
      select: { id: true, flightNumber: true },
    }),
    canManageShipments(user)
      ? db.customerAccount.findMany({
          where: { status: "active" },
          orderBy: { name: "asc" },
          select: { id: true, name: true, code: true },
        })
      : Promise.resolve([]),
  ]);

  const serializedShipments = shipments.map((shipment) => serializeShipment(shipment, user));

  if (filters?.sortBy === "priority") {
    serializedShipments.sort((left, right) => {
      const leftScore = getShipmentPriorityScore(left);
      const rightScore = getShipmentPriorityScore(right);
      if (leftScore !== rightScore) {
        return leftScore - rightScore;
      }
      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    });
  }

  return {
    viewer: {
      role: user.role,
      readOnly: user.role === "customer",
      customerAccountName: user.customerAccount?.name ?? null,
    },
    permissions: {
      canCreate: canManageShipments(user),
      canEdit: canManageShipments(user),
    },
    shipments: serializedShipments,
    flights,
    customerAccounts,
  };
}

export async function createShipment(input: {
  awb?: string;
  commodity: string;
  origin: string;
  destination: string;
  pieces: number;
  weightKg: number;
  volumeM3?: number | null;
  specialHandling?: string;
  shipper: string;
  consignee: string;
  forwarder: string;
  ownerName: string;
  flightId?: string | null;
  customerAccountId?: string | null;
  notes?: string;
  userId: string;
  actorName: string;
}) {
  const actor = await getActorWithRelations(input.userId);
  if (!actor) {
    throw new AccessError("Sesi tidak valid.", 401, "UNAUTHENTICATED");
  }

  ensureShipmentManager(actor);

  const awb = input.awb && AWB_REGEX.test(input.awb) ? input.awb : await generateUniqueAwb();
  const [customerAccount, flight] = await Promise.all([
    validateCustomerAccount(input.customerAccountId ?? null),
    validateFlight(input.flightId ?? null),
  ]);

  const shipment = await db.$transaction(async (tx) => {
    const created = await tx.shipment.create({
      data: {
        awb,
        commodity: input.commodity,
        origin: input.origin.toUpperCase(),
        destination: input.destination.toUpperCase(),
        pieces: input.pieces,
        weightKg: input.weightKg,
        volumeM3: input.volumeM3 ?? null,
        specialHandling: input.specialHandling || "",
        docStatus: "Complete",
        readiness: "Ready",
        shipper: input.shipper,
        consignee: input.consignee,
        forwarder: input.forwarder,
        ownerName: input.ownerName,
        notes: input.notes || "",
        status: "received",
        flightId: flight?.id ?? null,
        customerAccountId: customerAccount?.id ?? null,
        createdById: actor.id,
        trackingLogs: {
          create: {
            status: "received",
            message: "Kargo diterima di gudang udara.",
            location: "Gudang Udara",
            actorName: input.actorName,
          },
        },
      },
      include: shipmentInclude,
    });

    await tx.activityLog.create({
      data: {
        userId: actor.id,
        action: "Buat Shipment",
        targetType: "shipment",
        targetId: created.id,
        targetLabel: created.awb,
        description: `Shipment baru ${created.awb} dibuat untuk rute ${created.origin} -> ${created.destination}.`,
        level: "success",
      },
    });

    return created;
  });

  return serializeShipment(shipment, actor);
}

export async function updateShipment(
  shipmentId: string,
  input: {
    status?: ShipmentStatus;
    notes?: string;
    ownerName?: string;
    flightId?: string | null;
    customerAccountId?: string | null;
    docStatus?: string;
    readiness?: string;
    userId: string;
    actorName: string;
  },
) {
  const actor = await getActorWithRelations(input.userId);
  if (!actor) {
    throw new AccessError("Sesi tidak valid.", 401, "UNAUTHENTICATED");
  }

  ensureShipmentManager(actor);

  const current = await getShipmentRecordForMutation(shipmentId);
  if (current.archivedAt) {
    throw new AccessError("Shipment sudah diarsipkan.", 400, "SHIPMENT_ARCHIVED");
  }

  const [customerAccount, flight] = await Promise.all([
    input.customerAccountId !== undefined ? validateCustomerAccount(input.customerAccountId) : Promise.resolve(null),
    input.flightId !== undefined ? validateFlight(input.flightId) : Promise.resolve(null),
  ]);

  const nextStatus = input.status ?? current.status;
  const nextFlightId = input.flightId !== undefined ? flight?.id ?? null : current.flightId;
  const nextCustomerAccountId =
    input.customerAccountId !== undefined ? customerAccount?.id ?? null : current.customerAccountId;

  await db.$transaction(async (tx) => {
    await tx.shipment.update({
      where: { id: shipmentId },
      data: {
        status: nextStatus,
        notes: input.notes ?? current.notes,
        ownerName: input.ownerName ?? current.ownerName,
        flightId: nextFlightId,
        customerAccountId: nextCustomerAccountId,
        docStatus: input.docStatus ?? current.docStatus,
        readiness: input.readiness ?? current.readiness,
      },
    });

    if (nextStatus !== current.status) {
      await tx.trackingLog.create({
        data: {
          shipmentId,
          status: nextStatus,
          message: `Status diubah menjadi ${SHIPMENT_STATUS_LABELS[nextStatus]}.`,
          location: "Ruang Kontrol",
          actorName: input.actorName,
        },
      });
    }

    await tx.activityLog.create({
      data: {
        userId: actor.id,
        action: nextStatus !== current.status ? "Ubah Status" : "Perbarui Shipment",
        targetType: "shipment",
        targetId: shipmentId,
        targetLabel: current.awb,
        description:
          nextStatus !== current.status
            ? `Status ${current.awb} berubah dari ${SHIPMENT_STATUS_LABELS[current.status]} ke ${SHIPMENT_STATUS_LABELS[nextStatus]}.`
            : `Detail shipment ${current.awb} diperbarui.`,
        level: nextStatus === "hold" ? "warning" : "info",
      },
    });
  });

  const full = await getShipmentRecordForMutation(shipmentId);
  return serializeShipment(full, actor);
}

export async function archiveShipment(shipmentId: string, archived: boolean, userId: string) {
  const actor = await getActorWithRelations(userId);
  if (!actor) {
    throw new AccessError("Sesi tidak valid.", 401, "UNAUTHENTICATED");
  }

  ensureShipmentManager(actor);

  const current = await db.shipment.findUnique({
    where: { id: shipmentId },
    select: { id: true, awb: true, archivedAt: true },
  });

  if (!current) {
    throw new AccessError("Shipment tidak ditemukan.", 404, "SHIPMENT_NOT_FOUND");
  }

  await db.$transaction(async (tx) => {
    await tx.shipment.update({
      where: { id: shipmentId },
      data: {
        archivedAt: archived ? new Date() : null,
      },
    });

    await tx.activityLog.create({
      data: {
        userId: actor.id,
        action: archived ? "Arsipkan Shipment" : "Pulihkan Shipment",
        targetType: "shipment",
        targetId: shipmentId,
        targetLabel: current.awb,
        description: archived
          ? `Shipment ${current.awb} diarsipkan dari daftar kerja aktif.`
          : `Shipment ${current.awb} dipulihkan kembali ke daftar kerja aktif.`,
        level: archived ? "warning" : "success",
      },
    });
  });
}

export async function addShipmentDocument(input: {
  shipmentId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  storageUrl: string;
  storageKey?: string;
  userId: string;
}) {
  const actor = await getActorWithRelations(input.userId);
  if (!actor) {
    throw new AccessError("Sesi tidak valid.", 401, "UNAUTHENTICATED");
  }

  ensureShipmentManager(actor);
  const shipment = await getShipmentRecordForMutation(input.shipmentId);
  if (shipment.archivedAt) {
    throw new AccessError("Shipment sudah diarsipkan.", 400, "SHIPMENT_ARCHIVED");
  }

  const [document] = await db.$transaction([
    db.shipmentDocument.create({
      data: {
        shipmentId: input.shipmentId,
        fileName: input.fileName,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
        storageUrl: input.storageUrl,
        storageKey: input.storageKey,
      },
    }),
    db.activityLog.create({
      data: {
        userId: actor.id,
        action: "Unggah Dokumen",
        targetType: "document",
        targetId: input.shipmentId,
        targetLabel: input.fileName,
        description: `${input.fileName} diunggah ke shipment ${shipment.awb}.`,
        level: "success",
      },
    }),
  ]);

  return {
    id: document.id,
    fileName: document.fileName,
    mimeType: document.mimeType,
    fileSize: document.fileSize,
    storageUrl: document.storageUrl,
    createdAt: document.createdAt.toISOString(),
  };
}

export async function deleteShipmentDocument(input: {
  shipmentId: string;
  documentId: string;
  userId: string;
}) {
  const actor = await getActorWithRelations(input.userId);
  if (!actor) {
    throw new AccessError("Sesi tidak valid.", 401, "UNAUTHENTICATED");
  }

  ensureShipmentManager(actor);

  const document = await db.shipmentDocument.findFirst({
    where: {
      id: input.documentId,
      shipmentId: input.shipmentId,
      deletedAt: null,
      shipment: {
        archivedAt: null,
      },
    },
    include: {
      shipment: {
        select: {
          awb: true,
        },
      },
    },
  });

  if (!document) {
    throw new AccessError("Dokumen tidak ditemukan.", 404, "DOCUMENT_NOT_FOUND");
  }

  await db.$transaction(async (tx) => {
    await tx.shipmentDocument.update({
      where: { id: document.id },
      data: {
        deletedAt: new Date(),
        blobCleanupStatus: "pending",
      },
    });

    await tx.activityLog.create({
      data: {
        userId: actor.id,
        action: "Hapus Dokumen",
        targetType: "document",
        targetId: document.id,
        targetLabel: document.fileName,
        description: `Dokumen ${document.fileName} disembunyikan dari shipment ${document.shipment.awb} dan menunggu cleanup blob.`,
        level: "info",
      },
    });
  });

  let warning: string | null = null;

  try {
    await deleteDocumentBlob({
      storageKey: document.storageKey,
      storageUrl: document.storageUrl,
    });

    await db.shipmentDocument.update({
      where: { id: document.id },
      data: {
        blobCleanupStatus: "deleted",
      },
    });
  } catch (error) {
    warning = "Dokumen berhasil disembunyikan, tetapi cleanup blob gagal. Tim internal perlu menindaklanjuti penyimpanan.";

    await db.$transaction(async (tx) => {
      await tx.shipmentDocument.update({
        where: { id: document.id },
        data: {
          blobCleanupStatus: "failed",
        },
      });

      await tx.activityLog.create({
        data: {
          userId: actor.id,
          action: "Pembersihan Blob Gagal",
          targetType: "document",
          targetId: document.id,
          targetLabel: document.fileName,
          description:
            error instanceof Error
              ? `Cleanup blob untuk ${document.fileName} gagal: ${error.message}`
              : `Cleanup blob untuk ${document.fileName} gagal dan perlu ditangani manual.`,
          level: "warning",
        },
      });
    });
  }

  return {
    success: true,
    warning,
  };
}

export async function getShipmentByAwb(user: AccessUser, awb: string) {
  const shipment = await db.shipment.findFirst({
    where: scopeAwbWhere(user, awb),
    include: shipmentInclude,
  });

  return shipment ? serializeShipment(shipment, user) : null;
}

export async function rememberAwbSearch(userId: string, awb: string) {
  await db.$transaction(async (tx) => {
    await tx.recentAwbSearch.create({
      data: { userId, awb },
    });

    const searches = await tx.recentAwbSearch.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: 8,
    });

    if (searches.length) {
      await tx.recentAwbSearch.deleteMany({
        where: { id: { in: searches.map((item) => item.id) } },
      });
    }
  });
}

export async function getRecentAwbSearches(user: AccessUser) {
  const searches = await db.recentAwbSearch.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  const awbs = Array.from(new Set(searches.map((item) => item.awb)));
  const scopedShipments = awbs.length
    ? await db.shipment.findMany({
        where: {
          ...scopeShipmentWhere(user),
          awb: { in: awbs },
        },
        include: {
          flight: {
            select: {
              flightNumber: true,
            },
          },
        },
      })
    : [];

  const shipmentByAwb = new Map(
    scopedShipments.map((shipment) => [
      shipment.awb,
      {
        status: shipment.status,
        statusLabel: SHIPMENT_STATUS_LABELS[shipment.status],
        origin: shipment.origin,
        destination: shipment.destination,
        flightNumber: shipment.flight?.flightNumber ?? null,
        updatedAt: shipment.updatedAt.toISOString(),
        docStatus: shipment.docStatus,
      },
    ]),
  );

  return searches.map((item) => ({
    id: item.id,
    awb: item.awb,
    createdAt: item.createdAt.toISOString(),
    status: shipmentByAwb.get(item.awb)?.status ?? null,
    statusLabel: shipmentByAwb.get(item.awb)?.statusLabel ?? null,
    origin: shipmentByAwb.get(item.awb)?.origin ?? null,
    destination: shipmentByAwb.get(item.awb)?.destination ?? null,
    flightNumber: shipmentByAwb.get(item.awb)?.flightNumber ?? null,
    updatedAt: shipmentByAwb.get(item.awb)?.updatedAt ?? null,
    docStatus: shipmentByAwb.get(item.awb)?.docStatus ?? null,
  }));
}

export async function inviteUser(input: {
  name: string;
  email: string;
  role: "admin" | "staff" | "customer";
  station: string;
  customerAccountId?: string | null;
  invitedById: string;
}) {
  const actor = await getActorWithRelations(input.invitedById);
  if (!actor) {
    throw new AccessError("Sesi tidak valid.", 401, "UNAUTHENTICATED");
  }

  ensureAdmin(actor);

  const customerAccount =
    input.role === "customer" ? await validateCustomerAccount(input.customerAccountId ?? null) : null;

  if (input.role === "customer" && !customerAccount) {
    throw new AccessError("Pengguna pelanggan wajib terhubung ke akun pelanggan aktif.", 400, "CUSTOMER_LINK_REQUIRED");
  }

  const user = await db.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash: "$2b$10$2nDaRkI6SQ7qN4uA.7Z0m.9pO5X2FdtYYG6iwSeNBY0d5hDOGOZaC",
        role: input.role,
        station: input.station,
        status: "invited",
        customerAccountId: customerAccount?.id ?? null,
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
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        station: true,
        status: true,
        customerAccountId: true,
        customerAccount: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    await tx.activityLog.create({
      data: {
        userId: actor.id,
        action: "Undang Pengguna",
        targetType: "user",
        targetId: created.id,
        targetLabel: created.email,
        description: `Pengguna ${created.email} diundang sebagai ${ROLE_LABELS[created.role]}.`,
        level: "success",
      },
    });

    return created;
  });

  return serializeManagedUser(user);
}

export async function updateUserAccess(
  userId: string,
  input: {
    role?: "admin" | "staff" | "customer";
    status?: "active" | "invited" | "disabled";
    station?: string;
    customerAccountId?: string | null;
    actorUserId: string;
  },
) {
  const actor = await getActorWithRelations(input.actorUserId);
  if (!actor) {
    throw new AccessError("Sesi tidak valid.", 401, "UNAUTHENTICATED");
  }

  ensureAdmin(actor);

  const current = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      status: true,
      customerAccountId: true,
      email: true,
    },
  });

  if (!current) {
    throw new AccessError("Pengguna tidak ditemukan.", 404, "USER_NOT_FOUND");
  }

  const nextRole = input.role ?? current.role;
  const nextStatus = input.status ?? current.status;

  if (current.id === actor.id && nextStatus === "disabled") {
    throw new AccessError("Akun admin yang sedang dipakai tidak dapat dinonaktifkan.", 400, "SELF_DISABLE_NOT_ALLOWED");
  }

  if (current.role === "admin" && (nextRole !== "admin" || nextStatus !== "active")) {
    const remainingActiveAdmin = await db.user.count({
      where: {
        id: { not: current.id },
        role: "admin",
        status: "active",
      },
    });

    if (remainingActiveAdmin === 0) {
      throw new AccessError("Minimal harus ada satu admin aktif di sistem.", 400, "LAST_ADMIN_PROTECTION");
    }
  }

  const resolvedCustomerAccount =
    nextRole === "customer"
      ? await validateCustomerAccount(input.customerAccountId ?? current.customerAccountId)
      : null;

  if (nextRole === "customer" && !resolvedCustomerAccount) {
    throw new AccessError("Pengguna pelanggan wajib memiliki akun pelanggan aktif.", 400, "CUSTOMER_LINK_REQUIRED");
  }

  const user = await db.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: userId },
      data: {
        role: nextRole,
        status: nextStatus,
        station: input.station,
        customerAccountId: nextRole === "customer" ? resolvedCustomerAccount?.id ?? null : null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        station: true,
        status: true,
        customerAccountId: true,
        customerAccount: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    await tx.activityLog.create({
      data: {
        userId: actor.id,
        action: "Perbarui Hak Akses Pengguna",
        targetType: "user",
        targetId: updated.id,
        targetLabel: updated.email,
        description: `Hak akses ${updated.email} diperbarui.`,
        level: "info",
      },
    });

    return updated;
  });

  return serializeManagedUser(user);
}

export async function createCustomerAccount(input: {
  code: string;
  name: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  actorUserId: string;
}) {
  const actor = await getActorWithRelations(input.actorUserId);
  if (!actor) {
    throw new AccessError("Sesi tidak valid.", 401, "UNAUTHENTICATED");
  }

  if (!canManageCustomerAccounts(actor)) {
    throw new AccessError("Akun pelanggan hanya dapat dikelola admin.", 403, "CUSTOMER_ACCOUNT_ADMIN_ONLY");
  }

  const account = await db.$transaction(async (tx) => {
    const created = await tx.customerAccount.create({
      data: {
        code: input.code.toUpperCase(),
        name: input.name,
        contactName: input.contactName || null,
        contactEmail: input.contactEmail || null,
        contactPhone: input.contactPhone || null,
      },
      include: {
        users: {
          select: { id: true, name: true, email: true },
        },
        shipments: {
          select: { id: true },
        },
      },
    });

    await tx.activityLog.create({
      data: {
        userId: actor.id,
        action: "Buat Akun Pelanggan",
        targetType: "customer-account",
        targetId: created.id,
        targetLabel: created.name,
        description: `Akun pelanggan ${created.name} dibuat.`,
        level: "success",
      },
    });

    return created;
  });

  return serializeCustomerAccount(account);
}

export async function updateCustomerAccount(input: {
  accountId: string;
  code?: string;
  name?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  status?: "active" | "disabled";
  actorUserId: string;
}) {
  const actor = await getActorWithRelations(input.actorUserId);
  if (!actor) {
    throw new AccessError("Sesi tidak valid.", 401, "UNAUTHENTICATED");
  }

  if (!canManageCustomerAccounts(actor)) {
    throw new AccessError("Akun pelanggan hanya dapat dikelola admin.", 403, "CUSTOMER_ACCOUNT_ADMIN_ONLY");
  }

  const account = await db.$transaction(async (tx) => {
    const updated = await tx.customerAccount.update({
      where: { id: input.accountId },
      data: {
        code: input.code?.toUpperCase(),
        name: input.name,
        contactName: input.contactName,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
        status: input.status,
      },
      include: {
        users: {
          select: { id: true, name: true, email: true },
        },
        shipments: {
          select: { id: true },
        },
      },
    });

    await tx.activityLog.create({
      data: {
        userId: actor.id,
        action: "Perbarui Akun Pelanggan",
        targetType: "customer-account",
        targetId: updated.id,
        targetLabel: updated.name,
        description: `Akun pelanggan ${updated.name} diperbarui.`,
        level: updated.status === "disabled" ? "warning" : "info",
      },
    });

    return updated;
  });

  return serializeCustomerAccount(account);
}

export async function getFlightBoardData(user: AccessUser, filters?: { status?: string; query?: string }) {
  if (!isInternalRole(user.role)) {
    throw new AccessError("Halaman flight hanya untuk pengguna internal.", 403, "INTERNAL_ROUTE_ONLY");
  }

  const where: Prisma.FlightWhereInput = scopeFlightWhere();

  if (filters?.status && filters.status !== "all") {
    where.status = filters.status as Prisma.FlightWhereInput["status"];
  }

  if (filters?.query) {
    where.OR = [
      { flightNumber: { contains: filters.query } },
      { origin: { contains: filters.query.toUpperCase() } },
      { destination: { contains: filters.query.toUpperCase() } },
    ];
  }

  const flights = await db.flight.findMany({
    where,
    include: flightBoardInclude,
    orderBy: { cargoCutoffTime: "asc" },
  });

  return {
    permissions: {
      canManageFlights: canManageFlights(user),
    },
    summary: {
      onTime: flights.filter((item) => item.status === "on_time").length,
      delayed: flights.filter((item) => item.status === "delayed").length,
      departed: flights.filter((item) => item.status === "departed").length,
    },
    flights: flights.map((flight) => {
      const meta = getFlightVisualMeta(flight.flightNumber, flight.aircraftType);
      return {
        id: flight.id,
        flightNumber: flight.flightNumber,
        aircraftType: meta.aircraftType,
        route: serializeRoute(flight.origin, flight.destination),
        origin: flight.origin,
        destination: flight.destination,
        departureTime: flight.departureTime.toISOString(),
        arrivalTime: flight.arrivalTime.toISOString(),
        cargoCutoffTime: flight.cargoCutoffTime.toISOString(),
        status: flight.status,
        statusLabel: FLIGHT_STATUS_LABELS[flight.status],
        gate: flight.gate,
        remarks: flight.remarks,
        imageUrl: meta.aircraftImageUrl,
        airlineCode: meta.airlineCode,
        airlineName: meta.airlineName,
        airlineFullName: meta.airlineFullName,
        airlineLogoUrl: meta.airlineLogoUrl,
        registration: meta.registration,
        category: meta.category,
        brandColor: meta.brandColor,
        archivedAt: flight.archivedAt?.toISOString() ?? null,
        shipments: flight.shipments.map((shipment) => {
          const serialized = serializeShipment(shipment, user);
          return {
            id: serialized.id,
            awb: serialized.awb,
            commodity: serialized.commodity,
            status: serialized.status,
            statusLabel: serialized.statusLabel,
            weightKg: serialized.weightKg,
          };
        }),
      };
    }),
  };
}

export async function createFlight(input: {
  flightNumber: string;
  aircraftType: string;
  origin: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  cargoCutoffTime: string;
  status: "on_time" | "delayed" | "departed";
  gate?: string | null;
  remarks?: string | null;
  actorUserId: string;
}) {
  const actor = await getActorWithRelations(input.actorUserId);
  if (!actor) {
    throw new AccessError("Sesi tidak valid.", 401, "UNAUTHENTICATED");
  }

  ensureFlightManager(actor);
  const normalizedFlightNumber = ensureAllowedFlightNumber(input.flightNumber);
  const meta = getFlightVisualMeta(normalizedFlightNumber, input.aircraftType);

  const flight = await db.$transaction(async (tx) => {
    const created = await tx.flight.create({
      data: {
        flightNumber: normalizedFlightNumber,
        aircraftType: input.aircraftType,
        origin: input.origin.toUpperCase(),
        destination: input.destination.toUpperCase(),
        departureTime: new Date(input.departureTime),
        arrivalTime: new Date(input.arrivalTime),
        cargoCutoffTime: new Date(input.cargoCutoffTime),
        status: input.status,
        gate: input.gate || null,
        remarks: input.remarks || null,
        imageUrl: meta.aircraftImageUrl,
      },
    });

    await tx.activityLog.create({
      data: {
        userId: actor.id,
        action: "Buat Flight",
        targetType: "flight",
        targetId: created.id,
        targetLabel: created.flightNumber,
        description: `Flight ${created.flightNumber} dibuat untuk rute ${created.origin} -> ${created.destination}.`,
        level: "success",
      },
    });

    return created;
  });

  return flight;
}

export async function updateFlight(input: {
  flightId: string;
  flightNumber?: string;
  aircraftType?: string;
  origin?: string;
  destination?: string;
  departureTime?: string;
  arrivalTime?: string;
  cargoCutoffTime?: string;
  status?: "on_time" | "delayed" | "departed";
  gate?: string | null;
  remarks?: string | null;
  archived?: boolean;
  actorUserId: string;
}) {
  const actor = await getActorWithRelations(input.actorUserId);
  if (!actor) {
    throw new AccessError("Sesi tidak valid.", 401, "UNAUTHENTICATED");
  }

  ensureFlightManager(actor);

  const current = await db.flight.findUnique({
    where: { id: input.flightId },
    select: {
      id: true,
      flightNumber: true,
      aircraftType: true,
      origin: true,
      destination: true,
      archivedAt: true,
    },
  });

  if (!current) {
    throw new AccessError("Flight tidak ditemukan.", 404, "FLIGHT_NOT_FOUND");
  }

  const normalizedFlightNumber = ensureAllowedFlightNumber(input.flightNumber ?? current.flightNumber);
  const nextAircraftType = input.aircraftType ?? current.aircraftType;
  const meta = getFlightVisualMeta(normalizedFlightNumber, nextAircraftType);

  const updated = await db.$transaction(async (tx) => {
    const next = await tx.flight.update({
      where: { id: input.flightId },
      data: {
        flightNumber: normalizedFlightNumber,
        aircraftType: input.aircraftType,
        origin: input.origin?.toUpperCase(),
        destination: input.destination?.toUpperCase(),
        departureTime: input.departureTime ? new Date(input.departureTime) : undefined,
        arrivalTime: input.arrivalTime ? new Date(input.arrivalTime) : undefined,
        cargoCutoffTime: input.cargoCutoffTime ? new Date(input.cargoCutoffTime) : undefined,
        status: input.status,
        gate: input.gate,
        remarks: input.remarks,
        imageUrl: meta.aircraftImageUrl,
        archivedAt: input.archived === undefined ? undefined : input.archived ? new Date() : null,
      },
    });

    await tx.activityLog.create({
      data: {
        userId: actor.id,
        action: input.archived === undefined ? "Perbarui Flight" : input.archived ? "Arsipkan Flight" : "Pulihkan Flight",
        targetType: "flight",
        targetId: next.id,
        targetLabel: next.flightNumber,
        description:
          input.archived === undefined
            ? `Detail flight ${next.flightNumber} diperbarui.`
            : input.archived
              ? `Flight ${next.flightNumber} diarsipkan dari papan kerja aktif.`
              : `Flight ${next.flightNumber} dipulihkan kembali ke papan kerja aktif.`,
        level: input.archived ? "warning" : "info",
      },
    });

    return next;
  });

  return updated;
}

export async function listActivityLogs(
  user: AccessUser,
  filters?: { query?: string; action?: string; userId?: string },
) {
  if (!isInternalRole(user.role)) {
    throw new AccessError("Log aktivitas hanya untuk pengguna internal.", 403, "INTERNAL_ROUTE_ONLY");
  }

  const where: Prisma.ActivityLogWhereInput = {};

  if (filters?.query) {
    where.OR = [
      { targetLabel: { contains: filters.query } },
      { description: { contains: filters.query } },
      { action: { contains: filters.query } },
    ];
  }

  if (filters?.action && filters.action !== "all") {
    where.action = filters.action;
  }

  if (filters?.userId && filters.userId !== "all") {
    where.userId = filters.userId;
  }

  const [logs, users] = await Promise.all([
    db.activityLog.findMany({
      where,
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: 120,
    }),
    db.user.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    users,
    logs: logs.map((log) => ({
      id: log.id,
      action: log.action,
      targetType: log.targetType,
      targetLabel: log.targetLabel,
      description: log.description,
      level: log.level,
      userName: log.user?.name ?? "Sistem",
      userId: log.userId,
      createdAt: log.createdAt.toISOString(),
    })),
  };
}

export async function getSettingsData(userId: string) {
  const user = await getActorWithRelations(userId);
  if (!user) {
    throw new AccessError("Pengguna tidak ditemukan.", 404, "USER_NOT_FOUND");
  }

  const [users, customerAccounts] = await Promise.all([
    db.user.findMany({
      ...getUserFilters(user),
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        station: true,
        status: true,
        customerAccountId: true,
        customerAccount: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
    db.customerAccount.findMany({
      where: scopeCustomerAccountWhere(user),
      orderBy: { name: "asc" },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        shipments: {
          where: { archivedAt: null },
          select: { id: true },
        },
      },
    }),
  ]);

  return {
    profile: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      station: user.station,
      customerAccountId: user.customerAccountId,
      customerAccountName: user.customerAccount?.name ?? null,
    },
    settings: user.settings
      ? {
          theme: user.settings.theme,
          compactRows: user.settings.compactRows,
          sidebarCollapsed: user.settings.sidebarCollapsed,
          autoRefresh: user.settings.autoRefresh,
          refreshIntervalSeconds: user.settings.refreshIntervalSeconds,
          cutoffAlert: user.settings.cutoffAlert,
          exceptionAlert: user.settings.exceptionAlert,
          soundAlert: user.settings.soundAlert,
          emailDigest: user.settings.emailDigest,
        }
      : null,
    permissions: {
      canManageUsers: canManageUsers(user),
      canManageCustomerAccounts: canManageCustomerAccounts(user),
    },
    users: users.map(serializeManagedUser),
    customerAccounts: customerAccounts.map(serializeCustomerAccount),
  };
}

export async function updateSettings(
  userId: string,
  input: {
    name?: string;
    station?: string;
    compactRows?: boolean;
    sidebarCollapsed?: boolean;
    autoRefresh?: boolean;
    refreshIntervalSeconds?: number;
    theme?: "light" | "dark";
    cutoffAlert?: boolean;
    exceptionAlert?: boolean;
    soundAlert?: boolean;
    emailDigest?: boolean;
  },
) {
  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        name: input.name,
        station: input.station,
      },
    });

    await tx.userSetting.upsert({
      where: { userId },
      create: {
        userId,
        theme: input.theme ?? "light",
        compactRows: input.compactRows ?? false,
        sidebarCollapsed: input.sidebarCollapsed ?? false,
        autoRefresh: input.autoRefresh ?? true,
        refreshIntervalSeconds: input.refreshIntervalSeconds ?? 5,
        cutoffAlert: input.cutoffAlert ?? true,
        exceptionAlert: input.exceptionAlert ?? true,
        soundAlert: input.soundAlert ?? false,
        emailDigest: input.emailDigest ?? false,
      },
      update: {
        theme: input.theme,
        compactRows: input.compactRows,
        sidebarCollapsed: input.sidebarCollapsed,
        autoRefresh: input.autoRefresh,
        refreshIntervalSeconds: input.refreshIntervalSeconds,
        cutoffAlert: input.cutoffAlert,
        exceptionAlert: input.exceptionAlert,
        soundAlert: input.soundAlert,
        emailDigest: input.emailDigest,
      },
    });

    await tx.activityLog.create({
      data: {
        userId,
        action: "Perbarui Pengaturan",
        targetType: "settings",
        targetLabel: "Preferensi Tampilan",
        description: "Pengaturan pengguna diperbarui.",
        level: "success",
      },
    });
  });

  return getSettingsData(userId);
}

export async function markNotificationsRead(userId: string) {
  await db.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
}

export async function markNotificationRead(userId: string, notificationId: string) {
  await db.notification.updateMany({
    where: {
      id: notificationId,
      userId,
      read: false,
    },
    data: { read: true },
  });
}

export async function reportAwbIssue(user: AccessUser, awb: string) {
  const shipment = await db.shipment.findFirst({
    where: scopeAwbWhere(user, awb),
    select: {
      id: true,
      awb: true,
    },
  });

  if (!shipment) {
    throw new AccessError("AWB tidak ditemukan.", 404, "SHIPMENT_NOT_FOUND");
  }

  await db.activityLog.create({
    data: {
      userId: user.id,
      action: "Laporkan Isu",
      targetType: "tracking",
      targetId: shipment.id,
      targetLabel: awb,
      description: `${isInternalRole(user.role) ? "Pengguna internal" : "Pelanggan"} menandai isu pada AWB ${awb} untuk ditinjau.`,
      level: "warning",
    },
  });

  return { success: true };
}

export async function searchGlobal(user: AccessUser, query: string) {
  if (AWB_REGEX.test(query)) {
    const shipment = await db.shipment.findFirst({
      where: scopeAwbWhere(user, query),
      select: { awb: true },
    });

    if (shipment) {
      return { path: `/awb-tracking?awb=${shipment.awb}`, label: shipment.awb, kind: "AWB" };
    }
  }

  if (isInternalRole(user.role)) {
    const flight = await db.flight.findFirst({
      where: {
        ...scopeFlightWhere(),
        flightNumber: { contains: query },
      },
    });

    if (flight) {
      return { path: `/flight-board?query=${flight.flightNumber}`, label: flight.flightNumber, kind: "Flight" };
    }
  }

  const shipment = await db.shipment.findFirst({
    where: {
      ...scopeShipmentWhere(user),
      OR: [{ awb: { contains: query } }, { commodity: { contains: query } }],
    },
    select: {
      awb: true,
    },
  });

  if (shipment) {
    return { path: `/shipment-ledger?query=${shipment.awb}`, label: shipment.awb, kind: "Shipment" };
  }

  return null;
}
