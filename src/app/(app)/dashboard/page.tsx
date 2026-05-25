"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BellRing,
  Boxes,
  ChevronLeft,
  ChevronRight,
  FileCheck2,
  PackageCheck,
  PlaneTakeoff,
  RefreshCw,
  ShieldAlert,
  TowerControl,
} from "lucide-react";
import { cn, formatDateTime, formatRelativeShort, formatWeight } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState, OpsPanel, PageHeader, SectionHeader, StatCard } from "@/components/ops-ui";

type BaseShipment = {
  id: string;
  awb: string;
  commodity: string;
  origin: string;
  destination: string;
  pieces: number;
  weightKg: number;
  status: string;
  statusLabel: string;
  flightNumber: string | null;
  receivedAt: string;
  updatedAt: string;
  docStatus: string;
  documentSummary: {
    docStatus: string;
    count: number;
    latestUploadedAt: string | null;
  };
};

type InternalDashboardData = {
  variant: "internal";
  viewer: { role: "admin" | "staff" };
  metrics: {
    shipmentsToday: number;
    activeFlights: number;
    onTime: number;
    delayed: number;
    departed: number;
    holds: number;
  };
  flightsSummary: {
    id: string;
    flightNumber: string;
    route: string;
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
  alerts: {
    id: string;
    awb: string;
    title: string;
    detail: string;
  }[];
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

type CustomerDashboardData = {
  variant: "customer";
  viewer: {
    role: "customer";
    customerAccountName: string | null;
  };
  metrics: {
    activeShipments: number;
    actionRequired: number;
    pendingDocuments: number;
    arrived: number;
  };
  shipments: BaseShipment[];
  actionItems: {
    id: string;
    awb: string;
    title: string;
    detail: string;
  }[];
  documentSummary: {
    id: string;
    awb: string;
    docStatus: string;
    count: number;
    latestUploadedAt: string | null;
  }[];
  recentSearches: {
    id: string;
    awb: string;
    createdAt: string;
  }[];
};

type DashboardData = InternalDashboardData | CustomerDashboardData;

type DashboardSettingsPayload = {
  settings: {
    autoRefresh: boolean;
    refreshIntervalSeconds: number;
  } | null;
};

const DASHBOARD_PAGE_SIZE = 6;
const DASHBOARD_COMPACT_PAGE_SIZE = 5;
const DASHBOARD_FLIGHT_PAGE_SIZE = 3;
const DASHBOARD_ALERT_PAGE_SIZE = 4;
const DASHBOARD_COMPACT_ALERT_PAGE_SIZE = 3;

function toDateInputValue(value: string) {
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function getPageWindow<T>(items: T[], page: number, pageSize = DASHBOARD_PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  return {
    currentPage,
    totalPages,
    start,
    visibleStart: items.length ? start + 1 : 0,
    visibleEnd: Math.min(start + pageSize, items.length),
    items: items.slice(start, start + pageSize),
  };
}

function sortFlightsByCutoff<T extends { cargoCutoffTime: string; departureTime: string; status: string }>(flights: T[]) {
  const now = Date.now();

  return [...flights].sort((left, right) => {
    const leftCutoff = new Date(left.cargoCutoffTime).getTime();
    const rightCutoff = new Date(right.cargoCutoffTime).getTime();
    const leftDeparture = new Date(left.departureTime).getTime();
    const rightDeparture = new Date(right.departureTime).getTime();
    const leftDeparted = left.status === "departed" || leftDeparture < now;
    const rightDeparted = right.status === "departed" || rightDeparture < now;
    const leftUpcomingCutoff = leftCutoff >= now;
    const rightUpcomingCutoff = rightCutoff >= now;

    if (leftDeparted !== rightDeparted) return leftDeparted ? 1 : -1;
    if (leftUpcomingCutoff !== rightUpcomingCutoff) return leftUpcomingCutoff ? -1 : 1;
    if (leftUpcomingCutoff && rightUpcomingCutoff) return leftCutoff - rightCutoff;
    return rightCutoff - leftCutoff;
  });
}

function DashboardPagination({
  page,
  totalPages,
  visibleStart,
  visibleEnd,
  totalItems,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  visibleStart: number;
  visibleEnd: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="dashboard-pagination-footer">
      <button
        type="button"
        className="topbar-button"
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page <= 1}
      >
        <ChevronLeft size={16} />
      </button>
      <p>
        {visibleStart}-{visibleEnd} dari {totalItems}
      </p>
      <button
        type="button"
        className="topbar-button"
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

function textMatchesQuery(values: Array<string | number | null | undefined>, query: string) {
  const normalized = query.trim().toLowerCase();
  return !normalized || values.join(" ").toLowerCase().includes(normalized);
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dashboardQuery, setDashboardQuery] = useState("");
  const [dashboardShipmentPage, setDashboardShipmentPage] = useState(1);
  const [dashboardFlightPage, setDashboardFlightPage] = useState(1);
  const [dashboardAlertPage, setDashboardAlertPage] = useState(1);
  const [customerShipmentPage, setCustomerShipmentPage] = useState(1);
  const [compactViewport, setCompactViewport] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSummaryIndex, setActiveSummaryIndex] = useState(0);
  const [refreshSettings, setRefreshSettings] = useState({
    autoRefresh: true,
    refreshIntervalSeconds: 5,
  });

  useEffect(() => {
    function handleContextSearch(event: Event) {
      const detail = (event as CustomEvent<{ pathname?: string; query?: string }>).detail;
      if (detail?.pathname !== "/dashboard" || !detail.query) return;
      setDashboardQuery(detail.query);
      setDashboardShipmentPage(1);
      setDashboardFlightPage(1);
      setDashboardAlertPage(1);
      setCustomerShipmentPage(1);
    }

    window.addEventListener("skyhub:context-search", handleContextSearch as EventListener);
    return () => window.removeEventListener("skyhub:context-search", handleContextSearch as EventListener);
  }, []);

  useEffect(() => {
    const syncViewportDensity = () => {
      setCompactViewport(window.innerHeight <= 740 || window.innerWidth < 1366);
    };

    syncViewportDensity();
    window.addEventListener("resize", syncViewportDensity);
    return () => window.removeEventListener("resize", syncViewportDensity);
  }, []);

  const requestDashboard = useCallback(async () => {
    const response = await fetch("/api/dashboard", { cache: "no-store" });
    if (!response.ok) {
      return null;
    }

    return (await response.json()) as DashboardData;
  }, []);

  const applyDashboardPayload = useCallback((payload: DashboardData) => {
    setData(payload);
    setLoading(false);
  }, []);

  const loadDashboard = useCallback(async () => {
    const payload = await requestDashboard();
    if (!payload) {
      return;
    }

    applyDashboardPayload(payload);
  }, [applyDashboardPayload, requestDashboard]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadDashboard();
    } finally {
      setRefreshing(false);
    }
  }, [loadDashboard]);

  useEffect(() => {
    let cancelled = false;

    void requestDashboard().then((payload) => {
      if (!payload || cancelled) {
        return;
      }

      applyDashboardPayload(payload);
    });

    return () => {
      cancelled = true;
    };
  }, [applyDashboardPayload, requestDashboard]);

  useEffect(() => {
    async function loadSettings() {
      const response = await fetch("/api/settings", { cache: "no-store" });
      if (!response.ok) return;

      const payload = (await response.json()) as DashboardSettingsPayload;
      setRefreshSettings({
        autoRefresh: payload.settings?.autoRefresh ?? true,
        refreshIntervalSeconds: payload.settings?.refreshIntervalSeconds ?? 5,
      });
    }

    void loadSettings();
  }, []);

  useEffect(() => {
    if (!refreshSettings.autoRefresh) return;

    const timer = window.setInterval(() => {
      void loadDashboard();
    }, Math.max(5, refreshSettings.refreshIntervalSeconds) * 1000);

    return () => window.clearInterval(timer);
  }, [loadDashboard, refreshSettings.autoRefresh, refreshSettings.refreshIntervalSeconds]);

  const internalData = data?.variant === "internal" ? data : null;
  const customerData = data?.variant === "customer" ? data : null;

  const shipmentsToday = useMemo(() => internalData?.shipmentsToday ?? [], [internalData?.shipmentsToday]);
  const flightsToday = useMemo(() => internalData?.flightsSummary ?? [], [internalData?.flightsSummary]);
  const alertsToday = useMemo(() => internalData?.alerts ?? [], [internalData?.alerts]);

  const filteredShipments = shipmentsToday.filter((shipment) =>
    textMatchesQuery(
      [shipment.awb, shipment.commodity, shipment.origin, shipment.destination, shipment.statusLabel, shipment.flightNumber],
      dashboardQuery,
    ),
  );
  const filteredFlights = sortFlightsByCutoff(
    flightsToday.filter((flight) =>
      textMatchesQuery([flight.flightNumber, flight.route, flight.statusLabel, flight.airlineName, flight.aircraftType, flight.registration], dashboardQuery),
    ),
  );
  const filteredAlerts = alertsToday.filter((alert) =>
    textMatchesQuery([alert.awb, alert.title, alert.detail], dashboardQuery),
  );
  const shipmentPage = getPageWindow(
    filteredShipments,
    dashboardShipmentPage,
    compactViewport ? DASHBOARD_COMPACT_PAGE_SIZE : DASHBOARD_PAGE_SIZE,
  );
  const flightPage = getPageWindow(filteredFlights, dashboardFlightPage, DASHBOARD_FLIGHT_PAGE_SIZE);
  const alertPage = getPageWindow(
    filteredAlerts,
    dashboardAlertPage,
    compactViewport ? DASHBOARD_COMPACT_ALERT_PAGE_SIZE : DASHBOARD_ALERT_PAGE_SIZE,
  );
  const customerFilteredShipments = (customerData?.shipments ?? []).filter((shipment) =>
    textMatchesQuery([shipment.awb, shipment.commodity, shipment.origin, shipment.destination, shipment.statusLabel, shipment.flightNumber], dashboardQuery),
  );
  const customerShipmentWindow = getPageWindow(customerFilteredShipments, customerShipmentPage);
  const activeLoaded = shipmentsToday.filter((shipment) => shipment.status === "loaded_to_aircraft").length;
  const scheduledFlights = flightsToday.filter((flight) => flight.status === "on_time").length;
  const delayedFlights = flightsToday.filter((flight) => flight.status === "delayed").length;
  const departedFlights = flightsToday.filter((flight) => flight.status === "departed").length;
  const activeFlightSummary = `${scheduledFlights} terjadwal, ${delayedFlights} terlambat, ${departedFlights} berangkat.`;
  const shipmentFlowTotal = Math.max(1, shipmentsToday.length);
  const flightFlowTotal = Math.max(1, flightsToday.length);
  const actionFlowTotal = Math.max(1, shipmentsToday.length + alertsToday.length);
  const toShare = (value: number, total: number) => (value ? Math.max(7, Math.round((value / total) * 100)) : 0);
  const shipmentFlowSegments = [
    { label: "Diterima", value: shipmentsToday.filter((shipment) => shipment.status === "received").length, tone: "primary" },
    { label: "Sortasi", value: shipmentsToday.filter((shipment) => shipment.status === "sortation").length, tone: "info" },
    { label: "Siap Muat", value: activeLoaded, tone: "success" },
    { label: "Berangkat/Tiba", value: shipmentsToday.filter((shipment) => shipment.status === "departed" || shipment.status === "arrived").length, tone: "neutral" },
    { label: "Tertahan", value: shipmentsToday.filter((shipment) => shipment.status === "hold").length, tone: "warning" },
  ] as const;
  const flightFlowSegments = [
    { label: "Terjadwal", value: scheduledFlights, tone: "success" },
    { label: "Terlambat", value: delayedFlights, tone: "warning" },
    { label: "Berangkat", value: departedFlights, tone: "info" },
  ] as const;
  const actionFlowSegments = [
    { label: "Normal", value: Math.max(0, shipmentsToday.length - alertsToday.length), tone: "success" },
    { label: "Perlu Tindakan", value: alertsToday.length, tone: "warning" },
  ] as const;
  const flowLanes = [
    {
      label: "Alur Shipment",
      value: shipmentsToday.length,
      helper: `${activeLoaded} siap muat dari ${shipmentsToday.length} shipment`,
      total: shipmentFlowTotal,
      segments: shipmentFlowSegments,
    },
    {
      label: "Status Flight",
      value: flightsToday.length,
      helper: activeFlightSummary,
      total: flightFlowTotal,
      segments: flightFlowSegments,
    },
    {
      label: "Beban Tindakan",
      value: alertsToday.length,
      helper: `${alertsToday.length} alert dari ${shipmentsToday.length} shipment`,
      total: actionFlowTotal,
      segments: actionFlowSegments,
    },
  ] as const;
  const operatorSummaryItems = [
    {
      label: "Kargo Masuk",
      value: shipmentsToday.length,
      note: "Semua manifest hari ini.",
      icon: Boxes,
      tone: "primary",
    },
    {
      label: "Flight Aktif",
      value: flightsToday.length,
      note: activeFlightSummary,
      icon: PlaneTakeoff,
      tone: "info",
    },
    {
      label: "Sudah Muat",
      value: activeLoaded,
      note: "Shipment siap masuk proses keberangkatan.",
      icon: PackageCheck,
      tone: "success",
    },
    {
      label: "Perlu Tindakan",
      value: alertsToday.length,
      note: "Alert aktif untuk operasional hari ini.",
      icon: ShieldAlert,
      tone: "warning",
    },
  ] as const;
  const summaryTotal = operatorSummaryItems.reduce((total, item) => total + item.value, 0);
  const activeSummary = operatorSummaryItems[activeSummaryIndex] ?? operatorSummaryItems[0];

  if (customerData) {
    return (
      <div className="page-workspace dashboard-viewport h-full min-h-0">
        <PageHeader
          eyebrow="Portal Pelanggan"
          title="Dashboard Pelanggan"
          subtitle={`Ringkasan shipment milik ${customerData.viewer.customerAccountName || "akun Anda"} dengan status, dokumen, dan pencarian AWB terbaru.`}
          actions={
            <button type="button" className="topbar-button" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw size={16} className={refreshing ? "animate-spin" : undefined} />
              <span>{refreshing ? "Memuat..." : "Muat ulang"}</span>
            </button>
          }
        />

        <div className="grid gap-4 xl:grid-cols-4">
          <StatCard label="Shipment Aktif" value={loading ? "..." : customerData.metrics.activeShipments} note="Shipment akun Anda yang masih berada dalam proses operasional." icon={Boxes} tone="primary" />
          <StatCard label="Perlu Tindakan" value={loading ? "..." : customerData.metrics.actionRequired} note="Shipment dengan hold, dokumen belum lengkap, atau masih perlu tindak lanjut." icon={ShieldAlert} tone="warning" />
          <StatCard label="Dokumen Pending" value={loading ? "..." : customerData.metrics.pendingDocuments} note="Jumlah shipment dengan status dokumen yang masih diproses." icon={FileCheck2} tone="info" />
          <StatCard label="Tiba" value={loading ? "..." : customerData.metrics.arrived} note="Shipment yang sudah tercatat tiba di tujuan." icon={PackageCheck} tone="success" />
        </div>

        <div className="page-grid-2">
          <OpsPanel className="page-pane p-5">
            <SectionHeader
              title="Shipment Saya"
              subtitle="Daftar shipment yang terhubung ke akun pelanggan Anda."
              action={
                <Link href="/shipment-ledger" className="btn btn-secondary">
                  Buka ledger
                </Link>
              }
            />

            <div className="page-scroll mt-4 table-shell">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>AWB</th>
                    <th>Komoditas</th>
                    <th>Status</th>
                    <th>Dokumen</th>
                    <th>Terakhir Update</th>
                  </tr>
                </thead>
                <tbody>
                  {customerFilteredShipments.length ? (
                    customerShipmentWindow.items.map((shipment) => (
                      <tr key={shipment.id}>
                        <td className="font-mono text-sm font-semibold text-[color:var(--brand-primary)]">{shipment.awb}</td>
                        <td>
                          <p className="font-semibold text-[color:var(--text-strong)]">{shipment.commodity}</p>
                          <p className="mt-1 text-xs text-[color:var(--muted-fg)]">
                            {shipment.origin}{" -> "}{shipment.destination}
                          </p>
                        </td>
                        <td>
                          <StatusBadge value={shipment.status} label={shipment.statusLabel} />
                        </td>
                        <td>
                          <p className="text-sm font-semibold text-[color:var(--text-strong)]">{shipment.documentSummary.docStatus}</p>
                          <p className="mt-1 text-xs text-[color:var(--muted-fg)]">{shipment.documentSummary.count} dokumen tercatat</p>
                        </td>
                        <td className="text-sm text-[color:var(--muted-fg)]">{formatRelativeShort(shipment.updatedAt)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5}>
                        <EmptyState
                          icon={Boxes}
                          title="Belum ada shipment"
                          copy="Shipment yang terhubung ke akun pelanggan Anda akan tampil di sini setelah diproses tim internal."
                          className="m-4"
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <DashboardPagination
              page={customerShipmentWindow.currentPage}
              totalPages={customerShipmentWindow.totalPages}
              visibleStart={customerShipmentWindow.visibleStart}
              visibleEnd={customerShipmentWindow.visibleEnd}
              totalItems={customerFilteredShipments.length}
              onPageChange={setCustomerShipmentPage}
            />
          </OpsPanel>

          <div className="page-stack">
            <OpsPanel className="page-pane p-5">
              <SectionHeader title="Perlu Tindakan" subtitle="Shipment yang masih memerlukan pemantauan." />
              <div className="page-scroll mt-4 space-y-3">
                {customerData.actionItems.length ? (
                  customerData.actionItems.map((item) => (
                    <div key={item.id} className="rounded-[22px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-[color:var(--tone-warning)]">{item.title}</p>
                          <p className="mt-2 text-sm leading-6 text-[color:var(--text-strong)]">{item.detail}</p>
                        </div>
                        <BellRing size={18} className="shrink-0 text-[color:var(--tone-warning)]" />
                      </div>
                      <Link href={`/awb-tracking?awb=${item.awb}`} className="mt-4 inline-flex text-sm font-semibold text-[color:var(--brand-primary)]">
                        Buka pelacakan
                      </Link>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    icon={ShieldAlert}
                    title="Tidak ada tindakan terbuka"
                    copy="Semua shipment akun Anda saat ini berada pada jalur proses normal."
                  />
                )}
              </div>
            </OpsPanel>

            <OpsPanel className="page-pane p-5">
              <SectionHeader title="Ringkasan Dokumen" subtitle="Status dokumen per shipment tanpa membuka file mentah." />
              <div className="page-scroll mt-4 space-y-3">
                {customerData.documentSummary.length ? (
                  customerData.documentSummary.map((item) => (
                    <div key={item.id} className="rounded-[22px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-mono text-sm font-semibold text-[color:var(--brand-primary)]">{item.awb}</p>
                          <p className="mt-2 text-sm font-semibold text-[color:var(--text-strong)]">{item.docStatus}</p>
                        </div>
                        <StatusBadge value={item.docStatus === "Complete" ? "success" : "warning"} label={`${item.count} dokumen`} />
                      </div>
                      <p className="mt-3 text-xs text-[color:var(--muted-fg)]">
                        {item.latestUploadedAt ? `Upload terakhir ${formatDateTime(item.latestUploadedAt)}` : "Belum ada timestamp upload"}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[color:var(--muted-fg)]">Belum ada ringkasan dokumen.</p>
                )}
              </div>
            </OpsPanel>

            <OpsPanel className="page-pane p-5">
              <SectionHeader title="Pencarian AWB Terakhir" subtitle="Riwayat lookup AWB akun Anda." />
              <div className="page-scroll mt-4 space-y-3">
                {customerData.recentSearches.length ? (
                  customerData.recentSearches.map((item) => (
                    <Link
                      key={item.id}
                      href={`/awb-tracking?awb=${encodeURIComponent(item.awb)}`}
                      className="flex items-center justify-between rounded-[22px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-4 py-4"
                    >
                      <span className="font-mono text-sm font-semibold text-[color:var(--brand-primary)]">{item.awb}</span>
                      <span className="text-xs text-[color:var(--muted-fg)]">{formatRelativeShort(item.createdAt)}</span>
                    </Link>
                  ))
                ) : (
                  <p className="text-sm text-[color:var(--muted-fg)]">Belum ada pencarian AWB terbaru.</p>
                )}
              </div>
            </OpsPanel>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-workspace dashboard-viewport h-full min-h-0">
      <section className="dashboard-summary-chart" aria-label="Ringkasan operasional interaktif">
        <div className="dashboard-summary-copy">
          <p>Ringkasan Operasional</p>
          <span>{loading ? "Memuat data operasional" : `Hari ini | ${summaryTotal} sinyal aktif`}</span>
        </div>
        <div className="dashboard-flow-chart" aria-live="polite">
          <div className="dashboard-flow-focus">
            <span>{activeSummary.label}</span>
            <strong>{loading ? "..." : activeSummary.value}</strong>
            <small>{activeSummary.note}</small>
          </div>
          <div className="dashboard-flow-lanes" role="img" aria-label="Chart alur operasional hari ini">
            {flowLanes.map((lane) => (
              <div key={lane.label} className="dashboard-flow-lane">
                <div className="dashboard-flow-lane-header">
                  <span>{lane.label}</span>
                  <strong>{loading ? "..." : lane.value}</strong>
                </div>
                <div className="dashboard-flow-stack" aria-hidden="true">
                  {lane.segments.map((segment) => (
                    <span
                      key={segment.label}
                      className={cn("dashboard-flow-segment", `dashboard-flow-${segment.tone}`)}
                      style={{ width: `${loading ? 0 : toShare(segment.value, lane.total)}%` }}
                    />
                  ))}
                </div>
                <p>{lane.helper}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="dashboard-summary-selector" role="list" aria-label="Pilih metrik ringkasan operasional">
          {operatorSummaryItems.map((item, index) => {
            const Icon = item.icon;
            const selected = activeSummary.label === item.label;

            return (
              <button
                key={item.label}
                type="button"
                className={cn("dashboard-summary-metric", `dashboard-summary-${item.tone}`, selected && "dashboard-summary-metric-active")}
                aria-pressed={selected}
                onClick={() => setActiveSummaryIndex(index)}
                onFocus={() => setActiveSummaryIndex(index)}
                onMouseEnter={() => setActiveSummaryIndex(index)}
              >
                <span className="dashboard-summary-step-icon" aria-hidden="true">
                  <Icon size={15} />
                </span>
                <div className="dashboard-summary-step-copy">
                  <strong>{loading ? "..." : item.value}</strong>
                  <span>{item.label}</span>
                </div>
              </button>
            );
          })}
        </div>
        <div className="dashboard-summary-actions">
          <button type="button" className="topbar-button" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw size={16} className={refreshing ? "animate-spin" : undefined} />
            <span>{refreshing ? "Memuat..." : "Muat ulang"}</span>
          </button>
        </div>
      </section>

      <OpsPanel className="dashboard-cutoff-panel p-4">
        <div className="dashboard-cutoff-header">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-[color:var(--brand-primary-soft)] text-[color:var(--brand-primary)]">
              <TowerControl size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-2)]">Mendekati Cutoff</p>
              <h2 className="truncate font-[family:var(--font-heading)] text-lg font-extrabold tracking-[-0.02em] text-[color:var(--text-strong)]">Papan Flight</h2>
            </div>
          </div>
          <DashboardPagination
            page={flightPage.currentPage}
            totalPages={flightPage.totalPages}
            visibleStart={flightPage.visibleStart}
            visibleEnd={flightPage.visibleEnd}
            totalItems={filteredFlights.length}
            onPageChange={setDashboardFlightPage}
          />
        </div>
        <div className="dashboard-cutoff-list">
          {filteredFlights.length ? (
            flightPage.items.map((flight) => (
              <div key={flight.id} className="dashboard-cutoff-card">
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="truncate font-[family:var(--font-heading)] text-lg font-black text-[color:var(--text-strong)]">{flight.flightNumber}</p>
                    <StatusBadge value={flight.status} label={flight.statusLabel} className="shrink-0" />
                  </div>
                  <p className="mt-1 truncate text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--muted-2)]">
                    {flight.airlineName} | {flight.route}
                  </p>
                </div>
                <div className="dashboard-cutoff-meta">
                  <span>Cutoff {formatDateTime(flight.cargoCutoffTime)}</span>
                  <span>Berangkat {formatDateTime(flight.departureTime)}</span>
                </div>
                {flight.cutoffAtRisk ? (
                  <p className="dashboard-cutoff-warning">Cutoff mendekat</p>
                ) : null}
                <div className="dashboard-cutoff-actions">
                  <Link href={`/flight-board?date=${encodeURIComponent(toDateInputValue(flight.departureTime))}&query=${encodeURIComponent(flight.flightNumber)}`}>
                    Ubah flight
                  </Link>
                  <Link href={`/shipment-ledger?flight=${encodeURIComponent(flight.id)}`}>Verifikasi kargo</Link>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-[color:var(--muted-fg)]">Tidak ada flight aktif hari ini.</p>
          )}
        </div>
      </OpsPanel>

      <div className="dashboard-main flex-1">
        <OpsPanel className="dashboard-panel p-4 xl:p-5">
          <SectionHeader
            title="Papan Operasional"
            subtitle="Manifest operasional hari ini tanpa pemisahan shift."
            action={
              <Link href="/shipment-ledger" className="btn btn-secondary">
                Buka ledger
              </Link>
            }
          />

          <div className="dashboard-table-stack">
            <div className="dashboard-table-scroll table-shell">
              <table className="data-table dashboard-manifest-table">
                <thead>
                  <tr>
                    <th>AWB</th>
                    <th>Komoditas</th>
                    <th>Rute</th>
                    <th>Status</th>
                    <th>Flight</th>
                    <th>Update</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredShipments.length ? (
                    shipmentPage.items.map((shipment) => (
                      <tr key={shipment.id}>
                        <td className="font-mono text-sm font-semibold text-[color:var(--brand-primary)]">{shipment.awb}</td>
                        <td>
                          <p className="font-semibold text-[color:var(--text-strong)]">{shipment.commodity}</p>
                          <p className="mt-1 text-xs text-[color:var(--muted-fg)]">
                            {formatWeight(shipment.weightKg)} | {shipment.pieces} pcs
                          </p>
                        </td>
                        <td>{shipment.origin}{" -> "}{shipment.destination}</td>
                        <td>
                          <StatusBadge value={shipment.status} label={shipment.statusLabel} />
                        </td>
                        <td>{shipment.flightNumber ?? "-"}</td>
                        <td className="text-sm text-[color:var(--muted-fg)]">{formatRelativeShort(shipment.updatedAt)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6}>
                        <EmptyState
                          icon={Boxes}
                          title="Belum ada shipment hari ini"
                          copy="Dashboard tetap aktif, tetapi belum ada manifest yang masuk untuk operasional hari ini."
                          className="m-4"
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <DashboardPagination
              page={shipmentPage.currentPage}
              totalPages={shipmentPage.totalPages}
              visibleStart={shipmentPage.visibleStart}
              visibleEnd={shipmentPage.visibleEnd}
              totalItems={filteredShipments.length}
              onPageChange={setDashboardShipmentPage}
            />
          </div>
        </OpsPanel>

        <OpsPanel className="dashboard-panel p-4 xl:p-5">
          <SectionHeader title="Pusat Tindakan" subtitle="AWB yang membutuhkan intervensi tim staff operasional." />
          <div className="dashboard-alert-scroll mt-4 space-y-3">
            {filteredAlerts.length ? (
              alertPage.items.map((alert) => (
                <div key={alert.id} className="dashboard-alert-item rounded-[18px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[color:var(--tone-warning)]">{alert.title}</p>
                      <p className="dashboard-alert-detail mt-1 text-sm leading-6 text-[color:var(--text-strong)]">{alert.detail}</p>
                    </div>
                    <BellRing size={16} className="shrink-0 text-[color:var(--tone-warning)]" />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Link href={`/awb-tracking?awb=${alert.awb}`} className="inline-flex text-sm font-semibold text-[color:var(--brand-primary)]">
                      Buka pelacakan
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState icon={BellRing} title="Tidak ada alert kritis" copy="Semua shipment hari ini berada dalam kondisi normal atau sudah tertangani." />
            )}
          </div>
          <DashboardPagination
            page={alertPage.currentPage}
            totalPages={alertPage.totalPages}
            visibleStart={alertPage.visibleStart}
            visibleEnd={alertPage.visibleEnd}
            totalItems={filteredAlerts.length}
            onPageChange={setDashboardAlertPage}
          />
        </OpsPanel>
      </div>
    </div>
  );
}
