"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BellRing,
  Boxes,
  ChevronLeft,
  ChevronRight,
  FileCheck2,
  History,
  PackageCheck,
  PackageSearch,
  PlaneTakeoff,
  ShieldAlert,
  TowerControl,
  TriangleAlert,
  TrendingUp,
} from "lucide-react";
import { cn, formatDateTime, formatRelativeShort, formatWeight } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState, OpsPanel, PageHeader, SectionHeader, SkeletonBlock, StatCard } from "@/components/ops-ui";
import { MiniDonutGroup, type DonutSegment } from "@/components/donut-chart";

/* ── Premium HSL Palette ── */
const DONUT_INDIGO = "hsl(226, 70%, 50%)";
const DONUT_EMERALD = "hsl(142, 72%, 35%)";
const DONUT_AMBER = "hsl(38, 92%, 50%)";
const DONUT_ROSE = "hsl(350, 89%, 60%)";
const DONUT_SLATE = "hsl(215, 15%, 85%)";
const DONUT_SKY = "hsl(200, 80%, 55%)";

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
const DASHBOARD_FLIGHT_PAGE_SIZE = 4;
const DASHBOARD_ALERT_PAGE_SIZE = 4;

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

function DashboardPagination({
  page, totalPages, visibleStart, visibleEnd, totalItems, onPageChange,
}: {
  page: number; totalPages: number; visibleStart: number; visibleEnd: number; totalItems: number; onPageChange: (p: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[color:var(--muted-fg)]">
      <button type="button" className="topbar-button h-8 px-3 text-xs" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1}>
        <ChevronLeft size={14} />
      </button>
      <span className="tabular-nums whitespace-nowrap">{visibleStart}-{visibleEnd} / {totalItems}</span>
      <button type="button" className="topbar-button h-8 px-3 text-xs" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages}>
        <ChevronRight size={14} />
      </button>
    </div>
  );
}

function textMatchesQuery(values: Array<string | number | null | undefined>, query: string) {
  const n = query.trim().toLowerCase();
  return !n || values.join(" ").toLowerCase().includes(n);
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dashboardQuery, setDashboardQuery] = useState("");
  const [dashboardShipmentPage, setDashboardShipmentPage] = useState(1);
  const [dashboardFlightPage, setDashboardFlightPage] = useState(1);
  const [dashboardAlertPage, setDashboardAlertPage] = useState(1);
  const [customerShipmentPage, setCustomerShipmentPage] = useState(1);
  const [refreshSettings, setRefreshSettings] = useState({ autoRefresh: true, refreshIntervalSeconds: 5 });

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

  const requestDashboard = useCallback(async () => {
    const response = await fetch("/api/dashboard", { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as DashboardData;
  }, []);

  const applyDashboardPayload = useCallback((payload: DashboardData) => {
    setData(payload);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void requestDashboard().then((payload) => {
      if (!payload || cancelled) return;
      applyDashboardPayload(payload);
    });
    return () => { cancelled = true; };
  }, [applyDashboardPayload, requestDashboard]);

  useEffect(() => {
    async function loadSettings() {
      const response = await fetch("/api/settings", { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as DashboardSettingsPayload;
      if (payload?.settings) {
        setRefreshSettings({
          autoRefresh: payload.settings.autoRefresh,
          refreshIntervalSeconds: payload.settings.refreshIntervalSeconds,
        });
      }
    }
    void loadSettings();
  }, []);

  useEffect(() => {
    if (!refreshSettings.autoRefresh) return;
    const interval = window.setInterval(() => {
      void requestDashboard().then((payload) => {
        if (payload) applyDashboardPayload(payload);
      });
    }, refreshSettings.refreshIntervalSeconds * 1000);
    return () => window.clearInterval(interval);
  }, [applyDashboardPayload, refreshSettings, requestDashboard]);

  /* ── Derived data ── */
  const internalData = data?.variant === "internal" ? data : null;
  const customerData = data?.variant === "customer" ? data : null;

  const shipmentsToday = internalData?.shipmentsToday ?? [];
  const flightsToday = internalData?.flightsSummary ?? [];
  const alertsToday = internalData?.alerts ?? [];
  const sortedFlights = useMemo(() => sortFlightsByCutoff(flightsToday), [flightsToday]);

  const activeLoaded = shipmentsToday.filter((s) => s.status === "loaded_to_aircraft").length;
  const holdsToday = internalData?.metrics.holds ?? 0;
  const inProcess = shipmentsToday.length - activeLoaded - holdsToday;

  const onTime = internalData?.metrics.onTime ?? 0;
  const delayed = internalData?.metrics.delayed ?? 0;
  const departed = internalData?.metrics.departed ?? 0;

  const actionUrgent = alertsToday.length;
  const actionControlled = Math.max(0, 8 - actionUrgent);

  /* ── Donut chart data ── */
  const shipmentDonut: DonutSegment[] = [
    { label: "Sudah Muat", value: activeLoaded, color: DONUT_EMERALD },
    { label: "Diproses", value: Math.max(0, inProcess), color: DONUT_INDIGO },
    { label: "Tertahan", value: holdsToday, color: DONUT_AMBER },
  ];
  const shipmentDonutTotal = shipmentsToday.length || 0;

  const flightDonut: DonutSegment[] = [
    { label: "On-Time", value: onTime, color: DONUT_EMERALD },
    { label: "Delayed", value: delayed, color: DONUT_AMBER },
    { label: "Departed", value: departed, color: DONUT_SKY },
  ];
  const flightDonutTotal = flightsToday.length || 0;

  const actionDonut: DonutSegment[] = [
    { label: "Mendesak", value: actionUrgent, color: DONUT_ROSE },
    { label: "Terkendali", value: actionControlled, color: DONUT_SLATE },
  ];
  const actionDonutTotal = 8;

  const donutCharts = [
    { title: "Alur Shipment", total: shipmentDonutTotal, segments: shipmentDonut },
    { title: "Status Flight", total: flightDonutTotal, segments: flightDonut },
    { title: "Beban Tindakan", total: actionDonutTotal, segments: actionDonut },
  ];

  /* ── Filtered / paged data ── */
  const filteredShipments = useMemo(() => {
    if (!dashboardQuery) return shipmentsToday;
    return shipmentsToday.filter((s) => textMatchesQuery([s.awb, s.commodity, s.origin, s.destination, s.statusLabel, s.flightNumber], dashboardQuery));
  }, [dashboardQuery, shipmentsToday]);

  const filteredFlights = useMemo(() => {
    if (!dashboardQuery) return sortedFlights;
    return sortedFlights.filter((f) => textMatchesQuery([f.flightNumber, f.route, f.statusLabel, f.airlineName], dashboardQuery));
  }, [dashboardQuery, sortedFlights]);

  const filteredAlerts = useMemo(() => {
    if (!dashboardQuery) return alertsToday;
    return alertsToday.filter((a) => textMatchesQuery([a.awb, a.title, a.detail], dashboardQuery));
  }, [dashboardQuery, alertsToday]);

  const shipmentPage = getPageWindow(filteredShipments, dashboardShipmentPage, DASHBOARD_PAGE_SIZE);
  const flightPage = getPageWindow(filteredFlights, dashboardFlightPage, DASHBOARD_FLIGHT_PAGE_SIZE);
  const alertPage = getPageWindow(filteredAlerts, dashboardAlertPage, DASHBOARD_ALERT_PAGE_SIZE);

  const customerFilteredShipments = useMemo(() => {
    if (!customerData || !dashboardQuery) return customerData?.shipments ?? [];
    return (customerData.shipments ?? []).filter((s) => textMatchesQuery([s.awb, s.commodity, s.statusLabel], dashboardQuery));
  }, [customerData, dashboardQuery]);

  const customerShipmentWindow = getPageWindow(customerFilteredShipments, customerShipmentPage, DASHBOARD_COMPACT_PAGE_SIZE);

  /* ── Customer dashboard (unchanged) ── */
  if (customerData) {
    return (
      <div className="page-workspace h-full min-h-0 overflow-y-auto">
        <PageHeader
          eyebrow="Portal Pelanggan"
          title="Dashboard Pelanggan"
          subtitle={`Ringkasan shipment milik ${customerData.viewer.customerAccountName || "akun Anda"}.`}
        />
        <div className="grid gap-4 xl:grid-cols-4">
          <StatCard label="Shipment Aktif" value={loading ? <SkeletonBlock className="mt-4 h-9 w-16 rounded-[10px]" /> : customerData.metrics.activeShipments} note="Dalam proses." icon={Boxes} tone="primary" />
          <StatCard label="Perlu Tindakan" value={loading ? <SkeletonBlock className="mt-4 h-9 w-16 rounded-[10px]" /> : customerData.metrics.actionRequired} note="Hold / dokumen." icon={ShieldAlert} tone="warning" />
          <StatCard label="Dokumen Pending" value={loading ? <SkeletonBlock className="mt-4 h-9 w-16 rounded-[10px]" /> : customerData.metrics.pendingDocuments} note="Masih diproses." icon={FileCheck2} tone="info" />
          <StatCard label="Tiba" value={loading ? <SkeletonBlock className="mt-4 h-9 w-16 rounded-[10px]" /> : customerData.metrics.arrived} note="Sudah di tujuan." icon={PackageCheck} tone="success" />
        </div>
        <div className="page-grid-2">
          <OpsPanel className="page-pane p-5">
            <SectionHeader title="Shipment Saya" subtitle="Shipment terhubung ke akun Anda." action={<Link href="/shipment-ledger" className="btn btn-secondary">Buka ledger</Link>} />
            <div className="page-scroll mt-4 table-shell">
              <table className="data-table">
                <thead><tr><th>AWB</th><th>Komoditas</th><th>Status</th><th>Dokumen</th><th>Update</th></tr></thead>
                <tbody>
                  {customerFilteredShipments.length ? customerShipmentWindow.items.map((s) => (
                    <tr key={s.id}>
                      <td className="font-mono text-sm font-semibold text-[color:var(--brand-primary)]">{s.awb}</td>
                      <td><p className="font-semibold text-[color:var(--text-strong)]">{s.commodity}</p><p className="mt-1 text-xs text-[color:var(--muted-fg)]">{s.origin} → {s.destination}</p></td>
                      <td><StatusBadge value={s.status} label={s.statusLabel} /></td>
                      <td><p className="text-sm font-semibold">{s.documentSummary.docStatus}</p><p className="mt-1 text-xs text-[color:var(--muted-fg)]">{s.documentSummary.count} dokumen</p></td>
                      <td className="text-sm text-[color:var(--muted-fg)]">{formatRelativeShort(s.updatedAt)}</td>
                    </tr>
                  )) : (<tr><td colSpan={5}><EmptyState icon={Boxes} title="Belum ada shipment" copy="Shipment Anda akan tampil di sini." className="m-4" /></td></tr>)}
                </tbody>
              </table>
            </div>
            <DashboardPagination page={customerShipmentWindow.currentPage} totalPages={customerShipmentWindow.totalPages} visibleStart={customerShipmentWindow.visibleStart} visibleEnd={customerShipmentWindow.visibleEnd} totalItems={customerFilteredShipments.length} onPageChange={setCustomerShipmentPage} />
          </OpsPanel>
          <div className="page-stack">
            <OpsPanel className="page-pane p-5">
              <SectionHeader title="Perlu Tindakan" subtitle="Shipment perlu pemantauan." />
              <div className="page-scroll mt-4 space-y-3">
                {customerData.actionItems.length ? customerData.actionItems.map((item) => (
                  <div key={item.id} className="rounded-[22px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-4 py-4">
                    <div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-[color:var(--tone-warning)]">{item.title}</p><p className="mt-2 text-sm text-[color:var(--text-strong)]">{item.detail}</p></div><BellRing size={18} className="shrink-0 text-[color:var(--tone-warning)]" /></div>
                    <Link href={`/awb-tracking?awb=${item.awb}`} className="mt-4 inline-flex text-sm font-semibold text-[color:var(--brand-primary)]">Buka pelacakan</Link>
                  </div>
                )) : (<EmptyState icon={ShieldAlert} title="Tidak ada tindakan" copy="Semua shipment dalam jalur normal." />)}
              </div>
            </OpsPanel>
            <OpsPanel className="page-pane p-5">
              <SectionHeader title="Ringkasan Dokumen" subtitle="Status dokumen per shipment." />
              <div className="page-scroll mt-4 space-y-3">
                {customerData.documentSummary.length ? customerData.documentSummary.map((item) => (
                  <div key={item.id} className="rounded-[22px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-4 py-4">
                    <div className="flex items-start justify-between gap-3"><div><p className="font-mono text-sm font-semibold text-[color:var(--brand-primary)]">{item.awb}</p><p className="mt-2 text-sm font-semibold">{item.docStatus}</p></div><StatusBadge value={item.docStatus === "Complete" ? "success" : "warning"} label={`${item.count} dokumen`} /></div>
                    <p className="mt-3 text-xs text-[color:var(--muted-fg)]">{item.latestUploadedAt ? `Upload ${formatDateTime(item.latestUploadedAt)}` : "Belum ada upload"}</p>
                  </div>
                )) : (<p className="text-sm text-[color:var(--muted-fg)]">Belum ada ringkasan.</p>)}
              </div>
            </OpsPanel>
          </div>
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════
     INTERNAL DASHBOARD — REDESIGNED SINGLE-VIEWPORT
     ══════════════════════════════════════════════════════════════ */
  return (
    <div className="flex h-full flex-col gap-3 overflow-x-hidden">
      {/* ── ROW 1: Analitik + Cutoff ── */}
      <div className="grid grid-cols-1 gap-5 items-start xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* Analitik Operasional */}
        <div className="rounded-[20px] border border-[color:var(--border-soft)] bg-[color:var(--panel-bg)]/80 px-4 py-3 sm:px-5 sm:py-4 min-w-0">
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp size={16} className="text-[color:var(--brand-primary)]" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-2)]">Analitik Operasional</p>
          </div>
          <MiniDonutGroup charts={donutCharts} />
        </div>

        {/* Mendekati Cutoff */}
        <div className="rounded-[20px] border border-[color:var(--border-soft)] bg-[color:var(--panel-bg)]/80 px-3 py-2 sm:px-3 sm:py-2.5 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] bg-[color:var(--brand-primary-soft)] text-[color:var(--brand-primary)]">
                <TowerControl size={14} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted-2)]">Mendekati Cutoff</p>
              </div>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {filteredFlights.length ? sortedFlights.slice(0, 4).map((flight) => (
              <button
                key={flight.id}
                type="button"
                className={cn(
                  "inline-flex items-center gap-2 rounded-[12px] border px-3 py-1.5 text-xs font-semibold transition-all hover:-translate-y-px hover:shadow-md",
                  flight.cutoffAtRisk
                    ? "border-[color:var(--tone-warning-border)] bg-[color:var(--tone-warning-soft)] text-[color:var(--tone-warning)]"
                    : flight.status === "departed"
                    ? "border-[color:var(--tone-success-border)] bg-[color:var(--tone-success-soft)] text-[color:var(--tone-success)]"
                    : "border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] text-[color:var(--text-strong)]"
                )}
              >
                <span className="font-mono">{flight.flightNumber}</span>
                <span className="text-[10px] text-[color:var(--muted-2)]">{flight.route}</span>
                {flight.cutoffAtRisk ? <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: DONUT_AMBER }} /> : null}
                <span className="text-[10px] uppercase tracking-wider text-[color:var(--muted-fg)]">{flight.statusLabel}</span>
              </button>
            )) : (
              <p className="py-1 text-xs text-[color:var(--muted-fg)]">Belum ada flight untuk hari ini.</p>
            )}
          </div>
        </div>
      </div>

      {/* ── ROW 2: Manifest Prioritas + Pusat Tindakan ── */}
      <div className="grid grid-cols-1 gap-5 items-start xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* Manifest Prioritas */}
        <OpsPanel className="p-4 sm:p-5 min-w-0">
          <SectionHeader
            title="Manifest Prioritas"
            subtitle={`${filteredShipments.length} manifest aktif hari ini`}
          />

          {!loading && filteredShipments.length > 0 ? (
            <>
              <div className="mt-4 space-y-1.5">
                {filteredShipments
                  .sort((a, b) => {
                    const aPrio = a.status === 'hold' || a.docStatus === 'Review' ? 0 : 1;
                    const bPrio = b.status === 'hold' || b.docStatus === 'Review' ? 0 : 1;
                    if (aPrio !== bPrio) return aPrio - bPrio;
                    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
                  })
                  .slice(0, 5)
                  .map((shipment) => (
                    <Link
                      key={shipment.id}
                      href={`/shipment-ledger?id=${shipment.id}`}
                      className="flex items-center gap-3 rounded-[14px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)]/70 px-3 py-2.5 transition-colors hover:bg-[color:var(--panel-muted)]"
                    >
                      <span className="w-[110px] shrink-0 font-mono text-xs font-semibold text-[color:var(--brand-primary)] truncate">{shipment.awb}</span>
                      <span className="min-w-0 flex-1 truncate text-xs font-medium text-[color:var(--text-strong)]">{shipment.commodity}</span>
                      <span className="hidden sm:inline w-[80px] shrink-0 text-[11px] text-[color:var(--muted-fg)] truncate">{shipment.origin} → {shipment.destination}</span>
                      <MicroBadge value={shipment.status} label={shipment.statusLabel} />
                      <span className="text-[11px] font-semibold text-[color:var(--brand-primary)] shrink-0">Buka</span>
                    </Link>
                  ))}
              </div>
              <div className="mt-4 flex justify-end">
                <Link
                  href="/shipment-ledger"
                  className="inline-flex items-center gap-2 rounded-full border border-[color:var(--brand-primary-soft)] bg-[color:var(--brand-primary-soft)] px-5 py-2.5 text-sm font-bold text-[color:var(--brand-primary)] transition-all hover:bg-[color:var(--brand-primary)] hover:text-white"
                >
                  <PackageSearch size={16} />
                  Lihat semua di Ledger
                </Link>
              </div>
            </>
          ) : loading ? (
            <div className="mt-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonBlock key={i} className="h-[52px] w-full rounded-[14px]" />
              ))}
            </div>
          ) : (
            <EmptyState icon={Boxes} variant="neutral" title="Belum ada manifest aktif" copy="Manifest operasional hari ini akan muncul di area ini." className="py-6" />
          )}
        </OpsPanel>

        {/* Pusat Tindakan */}
        <OpsPanel className="flex min-h-0 flex-col p-4 sm:p-5 min-w-0 w-full">
          <div className="flex-none min-w-0">
            <SectionHeader title="Pusat Tindakan" subtitle={filteredAlerts.length > 0 ? `${alertPage.visibleStart}-${alertPage.visibleEnd} dari ${filteredAlerts.length} alert` : "0 alert"} />
          </div>
          <div className="mt-2 flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-2 scrollbar-thin min-w-0">
            {filteredAlerts.length ? alertPage.items.map((alert) => (
              <div key={alert.id} className="w-full min-w-0 rounded-[14px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)]/80 px-3 py-2.5 transition-colors hover:bg-[color:var(--panel-muted)]">
                <div className="flex items-start gap-3 min-w-0">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: DONUT_ROSE }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold leading-5 text-[color:var(--text-strong)] break-words">{alert.title}</p>
                    <p className="mt-1 text-[11px] leading-5 text-[color:var(--muted-fg)] whitespace-normal break-words">{alert.detail}</p>
                    <div className="mt-2">
                      <Link href={`/awb-tracking?awb=${alert.awb}`} className="text-[11px] font-semibold text-[color:var(--brand-primary)] hover:underline break-words">
                        Buka AWB {alert.awb}
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )) : (
              <EmptyState icon={BellRing} title="Tidak ada alert" copy="Semua shipment dalam kondisi normal." />
            )}
          </div>
          <div className="flex-none border-t border-[color:var(--border-soft)] pt-3 min-w-0">
            <DashboardPagination page={alertPage.currentPage} totalPages={alertPage.totalPages} visibleStart={alertPage.visibleStart} visibleEnd={alertPage.visibleEnd} totalItems={filteredAlerts.length} onPageChange={setDashboardAlertPage} />
          </div>
        </OpsPanel>
      </div>

      {/* ── ROW 3: Aktivitas Terakhir ── */}
      {internalData?.recentActivity && internalData.recentActivity.length > 0 ? (
        <div className="rounded-[20px] border border-[color:var(--border-soft)] bg-[color:var(--panel-bg)]/80 px-3 py-2 sm:px-4 sm:py-2.5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <History size={16} className="text-[color:var(--brand-primary)]" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-2)]">Aktivitas Terakhir</p>
            </div>
            <Link href="/activity-log" className="text-[11px] font-semibold text-[color:var(--brand-primary)] hover:underline">
              Lihat semua aktivitas
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {internalData!.recentActivity.slice(0, 3).map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 rounded-[14px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)]/60 px-3 py-2.5 min-w-0">
                <div className={cn(
                  "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px]",
                  activity.level === "warning" ? "bg-[color:var(--tone-warning-soft)] text-[color:var(--tone-warning)]" :
                  activity.level === "error" ? "bg-[color:var(--tone-danger-soft)] text-[color:var(--tone-danger)]" :
                  "bg-[color:var(--tone-info-soft)] text-[color:var(--tone-info)]"
                )}>
                  {activity.level === "warning" ? <ShieldAlert size={14} /> :
                   activity.level === "error" ? <TriangleAlert size={14} /> :
                   <FileCheck2 size={14} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-[color:var(--text-strong)] truncate">{activity.action}</p>
                  <p className="mt-0.5 text-[11px] text-[color:var(--muted-fg)] truncate">{activity.description}</p>
                  <p className="mt-1 text-[10px] text-[color:var(--muted-2)]">{activity.userName} · {formatRelativeShort(activity.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}


/* ── Mini Stat Card (compact) ── */
function MiniStatCard({ label, value, note, icon: Icon, tone }: { label: string; value: React.ReactNode; note: string; icon: React.ComponentType<{ size?: number }>; tone: "primary" | "success" | "warning" | "info" }) {
  const toneBg: Record<string, string> = {
    primary: "bg-[color:var(--brand-primary-soft)] text-[color:var(--brand-primary)]",
    success: "bg-[color:var(--tone-success-soft)] text-[color:var(--tone-success)]",
    warning: "bg-[color:var(--tone-warning-soft)] text-[color:var(--tone-warning)]",
    info: "bg-[color:var(--tone-info-soft)] text-[color:var(--tone-info)]",
  };

  return (
    <div className="rounded-[18px] border border-[color:var(--border-soft)] bg-[color:var(--panel-bg)]/80 px-3 py-3 shadow-[0_8px_24px_rgba(11,30,52,0.04)] backdrop-blur transition-all hover:-translate-y-px hover:shadow-[0_12px_28px_rgba(11,30,52,0.08)] sm:px-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted-2)]">{label}</p>
          <p className="mt-1.5 font-[family:var(--font-heading)] text-xl font-black tracking-[-0.04em] text-[color:var(--text-strong)]">{value}</p>
          <p className="mt-1 text-[10px] leading-4 text-[color:var(--muted-fg)]">{note}</p>
        </div>
        <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px]", toneBg[tone])}>
          <Icon size={15} />
        </div>
      </div>
    </div>
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
