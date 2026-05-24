import { Prisma, ShipmentDocStatus, ShipmentReadiness, ShipmentStatus, ShipmentTransactionStatus } from "@prisma/client";
import { addMinutes, endOfDay, startOfDay } from "date-fns";
import {
  AccessError,
  CAPABILITIES,
  type Capability,
  canDeleteShipments,
  canExportReports,
  canManageCustomerAccounts,
  canManageFlights,
  canManageShipmentDocuments,
  canManageShipments,
  canManageUsers,
  canVerifyPayments,
  getDefaultCapabilitiesForRole,
  hasCapability,
  isInternalRole,
  scopeAwbWhere,
  scopeCustomerAccountWhere,
  scopeFlightWhere,
  scopeShipmentWhere,
  type AccessUser,
} from "./access";
import {
  AWB_REGEX,
  FLIGHT_STATUS_LABELS,
  ROLE_LABELS,
  SHIPMENT_DOC_STATUS_LABELS,
  SHIPMENT_READINESS_LABELS,
  SHIPMENT_STATUS_LABELS,
  SHIPMENT_TRANSACTION_STATUS_LABELS,
} from "./constants";
import { getCargoCutoffTime, getEstimatedArrivalTime, getGateForDestination } from "./flight-rules";
import {
  getFlightVisualMeta,
  getShipmentPriorityScore,
  isAllowedFlightNumber,
  normalizeFlightNumber,
} from "./flight-meta";
import { db } from "./prisma";
import { deleteDocumentBlob, getDocumentAccessUrl } from "./storage";

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
  visibility: string;
  actorUserId: string | null;
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
    docStatus: SHIPMENT_DOC_STATUS_LABELS[shipment.docStatus],
    count: activeDocuments.length,
    latestUploadedAt: latestDocument?.createdAt.toISOString() ?? null,
  };
}

function deriveShipmentTransactionStatus(input: {
  shippingRate: number;
  documents: { deletedAt: Date | null; paymentProof?: boolean | null; paymentVerifiedAt?: Date | null }[];
}) {
  if (input.shippingRate <= 0) {
    return ShipmentTransactionStatus.Tidak_Ditagih;
  }

  const activePaymentDocuments = input.documents.filter((document) => !document.deletedAt && document.paymentProof);
  if (activePaymentDocuments.some((document) => document.paymentVerifiedAt)) {
    return ShipmentTransactionStatus.Lunas;
  }

  if (activePaymentDocuments.length > 0) {
    return ShipmentTransactionStatus.Menunggu_Verifikasi;
  }

  return ShipmentTransactionStatus.Belum_Lunas;
}

function deriveShipmentGoodsStatus(status: ShipmentStatus) {
  if (status === "hold") return "Pending";
  if (status === "arrived") return "Sampai Tujuan";
  if (status === "loaded_to_aircraft" || status === "departed") return "Dalam Pengiriman";
  return "Diproses";
}

function deriveShipmentDocStatus(documents: { deletedAt: Date | null; paymentProof?: boolean | null; paymentVerifiedAt?: Date | null }[]) {
  const activeDocuments = documents.filter((document) => !document.deletedAt);
  if (activeDocuments.length === 0) return ShipmentDocStatus.Partial;
  if (activeDocuments.some((document) => document.paymentProof && !document.paymentVerifiedAt)) return ShipmentDocStatus.Review;
  return ShipmentDocStatus.Complete;
}

function deriveShipmentReadiness(input: {
  status: ShipmentStatus;
  docStatus: ShipmentDocStatus;
  transactionStatus: ShipmentTransactionStatus;
}) {
  if (input.status === "hold") return ShipmentReadiness.Pending;
  if (input.docStatus !== ShipmentDocStatus.Complete) return ShipmentReadiness.Pending;
  if (
    input.transactionStatus === ShipmentTransactionStatus.Belum_Lunas ||
    input.transactionStatus === ShipmentTransactionStatus.Menunggu_Verifikasi
  ) {
    return ShipmentReadiness.Pending;
  }
  return ShipmentReadiness.Ready;
}

function deriveShipmentGuardFields(input: {
  status: ShipmentStatus;
  shippingRate: number;
  documents: { deletedAt: Date | null; paymentProof?: boolean | null; paymentVerifiedAt?: Date | null }[];
}) {
  const transactionStatus = deriveShipmentTransactionStatus(input);
  const docStatus = deriveShipmentDocStatus(input.documents);
  const goodsStatus = deriveShipmentGoodsStatus(input.status);
  const readiness = deriveShipmentReadiness({
    status: input.status,
    docStatus,
    transactionStatus,
  });

  return {
    transactionStatus,
    docStatus,
    goodsStatus,
    readiness,
  };
}

function serializeShipment(shipment: ShipmentRecord, user: AccessUser) {
  const visibleTrackingLogs =
    user.role === "customer" ? shipment.trackingLogs.filter((log) => log.visibility === "customer") : shipment.trackingLogs;
  const latestTrackingTimestamp = visibleTrackingLogs.reduce<Date | null>((latest, log) => {
    if (!latest || log.createdAt.getTime() > latest.getTime()) {
      return log.createdAt;
    }
    return latest;
  }, null);

  const documentSummary = getDocumentSummary(shipment);
  const isCustomer = user.role === "customer";
  const guardFields = deriveShipmentGuardFields({
    status: shipment.status,
    shippingRate: shipment.shippingRate,
    documents: shipment.documents,
  });

  return {
    id: shipment.id,
    awb: shipment.awb,
    sentAt: shipment.sentAt.toISOString(),
    commodity: shipment.commodity,
    cargoMode: shipment.cargoMode,
    senderPhone: shipment.senderPhone,
    origin: shipment.origin,
    destination: shipment.destination,
    pieces: shipment.pieces,
    weightKg: shipment.weightKg,
    volumeM3: shipment.volumeM3,
    specialHandling: shipment.specialHandling,
    serviceType: shipment.serviceType,
    shippingRate: shipment.shippingRate,
    vehicleName: shipment.vehicleName,
    vehicleType: shipment.vehicleType,
    vehicleCode: shipment.vehicleCode,
    vehicleCapacityKg: shipment.vehicleCapacityKg,
    vehicleStatus: shipment.vehicleStatus,
    goodsStatus: guardFields.goodsStatus,
    transactionStatus: SHIPMENT_TRANSACTION_STATUS_LABELS[guardFields.transactionStatus],
    docStatus: SHIPMENT_DOC_STATUS_LABELS[guardFields.docStatus],
    readiness: SHIPMENT_READINESS_LABELS[guardFields.readiness],
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
    trackingLogs: visibleTrackingLogs.map(serializeTrackingLog),
    documents: isCustomer
      ? []
      : shipment.documents.map((document) => ({
          id: document.id,
          fileName: document.fileName,
          mimeType: document.mimeType,
          fileSize: document.fileSize,
          storageUrl: getDocumentAccessUrl(document.storageKey, document.storageUrl) ?? document.storageUrl,
          createdAt: document.createdAt.toISOString(),
          blobCleanupStatus: document.blobCleanupStatus,
          paymentProof: document.paymentProof,
          paymentVerifiedAt: document.paymentVerifiedAt?.toISOString() ?? null,
          paymentVerifiedByName: document.paymentVerifiedByName,
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

function parseCargoDate(value?: string | null) {
  if (!value) {
    return new Date();
  }

  return new Date(`${value}T00:00:00.000+07:00`);
}

type FlightBoardShift = "all" | "pagi" | "siang" | "malam";

type FlightDateInterval = {
  start: Date;
  end: Date;
};

type DerivedFlightStatus = "on_time" | "delayed" | "departed";

function formatOpsDate(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Makassar",
    year: "numeric",
  }).formatToParts(value);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

function addOpsDays(dateValue: string, days: number) {
  const date = new Date(`${dateValue}T00:00:00+08:00`);
  date.setUTCDate(date.getUTCDate() + days);
  return formatOpsDate(date);
}

function toOpsDateTime(dateValue: string, timeValue: string) {
  return new Date(`${dateValue}T${timeValue}+08:00`);
}

function getFlightDateIntervals(date?: string, shift: FlightBoardShift = "all"): FlightDateInterval[] | undefined {
  if (!date) return undefined;

  if (shift === "pagi") {
    return [{ start: toOpsDateTime(date, "06:00:00.000"), end: toOpsDateTime(date, "14:00:00.000") }];
  }

  if (shift === "siang") {
    return [{ start: toOpsDateTime(date, "14:00:00.000"), end: toOpsDateTime(date, "22:00:00.000") }];
  }

  if (shift === "malam") {
    return [{ start: toOpsDateTime(date, "22:00:00.000"), end: toOpsDateTime(addOpsDays(date, 1), "06:00:00.000") }];
  }

  return [{ start: toOpsDateTime(date, "00:00:00.000"), end: toOpsDateTime(addOpsDays(date, 1), "00:00:00.000") }];
}

function appendFlightDateFilter(where: Prisma.FlightWhereInput, intervals?: FlightDateInterval[]) {
  if (!intervals?.length) return;

  const filter =
    intervals.length === 1
      ? { departureTime: { gte: intervals[0].start, lt: intervals[0].end } }
      : {
          OR: intervals.map((interval) => ({
            departureTime: { gte: interval.start, lt: interval.end },
          })),
        };

  const existingAnd = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [];
  where.AND = [...existingAnd, filter];
}

function deriveFlightStatus(input: { departureTime: Date; arrivalTime: Date }, now = new Date()): DerivedFlightStatus {
  if (now >= input.arrivalTime) {
    return "departed";
  }

  if (now >= input.departureTime) {
    return "delayed";
  }

  return "on_time";
}

function assertFlightScheduleOrder(input: { cargoCutoffTime: Date; departureTime: Date; arrivalTime: Date }) {
  if (input.cargoCutoffTime.getTime() > input.departureTime.getTime()) {
    throw new AccessError(
      "Cargo cutoff harus sebelum atau sama dengan waktu berangkat.",
      400,
      "INVALID_FLIGHT_SCHEDULE",
    );
  }

  if (input.departureTime.getTime() > input.arrivalTime.getTime()) {
    throw new AccessError("Waktu tiba harus setelah atau sama dengan waktu berangkat.", 400, "INVALID_FLIGHT_SCHEDULE");
  }
}

async function getActorWithRelations(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      settings: true,
      capabilityOverrides: {
        select: {
          capability: true,
          enabled: true,
        },
      },
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

function ensureShipmentCapability(user: AccessUser, capability: "shipment:create" | "shipment:update" | "shipment:delete" | "shipment:document") {
  if (!hasCapability(user, capability)) {
    throw new AccessError("Akses shipment tidak cukup untuk aksi ini.", 403, "SHIPMENT_CAPABILITY_REQUIRED");
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
  capabilityOverrides?: { capability: string; enabled: boolean }[];
  customerAccount: { id: string; name: string; status: "active" | "disabled" } | null;
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
    capabilities: CAPABILITIES.filter((capability) => hasCapability(user, capability)),
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
      take: 10,
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

const DASHBOARD_SHIPMENT_LIMIT = 120;
const ALERT_LOOKBACK_LIMIT = 120;
const ACTIVE_STALE_STATUSES = new Set<ShipmentStatus>([
  ShipmentStatus.received,
  ShipmentStatus.sortation,
  ShipmentStatus.loaded_to_aircraft,
]);
const FLIGHT_READY_SHIPMENT_STATUSES = new Set<ShipmentStatus>([
  ShipmentStatus.loaded_to_aircraft,
  ShipmentStatus.departed,
  ShipmentStatus.arrived,
]);

type AlertSeverity = "critical" | "warning" | "info";

function getAlertAgeMinutes(from: Date, now: Date) {
  return Math.max(0, Math.round((now.getTime() - from.getTime()) / 60000));
}

function getAlertPriority(severity: AlertSeverity) {
  if (severity === "critical") return 0;
  if (severity === "warning") return 1;
  return 2;
}

function getAlertTone(severity: AlertSeverity) {
  if (severity === "critical") return "error";
  if (severity === "warning") return "warning";
  return "info";
}

function getAlertResolutionMeta(kind: string) {
  const fallback = {
    cause: "Kondisi operasional melewati aturan pantau sistem.",
    clearCondition: "Alert hilang otomatis saat data sumber kembali normal.",
    targetModule: "Modul terkait",
  };

  const meta: Record<string, typeof fallback> = {
    "shipment-hold": {
      cause: "Shipment masih berstatus hold.",
      clearCondition: "Ubah status shipment dari hold setelah alasan hold selesai.",
      targetModule: "Ledger Shipment",
    },
    "document-gate": {
      cause: "Dokumen belum complete atau masih perlu review.",
      clearCondition: "Upload dokumen pendukung sampai status dokumen otomatis complete.",
      targetModule: "Dokumen Shipment",
    },
    "readiness-gate": {
      cause: "Kesiapan shipment masih pending.",
      clearCondition: "Selesaikan dokumen, pembayaran, assignment, atau hold sampai readiness otomatis ready.",
      targetModule: "Review Operasional",
    },
    "stale-update": {
      cause: "Status aktif tidak berubah lebih dari 6 jam.",
      clearCondition: "Tambahkan update status atau checkpoint terbaru pada shipment.",
      targetModule: "Tracking Shipment",
    },
    "unassigned-flight": {
      cause: "Shipment aktif belum terhubung ke flight.",
      clearCondition: "Pilih flight pada shipment atau pindahkan ke hold bila belum siap.",
      targetModule: "Ledger Shipment",
    },
    "flight-delay": {
      cause: "Flight terdeteksi delayed dari aturan waktu penerbangan.",
      clearCondition: "Perbarui jadwal flight sampai status otomatis kembali tepat waktu atau berangkat.",
      targetModule: "Papan Flight",
    },
    "cutoff-risk": {
      cause: "Cutoff flight dekat atau sudah lewat saat masih ada shipment belum clear.",
      clearCondition: "Clear pending shipment, pindahkan shipment, atau tutup manifest.",
      targetModule: "Papan Flight",
    },
    "capacity-risk": {
      cause: "Total berat manifest mendekati atau melewati kapasitas aircraft.",
      clearCondition: "Kurangi load, pindahkan shipment berat, atau pakai aircraft/flight lain.",
      targetModule: "Manifest Flight",
    },
  };

  return meta[kind] ?? fallback;
}

function createShipmentAlert(input: {
  shipment: ShipmentRecord;
  now: Date;
  kind: string;
  title: string;
  detail: string;
  severity: AlertSeverity;
  recommendation: string;
  triggeredAt?: Date;
}) {
  const triggeredAt = input.triggeredAt ?? input.shipment.updatedAt;
  const resolutionMeta = getAlertResolutionMeta(input.kind);

  return {
    id: `${input.kind}-${input.shipment.id}`,
    kind: input.kind,
    title: input.title,
    detail: input.detail,
    severity: input.severity,
    tone: getAlertTone(input.severity),
    entityType: "shipment",
    entityLabel: input.shipment.awb,
    href: `/shipment-ledger?query=${input.shipment.awb}`,
    route: serializeRoute(input.shipment.origin, input.shipment.destination),
    station: input.shipment.origin,
    ownerName: input.shipment.ownerName,
    statusLabel: SHIPMENT_STATUS_LABELS[input.shipment.status],
    recommendedAction: input.recommendation,
    cause: resolutionMeta.cause,
    clearCondition: resolutionMeta.clearCondition,
    targetModule: resolutionMeta.targetModule,
    triggeredAt: triggeredAt.toISOString(),
    ageMinutes: getAlertAgeMinutes(triggeredAt, input.now),
  };
}

function buildConditionCheck(input: {
  id: string;
  label: string;
  count: number;
  threshold: number;
  normalCopy: string;
  actionCopy: string;
  mechanism: string;
}) {
  return {
    id: input.id,
    label: input.label,
    count: input.count,
    status: input.count > input.threshold ? "action" : "normal",
    statusLabel: input.count > input.threshold ? "Butuh tindakan" : "Normal",
    detail: input.count > input.threshold ? input.actionCopy : input.normalCopy,
    mechanism: input.mechanism,
  };
}

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
    take: DASHBOARD_SHIPMENT_LIMIT,
  });

  if (todayShipments.length >= DASHBOARD_SHIPMENT_LIMIT) {
    return { now, shipmentsToday: todayShipments };
  }

  if (todayShipments.length) {
    const contextualShipments = await db.shipment.findMany({
      where: {
        ...scopedShipments,
        id: {
          notIn: todayShipments.map((shipment) => shipment.id),
        },
      },
      include: shipmentInclude,
      orderBy: [{ receivedAt: "desc" }],
      take: DASHBOARD_SHIPMENT_LIMIT - todayShipments.length,
    });

    return { now, shipmentsToday: [...todayShipments, ...contextualShipments] };
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
    take: DASHBOARD_SHIPMENT_LIMIT,
  });

  return { now, shipmentsToday: fallbackShipments };
}

async function getInternalMetricsSnapshot(scopedShipments: Prisma.ShipmentWhereInput): Promise<InternalMetricsSnapshot> {
  const [{ now, shipmentsToday }, flightsToday] = await Promise.all([
    getShipmentsWithDateFallback(scopedShipments),
    db.flight.findMany({
      where: scopeFlightWhere(),
      orderBy: { cargoCutoffTime: "asc" },
      take: 48,
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

export async function getAlertCenterData(user: AccessUser) {
  if (!isInternalRole(user.role)) {
    throw new AccessError("Alert center hanya untuk pengguna internal.", 403, "INTERNAL_ROUTE_ONLY");
  }

  const now = new Date();
  const staleBefore = new Date(now.getTime() - 6 * 60 * 60 * 1000);
  const scopedShipments = scopeShipmentWhere(user);

  const [shipments, unassignedShipments, flights, notificationCount] = await Promise.all([
    db.shipment.findMany({
      where: {
        ...scopedShipments,
        OR: [
          { status: ShipmentStatus.hold },
          { docStatus: { not: "Complete" } },
          { readiness: { not: "Ready" } },
          {
            status: { in: [ShipmentStatus.received, ShipmentStatus.sortation, ShipmentStatus.loaded_to_aircraft] },
            updatedAt: { lt: staleBefore },
          },
        ],
      },
      include: shipmentInclude,
      orderBy: [{ updatedAt: "desc" }],
      take: ALERT_LOOKBACK_LIMIT,
    }),
    db.shipment.findMany({
      where: {
        ...scopedShipments,
        flightId: null,
        status: { in: [ShipmentStatus.received, ShipmentStatus.sortation, ShipmentStatus.loaded_to_aircraft, ShipmentStatus.hold] },
      },
      include: shipmentInclude,
      orderBy: [{ updatedAt: "desc" }],
      take: 30,
    }),
    db.flight.findMany({
      where: scopeFlightWhere(),
      include: {
        aircraft: {
          select: {
            capacityKg: true,
            registration: true,
          },
        },
        shipments: {
          where: { archivedAt: null },
          select: {
            id: true,
            awb: true,
            status: true,
            docStatus: true,
            readiness: true,
            weightKg: true,
          },
        },
      },
      orderBy: { cargoCutoffTime: "asc" },
      take: ALERT_LOOKBACK_LIMIT,
    }),
    db.notification.count({
      where: {
        userId: user.id,
        read: false,
      },
    }),
  ]);

  const alerts: Array<ReturnType<typeof createShipmentAlert>> = [];

  for (const shipment of shipments) {
    if (shipment.status === ShipmentStatus.hold) {
      const ageMinutes = getAlertAgeMinutes(shipment.updatedAt, now);
      alerts.push(
        createShipmentAlert({
          shipment,
          now,
          kind: "shipment-hold",
          title: "Shipment tertahan",
          detail: `AWB ${shipment.awb} masih hold di rute ${serializeRoute(shipment.origin, shipment.destination)}.`,
          severity: ageMinutes >= 240 ? "critical" : "warning",
          recommendation: "Tentukan alasan hold, PIC review, dan batas waktu release sebelum manifest ditutup.",
        }),
      );
    }

    if (shipment.docStatus.toLowerCase() !== "complete") {
      alerts.push(
        createShipmentAlert({
          shipment,
          now,
          kind: "document-gate",
          title: "Dokumen belum lengkap",
          detail: `Dokumen AWB ${shipment.awb} berstatus ${shipment.docStatus}; shipment belum aman untuk proses akhir.`,
          severity: shipment.status === ShipmentStatus.loaded_to_aircraft ? "critical" : "warning",
          recommendation: "Minta dokumen pendukung, tandai hasil review, lalu ubah readiness setelah valid.",
        }),
      );
    }

    if (shipment.readiness.toLowerCase() !== "ready") {
      alerts.push(
        createShipmentAlert({
          shipment,
          now,
          kind: "readiness-gate",
          title: "Readiness pending",
          detail: `Readiness AWB ${shipment.awb} masih ${shipment.readiness}; shipment perlu clearance operasional.`,
          severity: "warning",
          recommendation: "Cek label, dokumen, special handling, dan assignment flight sebelum muat.",
        }),
      );
    }

    if (
      ACTIVE_STALE_STATUSES.has(shipment.status) &&
      shipment.updatedAt < staleBefore
    ) {
      alerts.push(
        createShipmentAlert({
          shipment,
          now,
          kind: "stale-update",
          title: "Update terlalu lama",
          detail: `AWB ${shipment.awb} belum bergerak lebih dari 6 jam pada status ${SHIPMENT_STATUS_LABELS[shipment.status]}.`,
          severity: "info",
          recommendation: "Minta scan checkpoint terbaru atau tandai alasan keterlambatan di catatan shipment.",
        }),
      );
    }
  }

  for (const shipment of unassignedShipments) {
    alerts.push(
      createShipmentAlert({
        shipment,
        now,
        kind: "unassigned-flight",
        title: "Belum masuk flight",
        detail: `AWB ${shipment.awb} belum punya assignment flight meski masih aktif di gudang.`,
        severity: shipment.status === ShipmentStatus.hold ? "warning" : "info",
        recommendation: "Pasangkan ke flight tersedia atau pindahkan ke hold dengan alasan operasional yang jelas.",
      }),
    );
  }

  for (const flight of flights) {
    const meta = getFlightVisualMeta(flight.flightNumber, flight.aircraftType);
    const route = serializeRoute(flight.origin, flight.destination);
    const pendingShipments = flight.shipments.filter(
      (shipment) =>
        !FLIGHT_READY_SHIPMENT_STATUSES.has(shipment.status) ||
        shipment.docStatus.toLowerCase() !== "complete" ||
        shipment.readiness.toLowerCase() !== "ready",
    );
    const minutesToCutoff = Math.round((flight.cargoCutoffTime.getTime() - now.getTime()) / 60000);
    const activeWeight = flight.shipments.reduce((sum, shipment) => sum + shipment.weightKg, 0);
    const capacityKg = flight.aircraft?.capacityKg ?? null;
    const loadRatio = capacityKg ? activeWeight / capacityKg : 0;
    const triggeredAt = flight.updatedAt;

    if (flight.status === "delayed") {
      const resolutionMeta = getAlertResolutionMeta("flight-delay");
      alerts.push({
        id: `flight-delay-${flight.id}`,
        kind: "flight-delay",
        title: "Flight terlambat",
        detail: `${flight.flightNumber} ${route} terlambat; manifest perlu sinkron dengan slot baru.`,
        severity: "warning",
        tone: "warning",
        entityType: "flight",
        entityLabel: flight.flightNumber,
        href: `/flight-board?query=${flight.flightNumber}`,
        route,
        station: flight.origin,
        ownerName: meta.airlineName,
        statusLabel: FLIGHT_STATUS_LABELS[flight.status],
        recommendedAction: "Broadcast perubahan slot, cek ulang cutoff, dan prioritaskan shipment time-sensitive.",
        cause: resolutionMeta.cause,
        clearCondition: resolutionMeta.clearCondition,
        targetModule: resolutionMeta.targetModule,
        triggeredAt: triggeredAt.toISOString(),
        ageMinutes: getAlertAgeMinutes(triggeredAt, now),
      });
    }

    if (flight.status !== "departed" && pendingShipments.length && minutesToCutoff <= 120) {
      const resolutionMeta = getAlertResolutionMeta("cutoff-risk");
      alerts.push({
        id: `cutoff-risk-${flight.id}`,
        kind: "cutoff-risk",
        title: minutesToCutoff < 0 ? "Cutoff terlewat" : "Cutoff mendekat",
        detail: `${flight.flightNumber} punya ${pendingShipments.length} shipment belum clear menjelang cutoff.`,
        severity: minutesToCutoff < 0 ? "critical" : "warning",
        tone: minutesToCutoff < 0 ? "error" : "warning",
        entityType: "flight",
        entityLabel: flight.flightNumber,
        href: `/flight-board?query=${flight.flightNumber}`,
        route,
        station: flight.origin,
        ownerName: meta.airlineName,
        statusLabel: FLIGHT_STATUS_LABELS[flight.status],
        recommendedAction: "Tutup manifest parsial, eskalasi shipment pending, atau pindahkan ke flight berikutnya.",
        cause: resolutionMeta.cause,
        clearCondition: resolutionMeta.clearCondition,
        targetModule: resolutionMeta.targetModule,
        triggeredAt: flight.cargoCutoffTime.toISOString(),
        ageMinutes: Math.abs(minutesToCutoff),
      });
    }

    if (capacityKg && loadRatio >= 0.92) {
      const resolutionMeta = getAlertResolutionMeta("capacity-risk");
      alerts.push({
        id: `capacity-risk-${flight.id}`,
        kind: "capacity-risk",
        title: loadRatio > 1 ? "Kapasitas terlampaui" : "Kapasitas hampir penuh",
        detail: `${flight.flightNumber} membawa ${Math.round(activeWeight).toLocaleString("id-ID")} kg dari kapasitas ${capacityKg.toLocaleString("id-ID")} kg.`,
        severity: loadRatio > 1 ? "critical" : "warning",
        tone: loadRatio > 1 ? "error" : "warning",
        entityType: "flight",
        entityLabel: flight.flightNumber,
        href: `/flight-board?query=${flight.flightNumber}`,
        route,
        station: flight.origin,
        ownerName: flight.aircraft?.registration ?? meta.airlineName,
        statusLabel: `${Math.round(loadRatio * 100)}% load`,
        recommendedAction: "Pisahkan shipment berat, cek dimensi aktual, dan siapkan overflow ke flight cadangan.",
        cause: resolutionMeta.cause,
        clearCondition: resolutionMeta.clearCondition,
        targetModule: resolutionMeta.targetModule,
        triggeredAt: triggeredAt.toISOString(),
        ageMinutes: getAlertAgeMinutes(triggeredAt, now),
      });
    }
  }

  const sortedAlerts = alerts
    .sort((left, right) => {
      const severityDiff = getAlertPriority(left.severity) - getAlertPriority(right.severity);
      if (severityDiff) return severityDiff;
      return new Date(right.triggeredAt).getTime() - new Date(left.triggeredAt).getTime();
    })
    .slice(0, ALERT_LOOKBACK_LIMIT);

  const counts = sortedAlerts.reduce(
    (current, alert) => ({
      ...current,
      [alert.severity]: current[alert.severity] + 1,
    }),
    { critical: 0, warning: 0, info: 0 } as Record<AlertSeverity, number>,
  );

  const holdCount = shipments.filter((shipment) => shipment.status === ShipmentStatus.hold).length;
  const docIssueCount = shipments.filter((shipment) => shipment.docStatus.toLowerCase() !== "complete").length;
  const readinessIssueCount = shipments.filter((shipment) => shipment.readiness.toLowerCase() !== "ready").length;
  const cutoffRiskCount = sortedAlerts.filter((alert) => alert.kind === "cutoff-risk").length;
  const capacityRiskCount = sortedAlerts.filter((alert) => alert.kind === "capacity-risk").length;
  const staleUpdateCount = sortedAlerts.filter((alert) => alert.kind === "stale-update").length;

  return {
    generatedAt: now.toISOString(),
    summary: {
      total: sortedAlerts.length,
      critical: counts.critical,
      warning: counts.warning,
      info: counts.info,
      unreadNotifications: notificationCount,
    },
    alerts: sortedAlerts,
    conditionChecks: [
      buildConditionCheck({
        id: "hold-sla",
        label: "Hold dan SLA release",
        count: holdCount,
        threshold: 0,
        normalCopy: "Tidak ada hold aktif pada cakupan data terbaru.",
        actionCopy: `${holdCount} shipment masih hold dan perlu keputusan release atau eskalasi.`,
        mechanism: "Butuh timer SLA hold, alasan hold wajib, dan owner eskalasi per station.",
      }),
      buildConditionCheck({
        id: "document-gate",
        label: "Gerbang dokumen",
        count: docIssueCount,
        threshold: 0,
        normalCopy: "Dokumen utama sudah lengkap untuk shipment yang dipantau.",
        actionCopy: `${docIssueCount} shipment masih punya dokumen incomplete atau review.`,
        mechanism: "Butuh document gate sebelum status loaded_to_aircraft dapat dipakai.",
      }),
      buildConditionCheck({
        id: "readiness",
        label: "Readiness operasional",
        count: readinessIssueCount,
        threshold: 0,
        normalCopy: "Readiness shipment berada di kondisi aman.",
        actionCopy: `${readinessIssueCount} shipment belum ready untuk eksekusi penuh.`,
        mechanism: "Butuh checklist label, special handling, volume, dan flight assignment.",
      }),
      buildConditionCheck({
        id: "cutoff",
        label: "Cutoff flight",
        count: cutoffRiskCount,
        threshold: 0,
        normalCopy: "Tidak ada manifest pending dekat cutoff.",
        actionCopy: `${cutoffRiskCount} flight punya risiko cutoff atau cutoff terlewat.`,
        mechanism: "Butuh countdown cutoff, freeze manifest, dan rencana pindah flight.",
      }),
      buildConditionCheck({
        id: "capacity",
        label: "Kapasitas manifest",
        count: capacityRiskCount,
        threshold: 0,
        normalCopy: "Load factor flight masih dalam batas aman.",
        actionCopy: `${capacityRiskCount} flight hampir penuh atau melewati kapasitas.`,
        mechanism: "Butuh load factor guard berbasis berat aktual dan kapasitas aircraft.",
      }),
      buildConditionCheck({
        id: "freshness",
        label: "Freshness update",
        count: staleUpdateCount,
        threshold: 0,
        normalCopy: "Checkpoint aktif masih segar.",
        actionCopy: `${staleUpdateCount} shipment aktif belum bergerak lebih dari 6 jam.`,
        mechanism: "Butuh scan cadence per area: gudang, sortation, apron, dan terminal tujuan.",
      }),
    ],
    environmentMechanisms: [
      {
        title: "SLA per exception",
        detail: "Hold, dokumen, readiness, dan cutoff punya jam target berbeda agar prioritas tidak hanya berdasarkan urutan data.",
      },
      {
        title: "Gate sebelum muat",
        detail: "Shipment tidak ideal masuk loaded_to_aircraft bila dokumen belum complete atau readiness masih pending.",
      },
      {
        title: "Capacity guard",
        detail: "Manifest perlu membandingkan total berat terhadap kapasitas aircraft untuk menangkap overflow sejak awal.",
      },
      {
        title: "Delay propagation",
        detail: "Flight delayed harus menurunkan ulang cutoff, notifikasi customer, dan prioritas barang time-sensitive.",
      },
      {
        title: "Station escalation",
        detail: "Alert perlu owner, station, dan rekomendasi aksi agar terlihat seperti operasi gudang nyata.",
      },
    ],
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
        take: 60,
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
      actionItems: actionShipments.slice(0, 10).map((shipment) => ({
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
      documentSummary: serializedShipments.slice(0, 10).map((shipment) => ({
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
      { senderPhone: { contains: filters.query } },
      { vehicleCode: { contains: filters.query } },
      { vehicleName: { contains: filters.query } },
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
      canCreate: hasCapability(user, "shipment:create"),
      canEdit: hasCapability(user, "shipment:update"),
      canDelete: canDeleteShipments(user),
      canDocument: canManageShipmentDocuments(user),
      canVerifyPayment: canVerifyPayments(user),
      canExport: canExportReports(user),
    },
    shipments: serializedShipments,
    flights,
    customerAccounts,
  };
}

export async function createShipment(input: {
  awb?: string;
  sentAt?: string;
  commodity: string;
  cargoMode: string;
  senderPhone: string;
  origin: string;
  destination: string;
  pieces: number;
  weightKg: number;
  volumeM3?: number | null;
  specialHandling?: string;
  serviceType: string;
  shippingRate: number;
  vehicleName: string;
  vehicleType: string;
  vehicleCode: string;
  vehicleCapacityKg: number;
  vehicleStatus: string;
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

  ensureShipmentCapability(actor, "shipment:create");

  const awb = input.awb && AWB_REGEX.test(input.awb) ? input.awb : await generateUniqueAwb();
  const [customerAccount, flight] = await Promise.all([
    validateCustomerAccount(input.customerAccountId ?? null),
    validateFlight(input.flightId ?? null),
  ]);

  const guardFields = deriveShipmentGuardFields({
    status: "received",
    shippingRate: input.shippingRate,
    documents: [],
  });

  const shipment = await db.$transaction(async (tx) => {
    const created = await tx.shipment.create({
      data: {
        awb,
        sentAt: parseCargoDate(input.sentAt),
        commodity: input.commodity,
        cargoMode: input.cargoMode,
        senderPhone: input.senderPhone,
        origin: input.origin.toUpperCase(),
        destination: input.destination.toUpperCase(),
        pieces: input.pieces,
        weightKg: input.weightKg,
        volumeM3: input.volumeM3 ?? null,
        specialHandling: input.specialHandling || "",
        serviceType: input.serviceType,
        shippingRate: input.shippingRate,
        vehicleName: input.vehicleName,
        vehicleType: input.vehicleType,
        vehicleCode: input.vehicleCode.toUpperCase(),
        vehicleCapacityKg: input.vehicleCapacityKg,
        vehicleStatus: input.vehicleStatus,
        goodsStatus: guardFields.goodsStatus,
        transactionStatus: guardFields.transactionStatus,
        docStatus: guardFields.docStatus,
        readiness: guardFields.readiness,
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
            message: `Kargo ${input.cargoMode.toLowerCase()} diterima dan data resi dibuat.`,
            location: "Gudang Operasional",
            actorName: input.actorName,
            visibility: "customer",
            actorUserId: actor.id,
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
    sentAt?: string;
    cargoMode?: string;
    senderPhone?: string;
    commodity?: string;
    origin?: string;
    destination?: string;
    pieces?: number;
    weightKg?: number;
    serviceType?: string;
    shippingRate?: number;
    vehicleName?: string;
    vehicleType?: string;
    vehicleCode?: string;
    vehicleCapacityKg?: number;
    vehicleStatus?: string;
    flightId?: string | null;
    customerAccountId?: string | null;
    userId: string;
    actorName: string;
  },
) {
  const actor = await getActorWithRelations(input.userId);
  if (!actor) {
    throw new AccessError("Sesi tidak valid.", 401, "UNAUTHENTICATED");
  }

  ensureShipmentCapability(actor, "shipment:update");

  const current = await getShipmentRecordForMutation(shipmentId);
  if (current.archivedAt) {
    throw new AccessError("Shipment sudah diarsipkan.", 400, "SHIPMENT_ARCHIVED");
  }

  const [customerAccount, flight] = await Promise.all([
    input.customerAccountId !== undefined ? validateCustomerAccount(input.customerAccountId) : Promise.resolve(null),
    input.flightId !== undefined ? validateFlight(input.flightId) : Promise.resolve(null),
  ]);

  const nextStatus = input.status ?? current.status;
  const nextShippingRate = input.shippingRate ?? current.shippingRate;
  const nextGuardFields = deriveShipmentGuardFields({
    status: nextStatus,
    shippingRate: nextShippingRate,
    documents: current.documents,
  });
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
        sentAt: input.sentAt ? parseCargoDate(input.sentAt) : current.sentAt,
        cargoMode: input.cargoMode ?? current.cargoMode,
        senderPhone: input.senderPhone ?? current.senderPhone,
        commodity: input.commodity ?? current.commodity,
        origin: input.origin ? input.origin.toUpperCase() : current.origin,
        destination: input.destination ? input.destination.toUpperCase() : current.destination,
        pieces: input.pieces ?? current.pieces,
        weightKg: input.weightKg ?? current.weightKg,
        serviceType: input.serviceType ?? current.serviceType,
        shippingRate: nextShippingRate,
        vehicleName: input.vehicleName ?? current.vehicleName,
        vehicleType: input.vehicleType ?? current.vehicleType,
        vehicleCode: input.vehicleCode ? input.vehicleCode.toUpperCase() : current.vehicleCode,
        vehicleCapacityKg: input.vehicleCapacityKg ?? current.vehicleCapacityKg,
        vehicleStatus: input.vehicleStatus ?? current.vehicleStatus,
        goodsStatus: nextGuardFields.goodsStatus,
        transactionStatus: nextGuardFields.transactionStatus,
        flightId: nextFlightId,
        customerAccountId: nextCustomerAccountId,
        docStatus: nextGuardFields.docStatus,
        readiness: nextGuardFields.readiness,
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
          visibility: "customer",
          actorUserId: actor.id,
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

  ensureShipmentCapability(actor, "shipment:delete");

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

export async function deleteShipment(shipmentId: string, userId: string) {
  const actor = await getActorWithRelations(userId);
  if (!actor) {
    throw new AccessError("Sesi tidak valid.", 401, "UNAUTHENTICATED");
  }

  ensureShipmentCapability(actor, "shipment:delete");

  const current = await db.shipment.findUnique({
    where: { id: shipmentId },
    select: { id: true, awb: true },
  });

  if (!current) {
    throw new AccessError("Shipment tidak ditemukan.", 404, "SHIPMENT_NOT_FOUND");
  }

  await db.$transaction(async (tx) => {
    await tx.shipment.delete({
      where: { id: shipmentId },
    });

    await tx.activityLog.create({
      data: {
        userId: actor.id,
        action: "Hapus Shipment",
        targetType: "shipment",
        targetId: shipmentId,
        targetLabel: current.awb,
        description: `Shipment ${current.awb} dihapus dari database.`,
        level: "warning",
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

  ensureShipmentCapability(actor, "shipment:document");
  const shipment = await getShipmentRecordForMutation(input.shipmentId);
  if (shipment.archivedAt) {
    throw new AccessError("Shipment sudah diarsipkan.", 400, "SHIPMENT_ARCHIVED");
  }

  const document = await db.$transaction(async (tx) => {
    const created = await tx.shipmentDocument.create({
      data: {
        shipmentId: input.shipmentId,
        fileName: input.fileName,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
        storageUrl: input.storageUrl,
        storageKey: input.storageKey,
      },
    });

    const nextDocuments = [
      ...shipment.documents,
      {
        deletedAt: null,
        paymentProof: false,
        paymentVerifiedAt: created.paymentVerifiedAt,
      },
    ];
    const nextGuardFields = deriveShipmentGuardFields({
      status: shipment.status,
      shippingRate: shipment.shippingRate,
      documents: nextDocuments,
    });

    await tx.shipment.update({
      where: { id: input.shipmentId },
      data: nextGuardFields,
    });

    await tx.activityLog.create({
      data: {
        userId: actor.id,
        action: "Unggah Dokumen",
        targetType: "document",
        targetId: input.shipmentId,
        targetLabel: input.fileName,
        description: `${input.fileName} diunggah dan tersimpan di database untuk shipment ${shipment.awb}.`,
        level: "success",
      },
    });

    return created;
  });

  return {
    id: document.id,
    fileName: document.fileName,
    mimeType: document.mimeType,
    fileSize: document.fileSize,
    storageUrl: getDocumentAccessUrl(document.storageKey, document.storageUrl) ?? document.storageUrl,
    createdAt: document.createdAt.toISOString(),
    paymentProof: document.paymentProof,
    paymentVerifiedAt: document.paymentVerifiedAt?.toISOString() ?? null,
    paymentVerifiedByName: document.paymentVerifiedByName,
  };
}

export async function verifyShipmentPaymentDocument(input: {
  shipmentId: string;
  documentId: string;
  userId: string;
  actorName: string;
}) {
  const actor = await getActorWithRelations(input.userId);
  if (!actor) {
    throw new AccessError("Sesi tidak valid.", 401, "UNAUTHENTICATED");
  }

  if (!canVerifyPayments(actor)) {
    throw new AccessError("Hanya admin yang boleh verifikasi pembayaran.", 403, "PAYMENT_VERIFICATION_FORBIDDEN");
  }

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
        include: shipmentInclude,
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
        paymentProof: true,
        paymentVerifiedAt: new Date(),
        paymentVerifiedById: actor.id,
        paymentVerifiedByName: input.actorName,
      },
    });

    const nextDocuments = document.shipment.documents.map((item) =>
      item.id === document.id
        ? {
            ...item,
            paymentProof: true,
            paymentVerifiedAt: new Date(),
          }
        : item,
    );

    await tx.shipment.update({
      where: { id: input.shipmentId },
      data: {
        ...deriveShipmentGuardFields({
          status: document.shipment.status,
          shippingRate: document.shipment.shippingRate,
          documents: nextDocuments,
        }),
      },
    });

    await tx.activityLog.create({
      data: {
        userId: actor.id,
        action: "Verifikasi Pembayaran",
        targetType: "shipment",
        targetId: input.shipmentId,
        targetLabel: document.shipment.awb,
        description: `Pembayaran shipment ${document.shipment.awb} diverifikasi dari dokumen ${document.fileName}.`,
        level: "success",
      },
    });
  });

  const full = await getShipmentRecordForMutation(input.shipmentId);
  return serializeShipment(full, actor);
}

export async function getShipmentDocumentDownload(user: AccessUser, fileName: string) {
  if (user.role === "customer") {
    throw new AccessError("Dokumen tidak ditemukan.", 404, "DOCUMENT_NOT_FOUND");
  }

  const document = await db.shipmentDocument.findFirst({
    where: {
      deletedAt: null,
      shipment: {
        archivedAt: null,
      },
      OR: [{ storageKey: fileName }, { storageKey: { endsWith: `/${fileName}` } }, { storageUrl: { endsWith: `/${fileName}` } }],
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

export async function deleteShipmentDocument(input: {
  shipmentId: string;
  documentId: string;
  userId: string;
}) {
  const actor = await getActorWithRelations(input.userId);
  if (!actor) {
    throw new AccessError("Sesi tidak valid.", 401, "UNAUTHENTICATED");
  }

  ensureShipmentCapability(actor, "shipment:document");

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
          status: true,
          shippingRate: true,
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

    const nextDocuments = await tx.shipmentDocument.findMany({
      where: {
        shipmentId: input.shipmentId,
      },
      select: {
        deletedAt: true,
        paymentProof: true,
        paymentVerifiedAt: true,
      },
    });

    await tx.shipment.update({
      where: { id: input.shipmentId },
      data: {
        ...deriveShipmentGuardFields({
          status: document.shipment.status,
          shippingRate: document.shipment.shippingRate,
          documents: nextDocuments,
        }),
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
      skip: 10,
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
    take: 10,
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
            status: true,
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
    name?: string;
    email?: string;
    role?: "admin" | "staff" | "customer";
    status?: "active" | "invited" | "disabled";
    station?: string;
    customerAccountId?: string | null;
    capabilities?: Capability[];
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

  if (current.id === actor.id && input.capabilities && !input.capabilities.includes("users:manage")) {
    throw new AccessError("Akun yang sedang dipakai harus tetap punya izin kelola user.", 400, "SELF_ACCESS_LOCKOUT");
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
        name: input.name,
        email: input.email,
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
            status: true,
          },
        },
        capabilityOverrides: {
          select: {
            capability: true,
            enabled: true,
          },
        },
      },
    });

    if (input.capabilities) {
      await tx.userCapabilityOverride.deleteMany({
        where: { userId },
      });
      const selectedCapabilities = new Set(input.capabilities);
      const defaultCapabilities = new Set(getDefaultCapabilitiesForRole(nextRole));
      const overrides = CAPABILITIES.flatMap((capability) => {
        const enabled = selectedCapabilities.has(capability);
        return defaultCapabilities.has(capability) === enabled ? [] : [{ userId, capability, enabled }];
      });
      if (overrides.length) {
        await tx.userCapabilityOverride.createMany({ data: overrides });
      }
      updated.capabilityOverrides = overrides;
    }

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

export async function getFlightBoardData(
  user: AccessUser,
  filters?: { status?: string; query?: string; date?: string; shift?: FlightBoardShift; page?: number; pageSize?: number },
) {
  if (!isInternalRole(user.role)) {
    throw new AccessError("Halaman flight hanya untuk pengguna internal.", 403, "INTERNAL_ROUTE_ONLY");
  }

  const where: Prisma.FlightWhereInput = scopeFlightWhere();

  if (filters?.query) {
    where.OR = [
      { flightNumber: { contains: filters.query } },
      { origin: { contains: filters.query.toUpperCase() } },
      { destination: { contains: filters.query.toUpperCase() } },
    ];
  }

  appendFlightDateFilter(where, getFlightDateIntervals(filters?.date, filters?.shift));

  const requestedPageSize = filters?.pageSize ?? 10;
  const pageSize = Math.min(Math.max(requestedPageSize, 1), 50);
  const now = new Date();

  const flights = await db.flight.findMany({
    where,
    include: flightBoardInclude,
    orderBy: { cargoCutoffTime: "asc" },
  });

  const serializedFlights = flights.map((flight) => {
    const meta = getFlightVisualMeta(flight.flightNumber, flight.aircraftType);
    const status = deriveFlightStatus(flight, now);

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
      status,
      statusLabel: FLIGHT_STATUS_LABELS[status],
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
  });

  const filteredFlights =
    filters?.status && filters.status !== "all"
      ? serializedFlights.filter((flight) => flight.status === filters.status)
      : serializedFlights;

  const summary = filteredFlights.reduce(
    (current, flight) => ({
      ...current,
      [flight.status]: current[flight.status] + 1,
    }),
    { on_time: 0, delayed: 0, departed: 0 },
  );

  const totalItems = filteredFlights.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const page = Math.min(Math.max(filters?.page ?? 1, 1), totalPages);
  const paginatedFlights = filteredFlights.slice((page - 1) * pageSize, page * pageSize);

  return {
    permissions: {
      canManageFlights: canManageFlights(user),
      canExport: canExportReports(user),
    },
    summary: {
      onTime: summary.on_time,
      delayed: summary.delayed,
      departed: summary.departed,
    },
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages,
    },
    flights: paginatedFlights,
  };
}

export async function createFlight(input: {
  flightNumber: string;
  aircraftType: string;
  origin: string;
  destination: string;
  departureTime: string;
  arrivalTime?: string;
  cargoCutoffTime?: string;
  status?: "on_time" | "delayed" | "departed";
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
  const departureTime = new Date(input.departureTime);
  const arrivalTime = input.arrivalTime
    ? new Date(input.arrivalTime)
    : getEstimatedArrivalTime(departureTime, input.origin, input.destination);
  const cargoCutoffTime = input.cargoCutoffTime ? new Date(input.cargoCutoffTime) : getCargoCutoffTime(departureTime);
  assertFlightScheduleOrder({ cargoCutoffTime, departureTime, arrivalTime });

  const flight = await db.$transaction(async (tx) => {
    const created = await tx.flight.create({
      data: {
        flightNumber: normalizedFlightNumber,
        aircraftType: input.aircraftType,
        origin: input.origin.toUpperCase(),
        destination: input.destination.toUpperCase(),
        departureTime,
        arrivalTime,
        cargoCutoffTime,
        status: deriveFlightStatus({ departureTime, arrivalTime }),
        gate: input.gate || getGateForDestination(input.destination),
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
      departureTime: true,
      arrivalTime: true,
      cargoCutoffTime: true,
      archivedAt: true,
    },
  });

  if (!current) {
    throw new AccessError("Flight tidak ditemukan.", 404, "FLIGHT_NOT_FOUND");
  }

  const normalizedFlightNumber = ensureAllowedFlightNumber(input.flightNumber ?? current.flightNumber);
  const nextAircraftType = input.aircraftType ?? current.aircraftType;
  const meta = getFlightVisualMeta(normalizedFlightNumber, nextAircraftType);
  const departureTime = input.departureTime ? new Date(input.departureTime) : current.departureTime;
  const nextOrigin = input.origin?.toUpperCase() ?? current.origin;
  const nextDestination = input.destination?.toUpperCase() ?? current.destination;
  const arrivalTime = input.arrivalTime ? new Date(input.arrivalTime) : getEstimatedArrivalTime(departureTime, nextOrigin, nextDestination);
  const cargoCutoffTime = input.cargoCutoffTime ? new Date(input.cargoCutoffTime) : getCargoCutoffTime(departureTime);
  assertFlightScheduleOrder({ cargoCutoffTime, departureTime, arrivalTime });

  const updated = await db.$transaction(async (tx) => {
    const next = await tx.flight.update({
      where: { id: input.flightId },
      data: {
        flightNumber: normalizedFlightNumber,
        aircraftType: nextAircraftType,
        origin: input.origin ? nextOrigin : undefined,
        destination: input.destination ? nextDestination : undefined,
        departureTime: input.departureTime ? departureTime : undefined,
        arrivalTime,
        cargoCutoffTime,
        status: deriveFlightStatus({ departureTime, arrivalTime }),
        gate: input.gate ?? getGateForDestination(nextDestination),
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

export async function deleteFlight(flightId: string, actorUserId: string) {
  const actor = await getActorWithRelations(actorUserId);
  if (!actor) {
    throw new AccessError("Sesi tidak valid.", 401, "UNAUTHENTICATED");
  }

  ensureFlightManager(actor);

  const current = await db.flight.findUnique({
    where: { id: flightId },
    select: {
      id: true,
      flightNumber: true,
    },
  });

  if (!current) {
    throw new AccessError("Flight tidak ditemukan.", 404, "FLIGHT_NOT_FOUND");
  }

  await db.$transaction(async (tx) => {
    await tx.flight.delete({
      where: { id: flightId },
    });

    await tx.activityLog.create({
      data: {
        userId: actor.id,
        action: "Hapus Flight",
        targetType: "flight",
        targetId: flightId,
        targetLabel: current.flightNumber,
        description: `Flight ${current.flightNumber} dihapus dari database.`,
        level: "warning",
      },
    });
  });
}

export async function listActivityLogs(
  user: AccessUser,
  filters?: { query?: string; action?: string; userId?: string },
) {
  if (!isInternalRole(user.role)) {
    throw new AccessError("Log aktivitas hanya untuk pengguna internal.", 403, "INTERNAL_ROUTE_ONLY");
  }

  const where: Prisma.ActivityLogWhereInput = {};
  const existingLogCount = await db.activityLog.count();

  if (existingLogCount === 0) {
    await db.activityLog.createMany({
      data: [
        {
          userId: user.id,
          action: "Bootstrap Log Aktivitas",
          targetType: "system",
          targetId: null,
          targetLabel: "activity-log",
          description: "Log aktivitas awal dibuat otomatis supaya halaman audit langsung memiliki data.",
          level: "success",
        },
        {
          userId: user.id,
          action: "Sinkronisasi Sistem",
          targetType: "system",
          targetId: null,
          targetLabel: "seed-audit",
          description: "Sistem menyiapkan entri audit dasar untuk pemeriksaan operasional.",
          level: "info",
        },
        {
          userId: user.id,
          action: "Peringatan Audit",
          targetType: "system",
          targetId: null,
          targetLabel: "audit-warning",
          description: "Contoh peringatan dibuat agar ringkasan warning tidak kosong.",
          level: "warning",
        },
      ],
    });
  }

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
            status: true,
          },
        },
        capabilityOverrides: {
          select: {
            capability: true,
            enabled: true,
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
      canManageWorkspace: hasCapability(user, "settings:workspace"),
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

export type SearchScope =
  | "global"
  | "dashboard"
  | "ledger"
  | "awb"
  | "flight"
  | "alerts"
  | "activity-log"
  | "reports"
  | "settings";

export type SearchResult = {
  path: string;
  label: string;
  kind: string;
  description?: string;
};

export async function searchScoped(user: AccessUser, query: string, scope: SearchScope = "global") {
  const term = query.trim();
  const results: SearchResult[] = [];

  if (!term) {
    return { path: null as string | null, results };
  }

  if ((scope === "global" || scope === "awb" || scope === "dashboard" || scope === "ledger") && AWB_REGEX.test(term)) {
    const shipment = await db.shipment.findFirst({
      where: scopeAwbWhere(user, term),
      select: { awb: true, commodity: true, status: true },
    });

    if (shipment) {
      results.push({
        path: scope === "ledger" ? `/shipment-ledger?query=${shipment.awb}` : `/awb-tracking?awb=${shipment.awb}`,
        label: shipment.awb,
        kind: "AWB",
        description: `${shipment.commodity} - ${SHIPMENT_STATUS_LABELS[shipment.status]}`,
      });
    }
  }

  if (scope === "global" || scope === "ledger" || scope === "awb" || scope === "dashboard") {
    const shipments = await db.shipment.findMany({
      where: {
        ...scopeShipmentWhere(user),
        OR: [{ awb: { contains: term } }, { commodity: { contains: term } }, { shipper: { contains: term } }, { consignee: { contains: term } }],
      },
      select: { awb: true, commodity: true, origin: true, destination: true },
      take: 6,
      orderBy: { updatedAt: "desc" },
    });

	    results.push(
	      ...shipments.map((shipment) => ({
	        path: scope === "awb" ? `/awb-tracking?awb=${shipment.awb}` : `/shipment-ledger?query=${shipment.awb}`,
	        label: shipment.awb,
	        kind: scope === "awb" ? "AWB" : "Shipment",
	        description: `${shipment.origin}-${shipment.destination} - ${shipment.commodity}`,
	      })),
	    );
  }

  if (isInternalRole(user.role) && (scope === "global" || scope === "flight" || scope === "dashboard")) {
    const flights = await db.flight.findMany({
      where: {
        ...scopeFlightWhere(),
        OR: [{ flightNumber: { contains: term } }, { origin: { contains: term } }, { destination: { contains: term } }],
      },
      select: { flightNumber: true, origin: true, destination: true, status: true },
      take: 6,
      orderBy: { departureTime: "desc" },
    });

    results.push(
      ...flights.map((flight) => ({
        path: `/flight-board?query=${flight.flightNumber}`,
        label: flight.flightNumber,
        kind: "Flight",
        description: `${flight.origin}-${flight.destination} - ${FLIGHT_STATUS_LABELS[flight.status]}`,
      })),
    );
  }

  const uniqueResults = Array.from(new Map(results.map((result) => [result.path, result])).values()).slice(0, 10);
  return { path: uniqueResults[0]?.path ?? null, results: uniqueResults };
}

export async function searchGlobal(user: AccessUser, query: string) {
  const scoped = await searchScoped(user, query, "global");
  if (scoped.results[0]) {
    return scoped.results[0];
  }

  return null;
}

export async function searchGlobalLegacy(user: AccessUser, query: string) {
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
