"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRightLeft,
  ArrowUpRight,
  BellRing,
  Boxes,
  ChevronDown,
  FileCheck2,
  FileText,
  History,
  PackageCheck,
  PackageSearch,
  ShieldAlert,
  TowerControl,
  TriangleAlert,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { GlassSelect } from "@/components/glass-select";
import { OpsDrawer } from "@/components/ops-drawer";
import { SERVICE_LEVEL_RATES } from "@/lib/constants";

import { FLIGHT_MASTER_RULES } from "@/lib/flight-rules";
import { cn, formatRelativeShort, formatTimeOnly, formatWeight } from "@/lib/format";
import { OpsLockedPage } from "@/components/ops-locked-page";
import { EmptyState, OpsPanel, PageHeader, SectionHeader, SkeletonBlock } from "@/components/ops-ui";

import { useOpsAlert } from "@/components/ops-alert-provider";
import { networkErrorMessage, readApiError, type OpsAlertInput, type OpsToastInput } from "@/lib/ops-feedback";


/* ── Premium HSL Palette ── */
const DONUT_INDIGO = "hsl(226, 70%, 50%)";
const DONUT_EMERALD = "hsl(142, 72%, 35%)";
const DONUT_AMBER = "hsl(38, 92%, 50%)";
const DONUT_ROSE = "hsl(350, 89%, 60%)";
const DONUT_SLATE = "hsl(215, 15%, 85%)";
const DONUT_SKY = "hsl(200, 80%, 55%)";

const FLOW_BAR_COLORS = [
  "hsl(226, 72%, 46%)",
  "hsl(226, 64%, 54%)",
  "hsl(226, 56%, 62%)",
  "hsl(200, 70%, 48%)",
  "hsl(142, 58%, 42%)",
  "hsl(38, 82%, 48%)",
] as const;


type BaseShipment = {
  id: string;
  awb: string;
  commodity: string;
  origin: string;
  destination: string;
  pieces: number;
  weightKg: number;
  shippingRate: number;
  status: string;
  statusLabel: string;
  flightNumber: string | null;
  receivedAt: string;
  updatedAt: string;
  docStatus: string;
  needsReview: boolean;
  documentSummary: {
    docStatus: string;
    count: number;
    latestUploadedAt: string | null;
  };
};

type InternalDashboardData = {
  variant: "internal";
  viewer: { role: "admin" | "staff" };
  alertSummary: {
    open: number;
    active: number;
    critical: number;
    warning: number;
    info: number;
    slaBreached: number;
  };
  auditIssues24h: number;
  metrics: {
    shipmentsToday: number;
    activeFlights: number;
    onTime: number;
    atRisk: number;
    delayed: number;
    departed: number;
    holds: number;
    inFlowCount: number;
    docReviewCount: number;
    actionRequiredCount: number;
    flightScope: "window" | "nearest";
  };
  flightsSummary: {
    id: string;
    flightNumber: string;
    route: string;
    origin: string;
    destination: string;
    status: string;
    statusLabel: string;
    departureTime: string;
    cargoCutoffTime: string;
    cutoffAtRisk: boolean;
    airlineName: string;
    airlineLogoUrl: string;
    aircraftType: string;
    registration: string;
    imageUrl: string;
  }[];
  shipmentsToday: BaseShipment[];
  recentActivity: {
    id: string;
    action: string;
    targetLabel: string;
    description: string;
    level: string;
    userName: string;
    createdAt: string;
  }[];
};

type DashboardData = InternalDashboardData;

type DashboardPanelTab = "ringkasan" | "aktivitas" | "peringatan";

const DASHBOARD_PANEL_TABS: { id: DashboardPanelTab; label: string }[] = [
  { id: "ringkasan", label: "Ringkasan" },
  { id: "aktivitas", label: "Aktivitas" },
  { id: "peringatan", label: "Peringatan" },
];

const FLOW_STAGE_HINTS: Record<string, string> = {
  Diterima: "Baru masuk gudang",
  Sortasi: "Sedang disortir",
  Muat: "Sudah dimuat ke pesawat",
  Transit: "Sudah berangkat",
  Tiba: "Sudah sampai tujuan",
  Dokumen: "Dokumen belum lengkap",
};

type DashboardKpiPayload = Omit<InternalDashboardData, "alertSummary" | "recentActivity">;
type DashboardAlertsPayload = Pick<InternalDashboardData, "alertSummary" | "auditIssues24h" | "recentActivity">;

const EMPTY_ALERT_SUMMARY: InternalDashboardData["alertSummary"] = {
  open: 0,
  active: 0,
  critical: 0,
  warning: 0,
  info: 0,
  slaBreached: 0,
};

const KPI_SLOW_TIMEOUT_MS = 8_000;

function buildDashboardSearchParams(options: {
  kpisOnly?: boolean;
  alertsOnly?: boolean;
  dateFrom?: string;
  dateTo?: string;
}) {
  const params = new URLSearchParams();
  if (options.kpisOnly) params.set("kpisOnly", "1");
  if (options.alertsOnly) params.set("alertsOnly", "1");
  if (options.dateFrom && options.dateTo && options.dateFrom === options.dateTo) {
    params.set("date", options.dateFrom);
  } else {
    if (options.dateFrom) params.set("dateFrom", options.dateFrom);
    if (options.dateTo) params.set("dateTo", options.dateTo);
  }
  return params;
}

type DashboardSettingsPayload = {
  settings: {
    autoRefresh: boolean;
    refreshIntervalSeconds: number;
  } | null;
};

const EMPTY_SHIPMENTS: BaseShipment[] = [];
const EMPTY_FLIGHTS: InternalDashboardData["flightsSummary"] = [];

function sortFlightsByCutoff<T extends { cargoCutoffTime: string; departureTime: string; status: string }>(flights: T[]) {
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

function DashboardSummaryCard({
  href,
  label,
  value,
  icon: Icon,
  tone,
}: {
  href: string;
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone: "primary" | "success" | "warning" | "danger" | "info";
}) {
  const toneClass = {
    primary: "bg-[color:var(--brand-primary-soft)] text-[color:var(--brand-primary)]",
    success: "bg-[color:var(--tone-success-soft)] text-[color:var(--tone-success)]",
    warning: "bg-[color:var(--tone-warning-soft)] text-[color:var(--tone-warning)]",
    danger: "bg-[color:var(--tone-danger-soft)] text-[color:var(--tone-danger)]",
    info: "bg-[color:var(--tone-info-soft)] text-[color:var(--tone-info)]",
  }[tone];

  return (
    <Link
      href={href}
      className="dashboard-summary-card ops-kpi-card group flex min-w-0 items-center gap-2.5 rounded-[14px] border border-[color:var(--border-soft)] px-3 py-2.5 transition-colors hover:border-[color:var(--brand-primary)]/35 hover:bg-[color:var(--panel-muted)]"
    >
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]", toneClass)}>
        <Icon size={18} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[11px] font-bold uppercase tracking-[0.04em] text-[color:var(--muted-2)]">
          {label}
        </span>
        <strong className="mt-0.5 block truncate font-[family:var(--font-heading)] text-[1.35rem] font-black leading-none tracking-[-0.02em] text-[color:var(--text-strong)]">
          {value}
        </strong>
      </span>
    </Link>
  );
}

function ShipmentFlowOverview({
  items,
  inFlowCount,
  totalCount,
}: {
  items: { label: string; value: number }[];
  inFlowCount: number;
  totalCount: number;
}) {
  const maxValue = Math.max(...items.map((item) => item.value), 1);

  return (
    <div className="dashboard-flow-compact">
      <p className="dashboard-flow-compact-meta">
        <strong>{inFlowCount}</strong> / <strong>{totalCount}</strong> manifest dalam alur
      </p>
      <div className="dashboard-flow-compact-track">
        {items.map((item) => (
          <div
            key={item.label}
            className="dashboard-flow-compact-stage"
            title={`${FLOW_STAGE_HINTS[item.label] ?? item.label}: ${item.value}`}
          >
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <div className="dashboard-flow-compact-bar" aria-hidden="true">
              <div
                className="dashboard-flow-compact-fill"
                style={{ width: `${Math.max(item.value > 0 ? 10 : 0, (item.value / maxValue) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function textMatchesQuery(values: Array<string | number | null | undefined>, query: string) {
  const n = query.trim().toLowerCase();
  return !n || values.join(" ").toLowerCase().includes(n);
}

function formatDashboardIdr(value: number, compact = false) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
    notation: compact && value >= 1_000_000 ? "compact" : "standard",
  }).format(value);
}

const SERVICE_RATE_EXPLANATION = Object.entries(SERVICE_LEVEL_RATES)
  .map(([service, rate]) => `${service} Rp${Math.round(rate / 1000)}rb/kg`)
  .join(", ");

function DashboardChartCard({
  title,
  metric,
  metricNote,
  accent,
  className,
  footerNote,
  children,
}: {
  title: string;
  metric: string;
  metricNote?: string;
  accent: string;
  className?: string;
  footerNote?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("dashboard-chart-card rounded-[16px] border border-[color:var(--border-soft)] bg-[color:var(--panel-bg)]/80 p-4 min-w-0", className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[color:var(--muted-2)]">{title}</p>
        </div>
        <div className="shrink-0 text-right">
          <strong className="inline-block rounded-full px-2.5 py-1 text-[12px] font-bold" style={{ color: accent, backgroundColor: `${accent}18` }}>
            {metric}
          </strong>
          {metricNote ? <span className="mt-0.5 block text-[11px] font-semibold text-[color:var(--muted-fg)]">{metricNote}</span> : null}
        </div>
      </div>
      <div className="dashboard-chart-card-body">{children}</div>
      {footerNote ? <div className="dashboard-chart-card-footer mt-2 border-t border-[color:var(--border-soft)] pt-2">{footerNote}</div> : null}
    </div>
  );
}

function VerticalBarChart({
  items,
  color,
  colors,
}: {
  items: { label: string; value: number }[];
  color: string;
  colors?: readonly string[];
}) {
  const maxValue = Math.max(...items.map((item) => item.value), 1);

  return (
    <div
      className="dashboard-chart-bars grid min-w-0 gap-1.5 sm:gap-2"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((item, index) => (
        <div key={item.label} className="flex min-w-0 flex-col items-center gap-1.5 sm:gap-2">
          <div className="flex h-[72px] w-full min-w-0 items-end rounded-[12px] bg-[color:var(--panel-muted)]/85 p-1.5 sm:h-[96px] sm:rounded-[14px] sm:p-2">
            <div
              className="w-full min-w-0 rounded-[8px] transition-[height] sm:rounded-[10px]"
              style={{
                height: `${Math.max(item.value > 0 ? 14 : 6, (item.value / maxValue) * 100)}%`,
                backgroundColor: colors?.[index] ?? color,
              }}
            />
          </div>
          <div className="w-full min-w-0 text-center">
            <p className="text-[11px] font-semibold leading-none text-[color:var(--text-strong)] sm:text-xs">{item.value}</p>
            <p className="mt-0.5 truncate px-0.5 text-[8px] uppercase leading-tight tracking-[0.08em] text-[color:var(--muted-fg)] sm:text-[9px]" title={item.label}>
              {item.label}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

type TrendChartItem = { label: string; value: number; awbCount: number };

function TrendLineChart({
  items,
  color,
}: {
  items: TrendChartItem[];
  color: string;
}) {
  const width = 360;
  const height = 160;
  const padding = { top: 16, right: 14, bottom: 18, left: 14 };
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const maxValue = Math.max(...items.map((item) => item.value), 1);
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const stepX = items.length > 1 ? plotWidth / (items.length - 1) : 0;
  const points = items.map((item, index) => {
    const x = padding.left + index * stepX;
    const y = padding.top + plotHeight - (item.value / maxValue) * plotHeight;
    return { ...item, x, y, index };
  });
  const polyline = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = points.length
    ? `${padding.left},${height - padding.bottom} ${polyline} ${width - padding.right},${height - padding.bottom}`
    : "";
  const activeIndex = hoveredIndex ?? (points.some((point) => point.value > 0) ? points.reduce((best, point) => (point.value > best.value ? point : best), points[0]).index : null);
  const activePoint = activeIndex === null ? null : points[activeIndex];

  const resolveIndexFromClientX = useCallback(
    (clientX: number) => {
      const node = chartRef.current;
      if (!node || items.length === 0) return null;
      const rect = node.getBoundingClientRect();
      const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
      const xInViewBox = padding.left + ratio * plotWidth;
      let nearest = 0;
      let nearestDistance = Number.POSITIVE_INFINITY;
      for (const point of points) {
        const distance = Math.abs(point.x - xInViewBox);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = point.index;
        }
      }
      return nearest;
    },
    [items.length, plotWidth, points, padding.left],
  );

  const handlePointer = useCallback(
    (clientX: number) => {
      const index = resolveIndexFromClientX(clientX);
      setHoveredIndex(index);
    },
    [resolveIndexFromClientX],
  );

  return (
    <div
      ref={chartRef}
      className="dashboard-chart-trend dashboard-chart-trend--interactive relative min-w-0"
      onMouseLeave={() => setHoveredIndex(null)}
      onMouseMove={(event) => handlePointer(event.clientX)}
      onTouchStart={(event) => {
        const touch = event.touches[0];
        if (touch) handlePointer(touch.clientX);
      }}
      onTouchMove={(event) => {
        const touch = event.touches[0];
        if (touch) handlePointer(touch.clientX);
      }}
    >
      {activePoint ? (
        <div
          className="dashboard-chart-trend-tooltip pointer-events-none absolute z-10 max-w-[min(220px,92vw)] rounded-[10px] border border-[color:var(--border-soft)] bg-[color:var(--panel-bg)] px-2.5 py-2 shadow-[0_10px_24px_rgba(15,23,42,0.12)]"
          style={{
            left: `${(activePoint.x / width) * 100}%`,
            top: "0.35rem",
            transform: "translateX(-50%)",
          }}
        >
          <p className="text-[11px] font-bold text-[color:var(--text-strong)]">Jam {activePoint.label}</p>
          <p className="mt-0.5 text-[12px] font-extrabold" style={{ color }}>
            {formatDashboardIdr(activePoint.value)}
          </p>
          <p className="mt-0.5 text-[10px] font-semibold text-[color:var(--muted-fg)]">
            {activePoint.awbCount} AWB diterima
          </p>
        </div>
      ) : null}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="dashboard-chart-trend-svg h-[132px] w-full touch-pan-y sm:h-[168px]"
        role="img"
        aria-label="Grafik pendapatan harian per blok jam"
      >
        <path
          d={`M ${padding.left} ${height - padding.bottom} H ${width - padding.right}`}
          stroke="rgba(148, 163, 184, 0.35)"
          strokeWidth="1.5"
          fill="none"
        />
        {area ? <polygon points={area} fill={color} fillOpacity={0.14} /> : null}
        <polyline
          points={polyline}
          fill="none"
          stroke={color}
          strokeWidth="2.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {activePoint ? (
          <line
            x1={activePoint.x}
            x2={activePoint.x}
            y1={padding.top}
            y2={height - padding.bottom}
            stroke={color}
            strokeOpacity={0.35}
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
        ) : null}
        {points.map((point) => {
          const active = point.index === activeIndex;
          return (
            <circle
              key={point.label}
              cx={point.x}
              cy={point.y}
              r={active ? 5.5 : 3.5}
              fill={color}
              stroke={active ? "white" : "none"}
              strokeWidth={active ? 2 : 0}
              className="transition-[r] duration-150"
            />
          );
        })}
      </svg>
      <div
        className="dashboard-chart-trend-labels mt-1.5 grid min-w-0 gap-1 sm:mt-2 sm:gap-1.5"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item, index) => (
          <button
            key={item.label}
            type="button"
            className={cn(
              "min-w-0 rounded-[8px] px-0.5 py-0.5 text-center transition-colors",
              index === activeIndex && "bg-[color:var(--panel-muted)]",
            )}
            onMouseEnter={() => setHoveredIndex(index)}
            onFocus={() => setHoveredIndex(index)}
            onBlur={() => setHoveredIndex(null)}
          >
            <p className="text-[10px] font-semibold leading-none text-[color:var(--text-strong)] sm:text-[11px]">
              {item.awbCount > 0 ? formatDashboardIdr(item.value, true) : "—"}
            </p>
            <p className="mt-0.5 truncate text-[8px] uppercase leading-tight tracking-[0.06em] text-[color:var(--muted-fg)] sm:text-[9px]" title={item.label}>
              {item.label}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

type DashboardFlightSummary = InternalDashboardData["flightsSummary"][number];

function isFlightNeedsRecovery(flight: DashboardFlightSummary) {
  return flight.status === "at_risk" || flight.status === "delayed" || flight.cutoffAtRisk;
}

function findReplacementFlights(source: DashboardFlightSummary, flights: DashboardFlightSummary[]) {
  const now = Date.now();
  return flights
    .filter(
      (candidate) =>
        candidate.id !== source.id &&
        candidate.destination === source.destination &&
        candidate.status === "on_time" &&
        new Date(candidate.departureTime).getTime() > now,
    )
    .sort((left, right) => new Date(left.departureTime).getTime() - new Date(right.departureTime).getTime());
}

function FlightDelayRecoveryPanel({
  flights,
  shipments,
  onTime,
  delayed,
  atRisk,
  departed,
  onReassignComplete,
  showToast,
  showAlert,
}: {
  flights: DashboardFlightSummary[];
  shipments: BaseShipment[];
  onTime: number;
  delayed: number;
  atRisk: number;
  departed: number;
  onReassignComplete: () => Promise<void>;
  showToast: (input: OpsToastInput) => void;
  showAlert: (input: OpsAlertInput) => void;
}) {
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignSaving, setReassignSaving] = useState(false);
  const [reassignSource, setReassignSource] = useState<DashboardFlightSummary | null>(null);
  const [reassignTargetId, setReassignTargetId] = useState("");
  const [selectedShipmentIds, setSelectedShipmentIds] = useState<string[]>([]);

  const summaryRows = [
    { label: "Terjadwal", value: onTime },
    { label: "Perlu konfirmasi", value: atRisk },
    { label: "Terlambat", value: delayed },
    { label: "Berangkat", value: departed },
  ] as const;

  const problemFlights = useMemo(
    () =>
      [...flights]
        .filter(isFlightNeedsRecovery)
        .sort((left, right) => new Date(left.departureTime).getTime() - new Date(right.departureTime).getTime()),
    [flights],
  );

  const affectedByFlight = useMemo(() => {
    const map = new Map<string, BaseShipment[]>();
    for (const shipment of shipments) {
      if (!shipment.flightNumber) continue;
      const bucket = map.get(shipment.flightNumber) ?? [];
      bucket.push(shipment);
      map.set(shipment.flightNumber, bucket);
    }
    return map;
  }, [shipments]);

  const replacementOptions = useMemo(() => {
    if (!reassignSource) return [];
    return findReplacementFlights(reassignSource, flights);
  }, [flights, reassignSource]);

  const openReassignDrawer = useCallback(
    (flight: DashboardFlightSummary, preferredTargetId?: string) => {
      const affected = affectedByFlight.get(flight.flightNumber) ?? [];
      const replacements = findReplacementFlights(flight, flights);
      setReassignSource(flight);
      setSelectedShipmentIds(affected.map((item) => item.id));
      setReassignTargetId(preferredTargetId ?? replacements[0]?.id ?? "");
      setReassignOpen(true);
    },
    [affectedByFlight, flights],
  );

  const closeReassignDrawer = useCallback(() => {
    if (reassignSaving) return;
    setReassignOpen(false);
    setReassignSource(null);
    setReassignTargetId("");
    setSelectedShipmentIds([]);
  }, [reassignSaving]);

  const toggleShipmentSelection = useCallback((shipmentId: string) => {
    setSelectedShipmentIds((current) =>
      current.includes(shipmentId) ? current.filter((id) => id !== shipmentId) : [...current, shipmentId],
    );
  }, []);

  const handleBulkReassign = useCallback(async () => {
    if (!reassignSource || !reassignTargetId || selectedShipmentIds.length === 0) {
      showAlert({
        title: "Alihkan muatan belum lengkap",
        description: "Pilih slot pengganti dan minimal satu AWB yang akan dipindahkan.",
        tone: "warning",
      });
      return;
    }

    const targetFlight = flights.find((flight) => flight.id === reassignTargetId);
    setReassignSaving(true);
    let moved = 0;
    try {
      for (const shipmentId of selectedShipmentIds) {
        const response = await fetch(`/api/shipments/${shipmentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ flightId: reassignTargetId }),
        });
        if (response.ok) {
          moved += 1;
          continue;
        }
        const message = await readApiError(response, "Gagal mengalihkan muatan.");
        showAlert({ title: "Alihkan muatan gagal", description: message, tone: "error" });
        break;
      }

      if (moved > 0) {
        showToast({
          title: "Muatan dialihkan",
          description: `${moved} AWB dipindahkan dari ${reassignSource.flightNumber} ke ${targetFlight?.flightNumber ?? "slot baru"}.`,
          tone: "success",
        });
        closeReassignDrawer();
        await onReassignComplete();
      }
    } catch {
      showAlert({
        title: "Koneksi terputus",
        description: networkErrorMessage("mengalihkan muatan"),
        tone: "warning",
      });
    } finally {
      setReassignSaving(false);
    }
  }, [
    closeReassignDrawer,
    flights,
    onReassignComplete,
    reassignSource,
    reassignTargetId,
    selectedShipmentIds,
    showAlert,
    showToast,
  ]);

  const reassignCandidates = reassignSource ? affectedByFlight.get(reassignSource.flightNumber) ?? [] : [];

  return (
    <>
      <div className="dashboard-flight-recovery-panel min-h-0 min-w-0 space-y-2">
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {summaryRows.map((row) => (
            <div
              key={row.label}
              className="rounded-[10px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)]/70 px-2 py-1.5 text-center"
            >
              <p className="truncate text-[9px] font-bold uppercase tracking-[0.08em] text-[color:var(--muted-fg)]">{row.label}</p>
              <p className="font-[family:var(--font-heading)] text-[1rem] font-black leading-none text-[color:var(--text-strong)]">{row.value}</p>
            </div>
          ))}
        </div>

        <p className="rounded-[10px] border border-dashed border-[color:var(--border-soft)] bg-[color:var(--panel-muted)]/45 px-2.5 py-2 text-[10px] leading-[1.45] text-[color:var(--muted-fg)]">
          Alur pemulihan: (1) konfirmasi status di Manajemen Pesawat, (2) pilih slot pengganti dengan rute tujuan sama,
          (3) alihkan AWB terdampak. Cutoff muatan T-{FLIGHT_MASTER_RULES.cargoCutoffMinutesBeforeDeparture} sebelum STD.
        </p>

        <div className="dashboard-flight-recovery-scroll max-h-[min(240px,42vh)] space-y-2 overflow-y-auto pr-0.5">
          {problemFlights.length ? (
            problemFlights.map((flight) => {
              const affected = affectedByFlight.get(flight.flightNumber) ?? [];
              const replacements = findReplacementFlights(flight, flights);
              const totalWeight = affected.reduce((sum, item) => sum + item.weightKg, 0);
              return (
                <div
                  key={flight.id}
                  className="rounded-[12px] border border-[color:var(--tone-warning-border)] bg-[color:var(--tone-warning-soft)] px-3 py-2.5"
                >
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-[13px] font-bold text-[color:var(--text-strong)]">{flight.flightNumber}</p>
                      <p className="truncate text-[11px] text-[color:var(--muted-fg)]">
                        {flight.route} · {flight.statusLabel} · berangkat {formatTimeOnly(flight.departureTime)}
                      </p>
                      <p className="mt-0.5 text-[10px] font-semibold text-[color:var(--tone-warning)]">
                        {affected.length ? `${affected.length} AWB · ${formatWeight(totalWeight)}` : "Belum ada muatan terpasang"}
                      </p>
                    </div>
                    <Link
                      href={`/flight-board?id=${flight.id}`}
                      className="shrink-0 text-[11px] font-bold text-[color:var(--brand-primary)] hover:underline"
                    >
                      Atur jadwal
                    </Link>
                  </div>

                  <div className="mt-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--muted-fg)]">Slot pengganti</p>
                    {replacements.length ? (
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {replacements.slice(0, 3).map((replacement) => (
                          <button
                            key={replacement.id}
                            type="button"
                            className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border-soft)] bg-[color:var(--panel-bg)] px-2 py-1 text-[10px] font-bold text-[color:var(--text-strong)] transition-colors hover:border-[color:var(--brand-primary)]"
                            onClick={() => openReassignDrawer(flight, replacement.id)}
                          >
                            <ArrowRightLeft size={11} />
                            {replacement.flightNumber} {formatTimeOnly(replacement.departureTime)}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-1 text-[10px] font-semibold text-[color:var(--muted-fg)]">
                        Belum ada penerbangan tujuan {flight.destination} yang masih terjadwal. Buat slot baru di Manajemen Pesawat.
                      </p>
                    )}
                  </div>

                  {affected.length > 0 ? (
                    <button
                      type="button"
                      className="mt-2 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-full border border-[color:var(--tone-warning-border)] bg-[color:var(--panel-bg)] px-3 text-[11px] font-bold text-[color:var(--text-strong)] transition-colors hover:bg-[color:var(--panel-muted)]"
                      onClick={() => openReassignDrawer(flight)}
                    >
                      <ArrowRightLeft size={13} />
                      Alihkan {affected.length} AWB ke pesawat lain
                    </button>
                  ) : null}
                </div>
              );
            })
          ) : (
            <div className="rounded-[12px] border border-[color:var(--tone-success-border)] bg-[color:var(--tone-success-soft)] px-3 py-2.5 text-[11px] font-semibold text-[color:var(--tone-success)]">
              Semua slot terjadwal. Tidak ada penerbangan yang perlu dialihkan.
            </div>
          )}
        </div>
      </div>

      <OpsDrawer
        open={reassignOpen && Boolean(reassignSource)}
        eyebrow="Pemulihan Jadwal"
        title={reassignSource ? `Alihkan muatan ${reassignSource.flightNumber}` : "Alihkan muatan"}
        description="Pilih penerbangan pengganti dengan tujuan yang sama, lalu pindahkan AWB terdampak dalam satu langkah."
        onClose={closeReassignDrawer}
        footer={
          <div className="flex w-full justify-end gap-3">
            <button type="button" className="btn btn-secondary" onClick={closeReassignDrawer} disabled={reassignSaving}>
              Batal
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void handleBulkReassign()} disabled={reassignSaving}>
              {reassignSaving ? "Mengalihkan..." : `Alihkan ${selectedShipmentIds.length} AWB`}
            </button>
          </div>
        }
      >
        {reassignSource ? (
          <div className="space-y-4">
            <div className="rounded-[16px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-4 py-3 text-sm">
              <p className="text-[color:var(--muted-fg)]">
                Dari <span className="font-bold text-[color:var(--text-strong)]">{reassignSource.flightNumber}</span> ({reassignSource.route})
              </p>
              <p className="mt-1 text-[color:var(--muted-fg)]">
                Status saat ini: <span className="font-semibold text-[color:var(--text-strong)]">{reassignSource.statusLabel}</span>
              </p>
            </div>

            <div>
              <label className="label">Penerbangan pengganti</label>
              <GlassSelect
                aria-label="Penerbangan pengganti"
                value={reassignTargetId}
                onChange={setReassignTargetId}
                options={
                  replacementOptions.length
                    ? replacementOptions.map((flight) => ({
                        value: flight.id,
                        label: `${flight.flightNumber} · ${flight.route} · ${formatTimeOnly(flight.departureTime)}`,
                      }))
                    : [{ value: "", label: "Tidak ada slot tersedia" }]
                }
              />
              {!replacementOptions.length ? (
                <p className="form-help">
                  Buat penerbangan baru ke {reassignSource.destination} lewat{" "}
                  <Link href="/flight-board" className="font-semibold text-[color:var(--brand-primary)] hover:underline">
                    Manajemen Pesawat
                  </Link>
                  .
                </p>
              ) : null}
            </div>

            <div>
              <p className="label">AWB yang dialihkan</p>
              <div className="space-y-2">
                {reassignCandidates.map((shipment) => {
                  const checked = selectedShipmentIds.includes(shipment.id);
                  return (
                    <label
                      key={shipment.id}
                      className="flex cursor-pointer items-center justify-between gap-3 rounded-[14px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-3 py-2.5"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <input
                          type="checkbox"
                          className="h-4 w-4 shrink-0 accent-[color:var(--brand-primary)]"
                          checked={checked}
                          onChange={() => toggleShipmentSelection(shipment.id)}
                        />
                        <div className="min-w-0">
                          <p className="font-mono text-[12px] font-bold text-[color:var(--brand-primary)]">{shipment.awb}</p>
                          <p className="truncate text-[11px] text-[color:var(--muted-fg)]">{shipment.commodity}</p>
                        </div>
                      </div>
                      <span className="shrink-0 text-[11px] font-semibold text-[color:var(--muted-fg)]">{formatWeight(shipment.weightKg)}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}
      </OpsDrawer>
    </>
  );
}

type DashboardFetchFailure = "none" | "toast" | "modal";

export default function DashboardPage() {
  const { showAlert, showToast } = useOpsAlert();
  const [kpiData, setKpiData] = useState<DashboardKpiPayload | null>(null);
  const [alertsData, setAlertsData] = useState<DashboardAlertsPayload | null>(null);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [kpiSlow, setKpiSlow] = useState(false);
  const [kpiError, setKpiError] = useState<string | null>(null);
  const [alertsError, setAlertsError] = useState<string | null>(null);

  const [dashboardPanel, setDashboardPanel] = useState<DashboardPanelTab>("ringkasan");
  const [dashboardQuery, setDashboardQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [refreshSettings, setRefreshSettings] = useState({ autoRefresh: true, refreshIntervalSeconds: 15 });
  const hasBootstrappedRef = useRef(false);
  const hasAlertsDataRef = useRef(false);
  const dateFilterReadyRef = useRef(false);

  useEffect(() => {
    function handleContextSearch(event: Event) {
      const detail = (event as CustomEvent<{ pathname?: string; query?: string }>).detail;
      if (detail?.pathname !== "/dashboard" || !detail.query) return;
      setDashboardQuery(detail.query);
    }
    window.addEventListener("skyhub:context-search", handleContextSearch as EventListener);
    return () => window.removeEventListener("skyhub:context-search", handleContextSearch as EventListener);
  }, []);

  const reportDashboardFailure = useCallback(
    (failure: DashboardFetchFailure, title: string, description: string, tone: "error" | "warning" = "error") => {
      if (failure === "none") return;
      if (failure === "toast") {
        showToast({ title, description, tone: tone === "warning" ? "info" : "info" });
        return;
      }
      showAlert({ title, description, tone });
    },
    [showAlert, showToast],
  );

  const fetchDashboardEndpoint = useCallback(
    async <T,>(
      params: URLSearchParams,
      errorLabel: string,
      options?: { failure?: DashboardFetchFailure; failureTitle?: string },
    ): Promise<T | null> => {
      const maxAttempts = 4;
      const failureMode = options?.failure ?? "modal";
      const failureTitle = options?.failureTitle ?? "Gagal Memuat Dasbor";

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          const response = await fetch(`/api/dashboard?${params.toString()}`, { cache: "no-store" });
          if (response.ok) {
            return (await response.json()) as T;
          }

          if ((response.status === 503 || response.status === 502) && attempt < maxAttempts) {
            await new Promise((resolve) => window.setTimeout(resolve, 1000 * attempt));
            continue;
          }

          const message = await readApiError(response, errorLabel);
          reportDashboardFailure(failureMode, failureTitle, message);
          return null;
        } catch {
          if (attempt < maxAttempts) {
            await new Promise((resolve) => window.setTimeout(resolve, 1000 * attempt));
            continue;
          }

          reportDashboardFailure(
            failureMode,
            "Koneksi Terputus",
            networkErrorMessage("memuat dasbor operasional"),
            "warning",
          );
          return null;
        }
      }

      return null;
    },
    [reportDashboardFailure],
  );

  const requestDashboardKpis = useCallback(
    async (
      dateFilter?: { dateFrom?: string; dateTo?: string },
      options?: { failure?: DashboardFetchFailure },
    ) => {
      const params = buildDashboardSearchParams({
        kpisOnly: true,
        dateFrom: dateFilter?.dateFrom,
        dateTo: dateFilter?.dateTo,
      });
      return fetchDashboardEndpoint<DashboardKpiPayload>(params, "Ringkasan dasbor belum bisa dimuat.", {
        failure: options?.failure ?? "modal",
        failureTitle: "Gagal Memuat Dasbor",
      });
    },
    [fetchDashboardEndpoint],
  );

  const requestDashboardAlerts = useCallback(
    async (options?: { failure?: DashboardFetchFailure }) => {
      const params = buildDashboardSearchParams({ alertsOnly: true });
      return fetchDashboardEndpoint<DashboardAlertsPayload>(params, "Peringatan dasbor belum bisa dimuat.", {
        failure: options?.failure ?? "toast",
        failureTitle: "Peringatan Dasbor",
      });
    },
    [fetchDashboardEndpoint],
  );

  const loadDashboardAlerts = useCallback(
    async (
      mode: "initial" | "refresh" = "refresh",
      options?: { kpiLoaded?: boolean; failure?: DashboardFetchFailure },
    ) => {
      if (mode === "initial" || !hasAlertsDataRef.current) {
        setAlertsLoading(true);
      }

      const hasKpiSnapshot = options?.kpiLoaded ?? Boolean(kpiData);
      const failure =
        options?.failure ??
        (mode === "refresh" ? "none" : hasKpiSnapshot ? "toast" : "none");
      const payload = await requestDashboardAlerts({ failure });

      if (payload) {
        setAlertsData(payload);
        hasAlertsDataRef.current = true;
        setAlertsError(null);
      } else if (mode === "initial" && !hasAlertsDataRef.current) {
        setAlertsError("Peringatan dan aktivitas terbaru belum bisa dimuat. Ringkasan operasional tetap ditampilkan.");
      }

      setAlertsLoading(false);
    },
    [kpiData, requestDashboardAlerts],
  );

  const loadDashboardKpis = useCallback(
    async (
      mode: "initial" | "refresh" = "refresh",
      dateFilter?: { dateFrom?: string; dateTo?: string },
      options?: { failure?: DashboardFetchFailure },
    ) => {
      if (mode === "initial") {
        setKpiLoading(true);
        setKpiSlow(false);
      }

      const hasExistingKpi = Boolean(kpiData);
      const failure =
        options?.failure ??
        (mode === "refresh" && hasExistingKpi ? "toast" : "modal");
      const payload = await requestDashboardKpis(dateFilter, { failure });

      if (payload) {
        setKpiData(payload);
        setKpiError(null);
      } else if (mode === "initial" && !hasExistingKpi) {
        setKpiError("Ringkasan dasbor belum bisa dimuat. Periksa koneksi lalu muat ulang.");
      }

      setKpiLoading(false);
      setKpiSlow(false);
    },
    [kpiData, requestDashboardKpis],
  );

  useEffect(() => {
    if (hasBootstrappedRef.current) return;

    let cancelled = false;
    const slowTimer = window.setTimeout(() => {
      if (!cancelled) setKpiSlow(true);
    }, KPI_SLOW_TIMEOUT_MS);

    async function bootstrapDashboard() {
      const kpiPayload = await requestDashboardKpis(
        { dateFrom, dateTo },
        { failure: "modal" },
      );
      if (cancelled) return;

      if (kpiPayload) {
        setKpiData(kpiPayload);
        setKpiError(null);
      } else {
        setKpiError("Ringkasan dasbor belum bisa dimuat. Periksa koneksi lalu muat ulang.");
      }

      setKpiLoading(false);
      setKpiSlow(false);
      window.clearTimeout(slowTimer);
      hasBootstrappedRef.current = true;
      dateFilterReadyRef.current = true;

      void loadDashboardAlerts("initial", { kpiLoaded: Boolean(kpiPayload) });
    }

    void bootstrapDashboard();
    return () => {
      cancelled = true;
      window.clearTimeout(slowTimer);
    };
  }, [loadDashboardAlerts, requestDashboardKpis]);

  useEffect(() => {
    if (!dateFilterReadyRef.current) return;
    void loadDashboardKpis("refresh", { dateFrom, dateTo });
  }, [dateFrom, dateTo, loadDashboardKpis]);

  const retryDashboardKpis = useCallback(() => {
    void loadDashboardKpis("initial", { dateFrom, dateTo });
  }, [dateFrom, dateTo, loadDashboardKpis]);

  useEffect(() => {
    async function loadSettings() {
      try {
        const response = await fetch("/api/settings", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as DashboardSettingsPayload;
        if (payload?.settings) {
          setRefreshSettings({
            autoRefresh: payload.settings.autoRefresh,
            refreshIntervalSeconds: payload.settings.refreshIntervalSeconds,
          });
        }
      } catch {
        // Keep default refresh settings when preferences cannot be loaded.
      }
    }
    void loadSettings();
  }, []);

  useEffect(() => {
    if (!refreshSettings.autoRefresh || !kpiData) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void Promise.all([
        loadDashboardKpis("refresh", { dateFrom, dateTo }, { failure: "none" }),
        loadDashboardAlerts("refresh", { failure: "none" }),
      ]);
    }, refreshSettings.refreshIntervalSeconds * 1000);
    return () => window.clearInterval(interval);
  }, [dateFrom, dateTo, kpiData, loadDashboardAlerts, loadDashboardKpis, refreshSettings]);

  /* ── Derived data ── */
  const internalData = useMemo<InternalDashboardData | null>(() => {
    if (!kpiData) return null;
    return {
      ...kpiData,
      alertSummary: alertsData?.alertSummary ?? EMPTY_ALERT_SUMMARY,
      auditIssues24h: alertsData?.auditIssues24h ?? 0,
      recentActivity: alertsData?.recentActivity ?? [],
    };
  }, [alertsData, kpiData]);

  const shipmentsToday = internalData?.shipmentsToday ?? EMPTY_SHIPMENTS;
  const flightsToday = internalData?.flightsSummary ?? EMPTY_FLIGHTS;
  const sortedFlights = useMemo(() => sortFlightsByCutoff(flightsToday), [flightsToday]);

  const activeLoaded = shipmentsToday.filter((s) => s.status === "loaded_to_aircraft").length;
  const holdsToday = internalData?.metrics.holds ?? 0;

  const onTime = internalData?.metrics.onTime ?? 0;
  const atRisk = internalData?.metrics.atRisk ?? 0;
  const delayed = internalData?.metrics.delayed ?? 0;
  const departed = internalData?.metrics.departed ?? 0;
  const activeFlights = internalData?.metrics.activeFlights ?? flightsToday.length;
  const inFlowCount = internalData?.metrics.inFlowCount ?? 0;
  const docReviewCount = internalData?.metrics.docReviewCount ?? 0;
  const actionRequiredCount = internalData?.metrics.actionRequiredCount ?? 0;
  const flightScope = internalData?.metrics.flightScope ?? "nearest";

  const alertSummary = internalData?.alertSummary ?? EMPTY_ALERT_SUMMARY;
  const openAlertsCount = alertSummary.open;
  const urgentAlertsCount = alertSummary.critical + alertSummary.warning;

  const totalRevenue = shipmentsToday.reduce((sum, shipment) => sum + shipment.shippingRate, 0);
  const reviewIssuesCount = docReviewCount;
  const deliveredCount = shipmentsToday.filter((shipment) => shipment.status === "arrived").length;
  const docPendingChartCount = useMemo(
    () =>
      shipmentsToday.filter(
        (shipment) =>
          shipment.status !== "hold" &&
          (shipment.docStatus === "Sebagian" || shipment.docStatus === "Ditinjau"),
      ).length,
    [shipmentsToday],
  );
  const shipmentFlowBars = useMemo(
    () => [
      { label: "Diterima", value: shipmentsToday.filter((shipment) => shipment.status === "received").length },
      { label: "Sortasi", value: shipmentsToday.filter((shipment) => shipment.status === "sortation").length },
      { label: "Muat", value: activeLoaded },
      { label: "Transit", value: shipmentsToday.filter((shipment) => shipment.status === "departed").length },
      { label: "Tiba", value: deliveredCount },
      { label: "Dokumen", value: docPendingChartCount },
    ],
    [activeLoaded, deliveredCount, docPendingChartCount, shipmentsToday],
  );

  const { hourlyTrend, peakRevenueLabel, totalRevenueFormatted } = useMemo(() => {
    const buckets = ["00-03", "04-07", "08-11", "12-15", "16-19", "20-23"].map((label) => ({
      label,
      value: 0,
      awbCount: 0,
    }));

    for (const shipment of shipmentsToday) {
      const hour = new Date(shipment.receivedAt).getHours();
      const bucket = Math.min(Math.floor(hour / 4), buckets.length - 1);
      buckets[bucket].value += shipment.shippingRate;
      buckets[bucket].awbCount += 1;
    }

    const peakBucket = buckets.reduce((best, bucket) => (bucket.value > best.value ? bucket : best), buckets[0]);
    const peakRevenueLabel = peakBucket?.value ? `Puncak jam ${peakBucket.label}` : "Belum ada penerimaan";

    return {
      hourlyTrend: buckets,
      peakRevenueLabel,
      totalRevenueFormatted: totalRevenue > 0 ? formatDashboardIdr(totalRevenue) : "—",
    };
  }, [shipmentsToday, totalRevenue]);

  const primarySummaryCards = [
    {
      href: "/shipment-ledger",
      label: "Pengiriman Aktif",
      value: shipmentsToday.length,
      icon: Boxes,
      tone: "primary" as const,
    },
    {
      href: "/alerts?workflow=open",
      label: "Belum Ditindak",
      value: alertsLoading && !alertsData ? "…" : openAlertsCount,
      icon: BellRing,
      tone: alertsLoading && !alertsData
        ? "info" as const
        : urgentAlertsCount > 0
          ? "danger" as const
          : openAlertsCount > 0
            ? "warning" as const
            : "success" as const,
    },
    {
      href: "/shipment-ledger?status=review",
      label: "Dokumen Sebagian",
      value: reviewIssuesCount,
      icon: ShieldAlert,
      tone: reviewIssuesCount ? "warning" as const : "info" as const,
    },
    {
      href: "/shipment-ledger?status=hold",
      label: "Tertahan",
      value: holdsToday,
      icon: TriangleAlert,
      tone: holdsToday ? "warning" as const : "info" as const,
    },
  ];


  const flightScheduleMetric =
    flightScope === "window"
      ? `${flightsToday.length} jadwal`
      : `${flightsToday.length} terdekat`;

  /* ── Filtered / paged data ── */
  const filteredShipments = useMemo(() => {
    if (!dashboardQuery) return shipmentsToday;
    return shipmentsToday.filter((s) => textMatchesQuery([s.awb, s.commodity, s.origin, s.destination, s.statusLabel, s.flightNumber], dashboardQuery));
  }, [dashboardQuery, shipmentsToday]);

  const dashboardExportQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (dashboardQuery.trim()) params.set("query", dashboardQuery.trim());
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    return params.toString();
  }, [dashboardQuery, dateFrom, dateTo]);

  const filteredFlights = useMemo(() => {
    if (!dashboardQuery) return sortedFlights;
    return sortedFlights.filter((f) => textMatchesQuery([f.flightNumber, f.route, f.statusLabel, f.airlineName], dashboardQuery));
  }, [dashboardQuery, sortedFlights]);

  const recentActivities = useMemo(() => {
    const items = internalData?.recentActivity ?? [];
    if (!dashboardQuery) return items;
    return items.filter((activity) =>
      textMatchesQuery([activity.action, activity.description, activity.targetLabel, activity.userName], dashboardQuery),
    );
  }, [dashboardQuery, internalData?.recentActivity]);

  const alertActivities = useMemo(
    () => recentActivities.filter((activity) => activity.level === "warning" || activity.level === "error"),
    [recentActivities],
  );






  if (!kpiLoading && !kpiData) {
    return (
      <OpsLockedPage
        className="dashboard-fixed-viewport gap-[14px] overflow-x-hidden"
        aria-label="Dasbor operasional gagal dimuat"
        body={
          <div className="rounded-[16px] border border-[color:var(--tone-danger-border)] bg-[color:var(--tone-danger-soft)] px-4 py-4 text-sm text-[color:var(--tone-danger)]">
            <p className="font-semibold">Gagal memuat dasbor</p>
            <p className="mt-1 text-[color:var(--muted-fg)]">
              {kpiError ?? "Ringkasan operasional belum bisa dimuat. Periksa koneksi atau coba lagi."}
            </p>
            <button
              type="button"
              onClick={retryDashboardKpis}
              className="btn btn-danger mt-4 min-w-[120px]"
            >
              Muat ulang
            </button>
          </div>
        }
      />
    );
  }

  if (kpiLoading && !kpiData) {
    return (
      <OpsLockedPage
        className="dashboard-fixed-viewport gap-[14px] overflow-x-hidden"
        aria-label="Memuat dasbor operasional"
        body={
        <>
        {kpiSlow ? (
          <div className="rounded-[16px] border border-[color:var(--tone-warning-border)] bg-[color:var(--tone-warning-soft)] px-4 py-3 text-sm text-[color:var(--tone-warning)]">
            <p className="font-semibold">Memuat lebih lama dari biasanya.</p>
            <p className="mt-1 text-[color:var(--muted-fg)]">Koneksi atau server mungkin sedang sibuk. Coba muat ulang ringkasan dasbor.</p>
            <button
              type="button"
              onClick={retryDashboardKpis}
              className="mt-3 inline-flex h-9 items-center rounded-full border border-[color:var(--tone-warning-border)] bg-[color:var(--panel-bg)] px-4 text-xs font-bold text-[color:var(--text-strong)] transition-colors hover:bg-[color:var(--panel-muted)]"
            >
              Muat ulang
            </button>
          </div>
        ) : null}
        <SkeletonBlock className="h-[58px] w-full rounded-[16px]" />
        <div className="dashboard-summary-strip dashboard-summary-strip--primary grid min-w-0 gap-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonBlock key={index} className="h-[58px] w-full rounded-[16px]" />
          ))}
        </div>
        <div className="dashboard-adaptive-row dashboard-analytics-row">
          <div className="grid min-h-[180px] gap-3 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <SkeletonBlock key={index} className="h-[180px] w-full rounded-[18px]" />
            ))}
          </div>
          <SkeletonBlock className="h-[180px] w-full rounded-[18px]" />
        </div>
        <div className="dashboard-adaptive-row dashboard-manifest-action-row">
          <OpsPanel className="flex h-full flex-col rounded-[18px] p-4">
            <SkeletonBlock className="h-8 w-48 rounded-[12px]" />
            <div className="mt-4 grid gap-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <SkeletonBlock key={index} className="h-[34px] w-full rounded-[12px]" />
              ))}
            </div>
          </OpsPanel>
          <OpsPanel className="flex h-full flex-col rounded-[18px] p-4">
            <SkeletonBlock className="h-8 w-44 rounded-[12px]" />
            <div className="mt-4 grid gap-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <SkeletonBlock key={index} className="h-[48px] w-full rounded-[12px]" />
              ))}
            </div>
          </OpsPanel>
        </div>
        </>
        }
      />
    );
  }

  /* ══════════════════════════════════════════════════════════════
     INTERNAL DASHBOARD, REDESIGNED SINGLE-VIEWPORT
     ══════════════════════════════════════════════════════════════ */
  return (
    <OpsLockedPage
      className="dashboard-viewport dashboard-fixed-viewport dashboard-operator-viewport gap-2.5 overflow-x-hidden"
      header={
        <PageHeader
          eyebrow="Ruang Kontrol"
          title="Pusat Kendali"
          className="sr-only"
        />
      }
      body={
      <div className="dashboard-operator-body flex h-full min-h-0 flex-col gap-1 overflow-hidden">
      {alertsError ? (
        <div className="shrink-0 rounded-[12px] border border-[color:var(--tone-warning-border)] bg-[color:var(--tone-warning-soft)] px-3 py-2 text-xs text-[color:var(--tone-warning)]">
          <p className="font-semibold">Peringatan dasbor belum lengkap</p>
          <p className="mt-0.5 text-[color:var(--muted-fg)]">{alertsError}</p>
          <button
            type="button"
            onClick={() => void loadDashboardAlerts("initial")}
            className="mt-2 inline-flex h-8 items-center rounded-full border border-[color:var(--tone-warning-border)] bg-[color:var(--panel-bg)] px-3 text-[11px] font-bold text-[color:var(--text-strong)] transition-colors hover:bg-[color:var(--panel-muted)]"
          >
            Muat ulang peringatan
          </button>
        </div>
      ) : null}
      <div className="dashboard-summary-strip dashboard-summary-strip--primary grid min-w-0 shrink-0 gap-1.5">
        {primarySummaryCards.map((card) => (
          <DashboardSummaryCard key={`${card.href}-${card.label}`} {...card} />
        ))}
      </div>

      <nav className="segmented-control flex shrink-0 gap-1.5 overflow-x-auto pb-0" aria-label="Panel dasbor operasional">
        {DASHBOARD_PANEL_TABS.map((tab) => {
          const active = dashboardPanel === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className={cn("ops-tab-button shrink-0", active && "ops-tab-button-active")}
              aria-current={active ? "page" : undefined}
              onClick={() => setDashboardPanel(tab.id)}
            >
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {dashboardPanel === "ringkasan" ? (
      <div className="dashboard-tab-panel dashboard-tab-panel--ringkasan min-h-0 flex-1 overflow-hidden">
      <div className="dashboard-adaptive-row dashboard-analytics-row min-h-0">
        <div className="dashboard-analytics-charts-grid grid h-full min-h-0 min-w-0 gap-2 overflow-hidden">
          <DashboardChartCard
            title="Alur Pengiriman"
            metric={`${inFlowCount} dalam alur`}
            accent={DONUT_INDIGO}
          >
            <ShipmentFlowOverview items={shipmentFlowBars} inFlowCount={inFlowCount} totalCount={shipmentsToday.length} />
          </DashboardChartCard>
          <DashboardChartCard
            title="Pendapatan Harian"
            className="dashboard-chart-card--revenue"
            metric={totalRevenueFormatted}
            metricNote={peakRevenueLabel}
            accent={DONUT_EMERALD}
            footerNote={
              <p className="text-[10px] leading-[1.45] text-[color:var(--muted-fg)]">
                Total = jumlah <span className="font-semibold text-[color:var(--text-strong)]">shippingRate</span> semua AWB
                pada tanggal filter ({shipmentsToday.length} AWB). Tiap AWB:{" "}
                <span className="font-semibold text-[color:var(--text-strong)]">tarif layanan × berat (kg)</span> (
                {SERVICE_RATE_EXPLANATION}). Grafik per blok jam{" "}
                <span className="font-semibold text-[color:var(--text-strong)]">receivedAt</span>; arahkan kursor untuk
                detail Rp dan jumlah AWB.
              </p>
            }
          >
            <TrendLineChart items={hourlyTrend} color={DONUT_EMERALD} />
          </DashboardChartCard>
          <DashboardChartCard
            title="Status Pesawat"
            metric={flightScheduleMetric}
            accent={DONUT_SKY}
          >
            <FlightDelayRecoveryPanel
              flights={flightsToday}
              shipments={shipmentsToday}
              onTime={onTime}
              delayed={delayed}
              atRisk={atRisk}
              departed={departed}
              onReassignComplete={async () => {
                await loadDashboardKpis("refresh", { dateFrom, dateTo }, { failure: "none" });
              }}
              showToast={showToast}
              showAlert={showAlert}
            />
          </DashboardChartCard>
        </div>

        <div className="dashboard-flight-sidebar h-full min-h-0 rounded-[16px] border border-[color:var(--border-soft)] bg-[color:var(--panel-bg)]/80 p-4 min-w-0">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <TowerControl size={16} className="shrink-0 text-[color:var(--brand-primary)]" />
              <p className="truncate text-[12px] font-bold uppercase tracking-[0.12em] text-[color:var(--muted-2)]">Jadwal Pesawat</p>
            </div>
            <Link href="/flight-board" className="shrink-0 text-[12px] font-bold text-[color:var(--brand-primary)] hover:underline">
              Semua
            </Link>
          </div>
          <div className="flex min-h-0 flex-col gap-2">
            {filteredFlights.length ? (
              filteredFlights.slice(0, 3).map((flight) => {
                const needsAction = isFlightNeedsRecovery(flight);
                return (
                  <div
                    key={flight.id}
                    className={cn(
                      "flex min-h-[44px] items-center gap-2 rounded-[12px] border px-3 py-2",
                      needsAction
                        ? "border-[color:var(--tone-warning-border)] bg-[color:var(--tone-warning-soft)]"
                        : flight.status === "departed"
                          ? "border-[color:var(--tone-success-border)] bg-[color:var(--tone-success-soft)]"
                          : "border-[color:var(--border-soft)] bg-[color:var(--panel-muted)]",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[13px] font-bold text-[color:var(--text-strong)]">{flight.flightNumber}</p>
                      <p className="truncate text-[11px] text-[color:var(--muted-fg)]">{flight.route}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted-fg)]">{flight.statusLabel}</span>
                      <Link
                        href={needsAction ? `/flight-board?id=${flight.id}&status=${flight.status}` : `/flight-board?id=${flight.id}`}
                        className="text-[11px] font-bold text-[color:var(--brand-primary)] hover:underline"
                      >
                        {needsAction ? "Atur" : "Buka"}
                      </Link>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="py-2 text-sm text-[color:var(--muted-fg)]">Belum ada penerbangan hari ini.</p>
            )}
          </div>
        </div>
      </div>
      </div>
      ) : null}

      {dashboardPanel === "aktivitas" ? (
      <div className="dashboard-tab-panel dashboard-tab-panel--aktivitas min-h-0 flex-1 overflow-hidden">
      <div className="dashboard-adaptive-row dashboard-manifest-action-row h-full min-h-0">
        <OpsPanel className="dashboard-manifest-panel rounded-[18px] p-5 min-w-0 overflow-hidden">
          <div className="flex h-[54px] shrink-0 items-start justify-between gap-3 border-b border-[color:var(--border-soft)]">
            <div className="min-w-0">
              <h2 className="truncate font-[family:var(--font-heading)] text-[18px] font-extrabold leading-6 tracking-[-0.03em] text-[color:var(--text-strong)]">Manifest Prioritas</h2>
              <p className="mt-0.5 truncate text-[13px] leading-[18px] text-[color:var(--muted-fg)]">{actionRequiredCount} manifest perlu tindakan</p>
            </div>
          </div>

          <div className="dashboard-manifest-panel-body">
          {!kpiLoading && filteredShipments.length > 0 ? (
                <div className="manifest-priority-scroll flex-1 overflow-x-auto">
                <div className="grid h-full min-h-[196px] min-w-[420px] shrink-0 grid-rows-[36px_repeat(4,minmax(40px,1fr))]">
                <div className="grid grid-cols-[minmax(120px,1fr)_minmax(100px,0.8fr)_minmax(88px,0.6fr)_72px] items-center gap-3 border-b border-[color:var(--border-soft)] px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[color:var(--muted-2)]">
                  <span>AWB</span>
                  <span>Status</span>
                  <span>Diperbarui</span>
                  <span className="text-right">Aksi</span>
                </div>
                {[...filteredShipments]
                  .sort((a, b) => {
                    const aPrio = a.status === "hold" || a.docStatus !== "Lengkap" ? 0 : 1;
                    const bPrio = b.status === "hold" || b.docStatus !== "Lengkap" ? 0 : 1;
                    if (aPrio !== bPrio) return aPrio - bPrio;
                    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
                  })
                  .slice(0, 4)
                  .map((shipment) => (
                    <Link
                      key={shipment.id}
                      href={`/shipment-ledger?id=${shipment.id}`}
                      className="grid h-[40px] grid-cols-[minmax(120px,1fr)_minmax(100px,0.8fr)_minmax(88px,0.6fr)_72px] items-center gap-3 border-b border-[color:var(--border-soft)] px-3 transition-colors last:border-b-0 hover:bg-[color:var(--panel-muted)]/70"
                    >
                      <span className="truncate font-mono text-xs font-semibold text-[color:var(--brand-primary)]">{shipment.awb}</span>
                      <MicroBadge value={shipment.status} label={shipment.statusLabel} />
                      <span className="truncate text-[11px] text-[color:var(--muted-fg)]">{formatRelativeShort(shipment.updatedAt)}</span>
                      <span className="inline-flex h-8 shrink-0 items-center justify-end text-[11px] font-bold text-[color:var(--brand-primary)]">
                        Buka
                      </span>
                    </Link>
                  ))}
              </div>
                </div>
          ) : kpiLoading ? (
            <div className="mt-4 flex flex-1 flex-col justify-center space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonBlock key={i} className="h-[34px] w-full rounded-[12px]" />
              ))}
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <EmptyState icon={Boxes} variant="neutral" title="Belum ada manifest aktif" copy="Manifest operasional hari ini akan muncul di area ini." className="py-0" />
            </div>
          )}
          </div>

          {!kpiLoading && filteredShipments.length > 0 ? (
            <div className="dashboard-manifest-panel-footer h-[42px]">
              <Link
                href="/shipment-ledger"
                className="inline-flex h-[36px] shrink-0 items-center gap-2 rounded-full border border-[color:var(--brand-primary-soft)] bg-[color:var(--brand-primary-soft)] px-5 text-sm font-bold text-[color:var(--brand-primary)] transition-all hover:bg-[color:var(--brand-primary)] hover:text-white"
              >
                <PackageSearch size={16} />
                Lihat semua di buku pengiriman
              </Link>
            </div>
          ) : null}
        </OpsPanel>

        <OpsPanel className="dashboard-manifest-panel dashboard-activity-panel w-full min-w-0 overflow-hidden rounded-[18px] p-5">
          <div className="flex h-[54px] shrink-0 items-start justify-between gap-3 border-b border-[color:var(--border-soft)] min-w-0">
            <div className="min-w-0">
              <h2 className="truncate font-[family:var(--font-heading)] text-[18px] font-extrabold leading-6 tracking-[-0.03em] text-[color:var(--text-strong)]">
                Aktivitas Terbaru
              </h2>
              <p className="mt-0.5 truncate text-[13px] leading-[17px] text-[color:var(--muted-fg)]">
                {recentActivities.length > 0 ? `${Math.min(3, recentActivities.length)} aktivitas terakhir` : "Belum ada aktivitas"}
              </p>
            </div>
          </div>

          <div className="dashboard-manifest-panel-body">
            {!alertsLoading && recentActivities.length > 0 ? (
              recentActivities.slice(0, 3).map((activity) => (
                <div
                  key={activity.id}
                  className="dashboard-activity-item min-h-[76px] w-full min-w-0 border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)]/80"
                >
                  <ActivityLevelDot level={activity.level} className="mt-1" />
                  <p className="min-w-0 text-[13px] font-bold leading-[18px] text-[color:var(--text-strong)]">{activity.action}</p>
                  <span className="shrink-0 whitespace-nowrap text-[11px] font-medium text-[color:var(--muted-2)]">
                    {formatRelativeShort(activity.createdAt)}
                  </span>
                  <p className="dashboard-activity-item-copy text-[12px] leading-[18px] text-[color:var(--muted-fg)]">
                    {activity.description}
                  </p>
                </div>
              ))
            ) : alertsLoading ? (
              <div className="flex flex-1 flex-col justify-center gap-2">
                {Array.from({ length: 3 }).map((_, index) => (
                  <SkeletonBlock key={index} className="h-[54px] w-full rounded-[14px]" />
                ))}
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center rounded-[12px] border border-dashed border-[color:var(--border-soft)]">
                <div className="text-center">
                  <History size={18} className="mx-auto text-[color:var(--brand-primary)]" />
                  <p className="mt-2 text-[12px] font-bold text-[color:var(--text-strong)]">Belum ada aktivitas</p>
                  <p className="mt-1 text-[11px] leading-[14px] text-[color:var(--muted-fg)]">Log operasional akan muncul setelah ada perubahan data.</p>
                </div>
              </div>
            )}
          </div>

          <div className="dashboard-manifest-panel-footer dashboard-activity-panel-footer h-[42px]">
            <Link
              href="/activity-log"
              className="dashboard-activity-panel-link inline-flex h-[36px] items-center gap-2 rounded-full border border-[color:var(--brand-primary-soft)] bg-[color:var(--brand-primary-soft)] px-5 text-sm font-bold text-[color:var(--brand-primary)] transition-all hover:bg-[color:var(--brand-primary)] hover:text-white"
            >
              <History size={16} />
              Lihat catatan lengkap
            </Link>
          </div>
        </OpsPanel>
      </div>
      </div>
      ) : null}

      {dashboardPanel === "peringatan" ? (
      <div className="dashboard-tab-panel dashboard-tab-panel--peringatan min-h-0 flex-1 overflow-hidden">
        <OpsPanel className="flex h-full min-h-0 flex-col overflow-hidden rounded-[18px] p-5">
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[color:var(--border-soft)] pb-3">
            <div className="min-w-0">
              <h2 className="truncate font-[family:var(--font-heading)] text-[18px] font-extrabold leading-6 tracking-[-0.03em] text-[color:var(--text-strong)]">
                Peringatan Operasional
              </h2>
              <p className="mt-0.5 truncate text-[13px] text-[color:var(--muted-fg)]">
                {alertsLoading && !alertsData
                  ? "Memuat..."
                  : `${openAlertsCount} terbuka · ${alertSummary.critical} kritis · ${alertSummary.warning} perhatian`}
              </p>
            </div>
            <Link
              href="/alerts?workflow=open"
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-[color:var(--brand-primary-soft)] bg-[color:var(--brand-primary-soft)] px-4 text-xs font-bold text-[color:var(--brand-primary)] transition-all hover:bg-[color:var(--brand-primary)] hover:text-white"
            >
              <BellRing size={14} />
              Buka pusat peringatan
            </Link>
          </div>

          <div className="mt-4 grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-3">
            {[
              {
                label: "Belum ditindak",
                value: alertsLoading && !alertsData ? "…" : openAlertsCount,
                href: "/alerts?workflow=open",
                tone: openAlertsCount > 0 ? ("danger" as const) : ("success" as const),
              },
              {
                label: "Kritis",
                value: alertsLoading && !alertsData ? "…" : alertSummary.critical,
                href: "/alerts?severity=critical",
                tone: "danger" as const,
              },
              {
                label: "Perhatian",
                value: alertsLoading && !alertsData ? "…" : alertSummary.warning,
                href: "/alerts?severity=warning",
                tone: "warning" as const,
              },
            ].map((item) => (
              <DashboardSummaryCard
                key={item.label}
                href={item.href}
                label={item.label}
                value={item.value}
                icon={BellRing}
                tone={item.tone}
              />
            ))}
          </div>

          <div className="mt-4 min-h-0 flex-1 overflow-hidden">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted-2)]">
              Aktivitas abnormal terbaru
            </p>
            {!alertsLoading && alertActivities.length > 0 ? (
              <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden">
                {alertActivities.slice(0, 4).map((activity) => (
                  <div
                    key={activity.id}
                    className="dashboard-activity-item min-h-[68px] w-full min-w-0 border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)]/80"
                  >
                    <ActivityLevelDot level={activity.level} className="mt-1" />
                    <p className="min-w-0 text-[13px] font-bold leading-[18px] text-[color:var(--text-strong)]">{activity.action}</p>
                    <span className="shrink-0 whitespace-nowrap text-[11px] font-medium text-[color:var(--muted-2)]">
                      {formatRelativeShort(activity.createdAt)}
                    </span>
                    <p className="dashboard-activity-item-copy text-[12px] leading-[18px] text-[color:var(--muted-fg)]">
                      {activity.description}
                    </p>
                  </div>
                ))}
              </div>
            ) : alertsLoading ? (
              <div className="grid gap-2">
                {Array.from({ length: 3 }).map((_, index) => (
                  <SkeletonBlock key={index} className="h-[54px] w-full rounded-[14px]" />
                ))}
              </div>
            ) : (
              <div className="flex h-full items-center justify-center rounded-[12px] border border-dashed border-[color:var(--border-soft)]">
                <EmptyState
                  icon={ShieldAlert}
                  variant="success"
                  title="Tidak ada peringatan aktif"
                  className="py-4"
                />
              </div>
            )}
          </div>
        </OpsPanel>
      </div>
      ) : null}
      </div>
      }
    />
  );
}


/* ── Activity Level Dot ── */
function ActivityLevelDot({ level, className }: { level: string; className?: string }) {
  const color =
    level === "error"
      ? "hsl(350, 89%, 60%)"
      : level === "warning"
        ? "hsl(38, 92%, 50%)"
        : level === "success"
          ? "hsl(142, 72%, 35%)"
          : "hsl(226, 70%, 50%)";

  return (
    <span
      className={cn("h-2.5 w-2.5 shrink-0 rounded-full", className)}
      style={{ backgroundColor: color }}
      aria-hidden="true"
    />
  );
}

/* ── Micro Badge ── */
function MicroBadge({ value, label }: { value: string; label: string }) {
  const toneMap: Record<string, string> = {
    arrived: "border-[color:var(--tone-success-border)] text-[color:var(--tone-success)] bg-[color:var(--tone-success-soft)]",
    departed: "border-[color:var(--tone-info-border)] text-[color:var(--tone-info)] bg-[color:var(--tone-info-soft)]",
    loaded_to_aircraft: "border-[color:var(--brand-primary)]/30 text-[color:var(--brand-primary)] bg-[color:var(--brand-primary-soft)]",
    sortation: "border-[color:var(--tone-info-border)] text-[color:var(--tone-info)] bg-[color:var(--tone-info-soft)]",
    received: "border-[color:var(--border-soft)] text-[color:var(--muted-fg)] bg-[color:var(--panel-muted)]",
    hold: "border-[color:var(--tone-warning-border)] text-[color:var(--tone-warning)] bg-[color:var(--tone-warning-soft)]",
  };

  return (
    <span className={cn("inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", toneMap[value] ?? "border-[color:var(--border-soft)] text-[color:var(--muted-fg)] bg-[color:var(--panel-muted)]")}>
      {label}
    </span>
  );
}
