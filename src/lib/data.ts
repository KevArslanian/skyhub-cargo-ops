import { Prisma, ShipmentStatus } from "@prisma/client";
import { addMinutes, endOfDay, startOfDay } from "date-fns";
import { AccessError, assertInternalApiAccess, canManageUsers, type AccessUser } from "./access";
import { db } from "./prisma";
import { AWB_REGEX, FLIGHT_STATUS_LABELS, SHIPMENT_STATUS_LABELS } from "./constants";
import { getFlightVisualMeta, getShipmentPriorityScore } from "./flight-meta";
import { getDocumentAccessUrl } from "./storage";

const shipmentInclude = Prisma.validator<Prisma.ShipmentInclude>()({
  flight: true,
  trackingLogs: {
    orderBy: { createdAt: "asc" },
  },
  documents: {
    orderBy: { createdAt: "desc" },
  },
});

type ShipmentRecord = Prisma.ShipmentGetPayload<{ include: typeof shipmentInclude }>;

async function getAccessUser(userId: string): Promise<AccessUser | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      status: true,
      station: true,
    },
  });

  if (!user || user.status !== "active") {
    return null;
  }

  return user;
}

async function requireAccessUser(userId: string) {
  const user = await getAccessUser(userId);

  if (!user) {
    throw new AccessError("Sesi tidak valid.", 401, "UNAUTHENTICATED");
  }

  return user;
}

async function ensureFlightExists(flightId?: string | null) {
  if (!flightId) {
    return null;
  }

  const flight = await db.flight.findUnique({
    where: { id: flightId },
    select: { id: true },
  });

  if (!flight) {
    throw new AccessError("Flight tidak ditemukan.", 400, "FLIGHT_INVALID");
  }

  return flight.id;
}

function serializeTrackingLog(log: {
  id: string;
  status: ShipmentStatus;
  message: string;
  location: string;
  actorName: string | null;
  createdAt: Date;
}, user: AccessUser) {
  const customerView = user.role === "customer";

  return {
    ...log,
    message: customerView ? `Status ${SHIPMENT_STATUS_LABELS[log.status]} telah tercatat.` : log.message,
    location: customerView ? "Status Tracking" : log.location,
    actorName: customerView ? null : log.actorName,
    label: SHIPMENT_STATUS_LABELS[log.status],
    createdAt: log.createdAt.toISOString(),
  };
}

function serializeShipment(shipment: ShipmentRecord, user: AccessUser) {
  const latestTrackingTimestamp = shipment.trackingLogs.reduce<Date | null>((latest, log) => {
    if (!latest || log.createdAt.getTime() > latest.getTime()) {
      return log.createdAt;
    }
    return latest;
  }, null);

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
    specialHandling: isCustomer ? null : shipment.specialHandling,
    docStatus: shipment.docStatus,
    readiness: shipment.readiness,
    shipper: shipment.shipper,
    consignee: shipment.consignee,
    forwarder: isCustomer ? "" : shipment.forwarder,
    ownerName: isCustomer ? "" : shipment.ownerName,
    notes: isCustomer ? "" : shipment.notes ?? "",
    status: shipment.status,
    statusLabel: SHIPMENT_STATUS_LABELS[shipment.status],
    receivedAt: shipment.receivedAt.toISOString(),
    updatedAt: (latestTrackingTimestamp ?? shipment.updatedAt).toISOString(),
    flightId: shipment.flightId,
    flightNumber: shipment.flight?.flightNumber ?? null,
    trackingLogs: shipment.trackingLogs
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
      .map((log) => serializeTrackingLog(log, user)),
    documents: isCustomer
      ? []
      : shipment.documents.map((document) => ({
          id: document.id,
          fileName: document.fileName,
          mimeType: document.mimeType,
          fileSize: document.fileSize,
          storageUrl: getDocumentAccessUrl(document.storageKey, document.storageUrl) ?? document.storageUrl,
          createdAt: document.createdAt.toISOString(),
        })),
  };
}

function serializeRoute(origin: string, destination: string) {
  return `${origin} -> ${destination}`;
}

export async function getShellData(userId: string) {
  const [user, notifications] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      include: { settings: true },
    }),
    db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  if (!user || user.status !== "active" || !user.settings) {
    return null;
  }

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      station: user.station,
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

export async function getDashboardData(user: AccessUser) {
  assertInternalApiAccess(user);
  const now = new Date();
  const [initialShipments, flightsToday, recentActivity] = await Promise.all([
    db.shipment.findMany({
      where: {
        receivedAt: {
          gte: startOfDay(now),
          lte: endOfDay(now),
        },
      },
      include: shipmentInclude,
      orderBy: { receivedAt: "desc" },
      take: 50,
    }),
    db.flight.findMany({
      orderBy: { cargoCutoffTime: "asc" },
      take: 24,
    }),
    db.activityLog.findMany({
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  let shipmentsToday = initialShipments;

  if (!shipmentsToday.length) {
    const latestShipment = await db.shipment.findFirst({
      orderBy: { receivedAt: "desc" },
      select: { receivedAt: true },
    });

    if (latestShipment) {
      shipmentsToday = await db.shipment.findMany({
        where: {
          receivedAt: {
            gte: startOfDay(latestShipment.receivedAt),
            lte: endOfDay(latestShipment.receivedAt),
          },
        },
        include: shipmentInclude,
        orderBy: { receivedAt: "desc" },
        take: 50,
      });
    }
  }

  const onTime = flightsToday.filter((flight) => flight.status === "on_time").length;
  const delayed = flightsToday.filter((flight) => flight.status === "delayed").length;
  const departed = flightsToday.filter((flight) => flight.status === "departed").length;
  const holds = shipmentsToday.filter((shipment) => shipment.status === "hold").length;

  return {
    metrics: {
      shipmentsToday: shipmentsToday.length,
      activeFlights: flightsToday.length,
      onTime,
      delayed,
      departed,
      holds,
    },
    flightsSummary: flightsToday.map((flight) => {
      const meta = getFlightVisualMeta(flight.flightNumber, flight.aircraftType, flight.imageUrl);
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
    shipmentsToday: shipmentsToday.map((shipment) => serializeShipment(shipment, user)),
    alerts: shipmentsToday
      .filter((shipment) => shipment.status === "hold" || shipment.docStatus !== "Complete")
      .map((shipment) => ({
        id: shipment.id,
        awb: shipment.awb,
        title: shipment.status === "hold" ? "Shipment tertahan" : "Dokumen perlu ditinjau",
        detail:
          shipment.status === "hold"
            ? `Shipment ${shipment.awb} masih berstatus hold dan perlu tindakan operator.`
            : `Shipment ${shipment.awb} memiliki status dokumen ${shipment.docStatus}.`,
      })),
    recentActivity: recentActivity.map((activity) => ({
      id: activity.id,
      action: activity.action,
      targetLabel: activity.targetLabel,
      description: activity.description,
      level: activity.level,
      userName: activity.user?.name ?? "System",
      createdAt: activity.createdAt.toISOString(),
    })),
  };
}

export async function listShipments(user: AccessUser, filters?: {
  query?: string;
  status?: string;
  flight?: string;
  sortBy?: string;
}) {
  assertInternalApiAccess(user);
  const where: Prisma.ShipmentWhereInput = {};

  if (filters?.query) {
    where.OR = [
      { awb: { contains: filters.query } },
      { commodity: { contains: filters.query } },
      { shipper: { contains: filters.query } },
      { consignee: { contains: filters.query } },
    ];
  }

  if (filters?.status && filters.status !== "all") {
    where.status = filters.status as ShipmentStatus;
  }

  if (filters?.flight && filters.flight !== "all") {
    where.flight = { flightNumber: filters.flight };
  }

  const orderBy =
    filters?.sortBy === "updated"
      ? [{ updatedAt: "desc" as const }]
      : filters?.sortBy === "received"
        ? [{ receivedAt: "desc" as const }]
        : [{ status: "asc" as const }, { updatedAt: "desc" as const }];

  const [shipments, flights] = await Promise.all([
    db.shipment.findMany({
      where,
      include: shipmentInclude,
      orderBy,
    }),
    db.flight.findMany({
      orderBy: { cargoCutoffTime: "asc" },
      select: { id: true, flightNumber: true },
    }),
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
    shipments: serializedShipments,
    flights,
  };
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
  notes?: string;
  userId: string;
  actorName: string;
}) {
  const actor = await requireAccessUser(input.userId);
  assertInternalApiAccess(actor);
  const awb = input.awb && AWB_REGEX.test(input.awb) ? input.awb : await generateUniqueAwb();
  const flightId = await ensureFlightExists(input.flightId);

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
        flightId: flightId || null,
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
        action: "Create Shipment",
        targetType: "shipment",
        targetId: created.id,
        targetLabel: created.awb,
        description: `Shipment baru ${created.awb} diterima untuk rute ${created.origin} -> ${created.destination}.`,
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
  userId: string;
  actorName: string;
  },
) {
  const actor = await requireAccessUser(input.userId);
  assertInternalApiAccess(actor);
  const current = await db.shipment.findUnique({
    where: { id: shipmentId },
  });

  if (!current) {
    throw new AccessError("Shipment tidak ditemukan.", 404, "SHIPMENT_NOT_FOUND");
  }

  const nextStatus = input.status ?? current.status;

  const updated = await db.$transaction(async (tx) => {
    const shipment = await tx.shipment.update({
      where: { id: shipmentId },
      data: {
        status: nextStatus,
        notes: input.notes ?? current.notes,
        ownerName: input.ownerName ?? current.ownerName,
      },
      include: shipmentInclude,
    });

    if (nextStatus !== current.status) {
      await tx.trackingLog.create({
        data: {
          shipmentId,
          status: nextStatus,
          message: `Status diubah menjadi ${SHIPMENT_STATUS_LABELS[nextStatus]}.`,
          location: "Control Room",
          actorName: input.actorName,
        },
      });
    }

    await tx.activityLog.create({
      data: {
        userId: actor.id,
        action: nextStatus !== current.status ? "Update Status" : "Update Shipment",
        targetType: "shipment",
        targetId: shipmentId,
        targetLabel: current.awb,
        description:
          nextStatus !== current.status
            ? `Status ${current.awb} berubah dari ${SHIPMENT_STATUS_LABELS[current.status]} ke ${SHIPMENT_STATUS_LABELS[nextStatus]}.`
            : `Catatan shipment ${current.awb} diperbarui.`,
        level: nextStatus === "hold" ? "warning" : "info",
      },
    });

    return shipment;
  });

  const full = await db.shipment.findUniqueOrThrow({
    where: { id: updated.id },
    include: shipmentInclude,
  });

  return serializeShipment(full, actor);
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
  const actor = await requireAccessUser(input.userId);
  assertInternalApiAccess(actor);

  const shipment = await db.shipment.findUnique({
    where: { id: input.shipmentId },
    select: {
      id: true,
      awb: true,
    },
  });

  if (!shipment) {
    throw new AccessError("Shipment tidak ditemukan.", 404, "SHIPMENT_NOT_FOUND");
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
        action: "Upload Document",
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
    storageUrl: getDocumentAccessUrl(document.storageKey, document.storageUrl) ?? document.storageUrl,
    createdAt: document.createdAt.toISOString(),
  };
}

export async function getShipmentDocumentDownload(user: AccessUser, fileName: string) {
  if (user.role === "customer") {
    throw new AccessError("Dokumen tidak ditemukan.", 404, "DOCUMENT_NOT_FOUND");
  }

  const document = await db.shipmentDocument.findFirst({
    where: {
      OR: [
        { storageKey: fileName },
        { storageKey: { endsWith: `/${fileName}` } },
        { storageUrl: { endsWith: `/${fileName}` } },
      ],
    },
    select: {
      fileName: true,
      mimeType: true,
      storageKey: true,
      storageUrl: true,
    },
  });

  if (!document) {
    throw new AccessError("Dokumen tidak ditemukan.", 404, "DOCUMENT_NOT_FOUND");
  }

  return document;
}

export async function getShipmentByAwb(user: AccessUser, awb: string) {
  const shipment = await db.shipment.findUnique({
    where: { awb },
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
      skip: 5,
    });

    if (searches.length) {
      await tx.recentAwbSearch.deleteMany({
        where: { id: { in: searches.map((item) => item.id) } },
      });
    }
  });
}

export async function getRecentAwbSearches(userId: string) {
  const searches = await db.recentAwbSearch.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return searches.map((item) => ({
    id: item.id,
    awb: item.awb,
    createdAt: item.createdAt.toISOString(),
  }));
}

export async function inviteUser(input: {
  name: string;
  email: string;
  role: "admin" | "supervisor" | "operator" | "customer";
  station: string;
  invitedById: string;
}) {
  const actor = await requireAccessUser(input.invitedById);

  if (!canManageUsers(actor)) {
    throw new AccessError("Manajemen user hanya untuk admin.", 403, "ADMIN_ONLY");
  }

  const user = await db.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name: input.name,
        email: input.email.trim().toLowerCase(),
        passwordHash: "$2b$10$2nDaRkI6SQ7qN4uA.7Z0m.9pO5X2FdtYYG6iwSeNBY0d5hDOGOZaC",
        role: input.role,
        station: input.station,
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
      },
    });

    await tx.activityLog.create({
      data: {
        userId: actor.id,
        action: "Invite User",
        targetType: "user",
        targetId: created.id,
        targetLabel: created.email,
        description: `User ${created.email} diundang sebagai ${created.role}.`,
        level: "success",
      },
    });

    return created;
  });

  return user;
}

export async function updateUserAccess(
  userId: string,
  input: {
    role?: "admin" | "supervisor" | "operator" | "customer";
    status?: "active" | "invited" | "disabled";
    station?: string;
    actorUserId: string;
  },
) {
  const actor = await requireAccessUser(input.actorUserId);

  if (!canManageUsers(actor)) {
    throw new AccessError("Manajemen user hanya untuk admin.", 403, "ADMIN_ONLY");
  }

  const user = await db.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: userId },
      data: {
        role: input.role,
        status: input.status,
        station: input.station,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        station: true,
        status: true,
      },
    });

    await tx.activityLog.create({
      data: {
        userId: actor.id,
        action: "Update User Role",
        targetType: "user",
        targetId: updated.id,
        targetLabel: updated.email,
        description: `Hak akses ${updated.email} diperbarui.`,
        level: "info",
      },
    });

    return updated;
  });

  return user;
}

export async function getFlightBoardData(user: AccessUser, filters?: { status?: string; query?: string }) {
  assertInternalApiAccess(user);
  const where: Prisma.FlightWhereInput = {};

  if (filters?.status && filters.status !== "all") {
    where.status = filters.status as Prisma.EnumFlightStatusFilter["equals"];
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
    include: {
      shipments: {
        include: shipmentInclude,
      },
    },
    orderBy: { cargoCutoffTime: "asc" },
  });

  return {
    summary: {
      onTime: flights.filter((item) => item.status === "on_time").length,
      delayed: flights.filter((item) => item.status === "delayed").length,
      departed: flights.filter((item) => item.status === "departed").length,
    },
    flights: flights.map((flight) => {
      const meta = getFlightVisualMeta(flight.flightNumber, flight.aircraftType, flight.imageUrl);
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
        shipments: flight.shipments.map((shipment) => serializeShipment(shipment, user)),
      };
    }),
  };
}

export async function listActivityLogs(user: AccessUser, filters?: { query?: string; action?: string; userId?: string }) {
  assertInternalApiAccess(user);
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
      take: 100,
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
      userName: log.user?.name ?? "System",
      userId: log.userId,
      createdAt: log.createdAt.toISOString(),
    })),
  };
}

export async function getSettingsData(userId: string) {
  const actor = await requireAccessUser(userId);
  const [user, users] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: userId },
      include: { settings: true },
    }),
    actor.role === "admin" || actor.role === "supervisor"
      ? db.user.findMany({
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            station: true,
            status: true,
          },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
  ]);

  return {
    profile: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      station: user.station,
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
    users,
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
        action: "Update Settings",
        targetType: "settings",
        targetLabel: "Display Preferences",
        description: "Pengaturan operator diperbarui.",
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

export async function reportAwbIssue(userId: string, awb: string) {
  const shipment = await db.shipment.findUnique({ where: { awb } });
  await db.activityLog.create({
    data: {
      userId,
      action: "Report Issue",
      targetType: "tracking",
      targetId: shipment?.id,
      targetLabel: awb,
      description: `Operator menandai isu pada AWB ${awb} untuk ditinjau supervisor.`,
      level: "warning",
    },
  });

  return { success: true };
}

export async function searchGlobal(user: AccessUser, query: string) {
  if (AWB_REGEX.test(query)) {
    const shipment = await db.shipment.findUnique({ where: { awb: query } });
    if (shipment) {
      return { path: `/awb-tracking?awb=${shipment.awb}`, label: shipment.awb, kind: "AWB" };
    }
  }

  if (user.role === "customer") {
    return null;
  }

  const flight = await db.flight.findFirst({
    where: { flightNumber: { contains: query } },
  });
  if (flight) {
    return { path: `/flight-board?query=${flight.flightNumber}`, label: flight.flightNumber, kind: "Flight" };
  }

  const shipment = await db.shipment.findFirst({
    where: {
      OR: [{ awb: { contains: query } }, { commodity: { contains: query } }],
    },
  });
  if (shipment) {
    return { path: `/shipment-ledger?query=${shipment.awb}`, label: shipment.awb, kind: "Shipment" };
  }

  return null;
}
