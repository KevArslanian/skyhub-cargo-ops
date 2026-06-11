import { BellRing, Boxes, ShieldAlert, TriangleAlert } from "lucide-react";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import type {
  AircraftStatusRow,
  BaseShipment,
  DashboardFlightSummary,
  DashboardKpiTone,
  FlightScheduleItem,
  KpiCardItem,
  RevenueSummary,
  ShipmentFlowStage,
} from "@/lib/dashboard-types";

const FLOW_STAGE_HINTS: Record<string, string> = {
  Diterima: "Baru masuk gudang",
  Sortasi: "Sedang disortir",
  Muat: "Sudah dimuat ke pesawat",
  Transit: "Sudah berangkat",
  Tiba: "Sudah sampai tujuan",
  Dokumen: "Dokumen belum lengkap",
};

const HOUR_BUCKETS = ["00-03", "04-07", "08-11", "12-15", "16-19", "20-23"] as const;

export function formatDashboardIdr(value: number, compact = false) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
    notation: compact && value >= 1_000_000 ? "compact" : "standard",
  }).format(value);
}

export function buildKpiCards(input: {
  shipmentsCount: number;
  inFlowCount: number;
  openAlertsCount: number | string;
  urgentAlertsCount: number;
  reviewIssuesCount: number;
  holdsToday: number;
  alertsLoading: boolean;
}): KpiCardItem[] {
  const openTone: DashboardKpiTone =
    input.alertsLoading
      ? "info"
      : input.urgentAlertsCount > 0
        ? "danger"
        : typeof input.openAlertsCount === "number" && input.openAlertsCount > 0
          ? "warning"
          : "success";

  return [
    {
      id: "kpi-active-shipments",
      href: DASHBOARD_ROUTES.kpi.activeShipments,
      label: "Pengiriman Aktif",
      value: input.shipmentsCount,
      note: `${input.inFlowCount} dalam alur`,
      icon: Boxes,
      tone: "primary",
    },
    {
      id: "kpi-open-alerts",
      href: DASHBOARD_ROUTES.kpi.openAlerts,
      label: "Belum Ditindak",
      value: input.openAlertsCount,
      note: "kiriman",
      icon: BellRing,
      tone: openTone,
    },
    {
      id: "kpi-partial-docs",
      href: DASHBOARD_ROUTES.kpi.partialDocs,
      label: "Dokumen Sebagian",
      value: input.reviewIssuesCount,
      note: "kiriman",
      icon: ShieldAlert,
      tone: input.reviewIssuesCount ? "warning" : "info",
    },
    {
      id: "kpi-holds",
      href: DASHBOARD_ROUTES.kpi.holds,
      label: "Tertahan",
      value: input.holdsToday,
      note: "kiriman",
      icon: TriangleAlert,
      tone: input.holdsToday ? "warning" : "info",
    },
  ];
}

export function buildShipmentFlow(
  shipmentsToday: BaseShipment[],
  inFlowCount: number,
): { stages: ShipmentFlowStage[]; inFlowCount: number; totalCount: number } {
  const totalCount = shipmentsToday.length;
  const activeLoaded = shipmentsToday.filter((s) => s.status === "loaded_to_aircraft").length;
  const deliveredCount = shipmentsToday.filter((s) => s.status === "arrived").length;
  const docPending = shipmentsToday.filter(
    (s) => s.status !== "hold" && (s.docStatus === "Sebagian" || s.docStatus === "Ditinjau"),
  ).length;

  const raw = [
    { label: "Diterima", shortLabel: "Terima", count: shipmentsToday.filter((s) => s.status === "received").length },
    { label: "Sortasi", shortLabel: "Sort", count: shipmentsToday.filter((s) => s.status === "sortation").length },
    { label: "Muat", shortLabel: "Muat", count: activeLoaded },
    { label: "Transit", shortLabel: "Transit", count: shipmentsToday.filter((s) => s.status === "departed").length },
    { label: "Tiba", shortLabel: "Tiba", count: deliveredCount },
    { label: "Dokumen", shortLabel: "Dok", count: docPending },
  ];

  const denom = Math.max(totalCount, 1);
  const stages: ShipmentFlowStage[] = raw.map((row) => ({
    id: `flow-${row.label.toLowerCase()}`,
    label: row.label,
    shortLabel: row.shortLabel,
    hint: FLOW_STAGE_HINTS[row.label] ?? row.label,
    count: row.count,
    percent: Math.round((row.count / denom) * 100),
  }));

  return { stages, inFlowCount, totalCount };
}

export function buildRevenueSummary(shipmentsToday: BaseShipment[]): RevenueSummary {
  const buckets = HOUR_BUCKETS.map((label) => ({
    id: `revenue-${label}`,
    label,
    value: 0,
    awbCount: 0,
    avgPerAwb: 0,
  }));

  for (const shipment of shipmentsToday) {
    const hour = new Date(shipment.receivedAt).getHours();
    const bucketIndex = Math.min(Math.floor(hour / 4), buckets.length - 1);
    buckets[bucketIndex].value += shipment.shippingRate;
    buckets[bucketIndex].awbCount += 1;
  }

  for (const bucket of buckets) {
    bucket.avgPerAwb = bucket.awbCount > 0 ? Math.round(bucket.value / bucket.awbCount) : 0;
  }

  const totalRevenue = shipmentsToday.reduce((sum, s) => sum + s.shippingRate, 0);
  const peak = buckets.reduce((best, b) => (b.value > best.value ? b : best), buckets[0]);
  const peakLabel = peak?.value ? `Puncak ${peak.label}` : "Belum ada penerimaan";

  return {
    buckets,
    totalRevenue,
    totalAwb: shipmentsToday.length,
    peakLabel,
    peakBucketId: peak?.value ? peak.id : null,
  };
}

export function buildAircraftStatusRows(input: {
  onTime: number;
  atRisk: number;
  delayed: number;
  departed: number;
}): AircraftStatusRow[] {
  return [
    { id: "status-scheduled", label: "Terjadwal", count: input.onTime, tone: "info" },
    { id: "status-confirm", label: "Perlu Konfirmasi", count: input.atRisk, tone: "warning" },
    { id: "status-delayed", label: "Terlambat", count: input.delayed, tone: "danger" },
    { id: "status-departed", label: "Berangkat", count: input.departed, tone: "success" },
  ];
}

export function isFlightNeedsRecovery(flight: DashboardFlightSummary) {
  return flight.status === "at_risk" || flight.status === "delayed" || flight.cutoffAtRisk;
}

export function buildFlightScheduleItems(flights: DashboardFlightSummary[]): FlightScheduleItem[] {
  return flights.map((flight) => {
    const needsAction = isFlightNeedsRecovery(flight);
    return {
      id: flight.id,
      flightNumber: flight.flightNumber,
      route: flight.route,
      origin: flight.origin,
      destination: flight.destination,
      status: flight.status,
      statusLabel: flight.statusLabel,
      departureTime: flight.departureTime,
      cargoCutoffTime: flight.cargoCutoffTime,
      cutoffAtRisk: flight.cutoffAtRisk,
      needsAction,
      openHref: DASHBOARD_ROUTES.flights.detail(flight.id),
      manageHref: DASHBOARD_ROUTES.flights.edit(flight.id),
    };
  });
}

export function sortFlightsByCutoff<T extends { cargoCutoffTime: string; departureTime: string; status: string }>(
  flights: T[],
) {
  const now = Date.now();
  return [...flights].sort((left, right) => {
    const lc = new Date(left.cargoCutoffTime).getTime();
    const rc = new Date(right.cargoCutoffTime).getTime();
    const ld = new Date(left.departureTime).getTime();
    const rd = new Date(right.departureTime).getTime();
    const lDep = left.status === "departed" || ld < now;
    const rDep = right.status === "departed" || rd < now;
    const lUp = lc >= now;
    const rUp = rc >= now;
    if (lDep !== rDep) return lDep ? 1 : -1;
    if (lUp !== rUp) return lUp ? -1 : 1;
    if (lUp && rUp) return lc - rc;
    return rc - lc;
  });
}