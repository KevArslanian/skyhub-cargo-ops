"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  BellRing,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
} from "lucide-react";
import { EmptyState, FilterBar, OpsPanel, PageHeader, SectionHeader, StatCard } from "@/components/ops-ui";
import { StatusBadge } from "@/components/status-badge";
import { cn, formatDateTime, formatRelativeShort } from "@/lib/format";

type AlertSeverity = "critical" | "warning" | "info";

type AlertCenterPayload = {
  generatedAt: string;
  summary: {
    total: number;
    critical: number;
    warning: number;
    info: number;
    unreadNotifications: number;
  };
  alerts: {
    id: string;
    kind: string;
    title: string;
    detail: string;
    severity: AlertSeverity;
    tone: string;
    entityType: string;
    entityLabel: string;
    href: string;
    route: string;
    station: string;
    ownerName: string;
    statusLabel: string;
    recommendedAction: string;
    cause: string;
    clearCondition: string;
    targetModule: string;
    triggeredAt: string;
    ageMinutes: number;
  }[];
  conditionChecks: {
    id: string;
    label: string;
    count: number;
    status: "action" | "normal";
    statusLabel: string;
    detail: string;
    mechanism: string;
  }[];
  environmentMechanisms: {
    title: string;
    detail: string;
  }[];
};

type AlertRow = AlertCenterPayload["alerts"][number];

const severityLabels: Record<string, string> = {
  all: "Semua severity",
  critical: "Kritis",
  warning: "Warning",
  info: "Info",
};

const ALERT_PAGE_SIZE = 12;

function formatAge(minutes: number) {
  if (minutes < 60) return `${minutes} menit`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} jam ${rest} menit` : `${hours} jam`;
}

export default function AlertsPage() {
  const [data, setData] = useState<AlertCenterPayload | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState("all");
  const [kind, setKind] = useState("all");
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [alertPage, setAlertPage] = useState(1);

  useEffect(() => {
    function handleContextSearch(event: Event) {
      const detail = (event as CustomEvent<{ pathname?: string; query?: string }>).detail;
      if (detail?.pathname !== "/alerts" || !detail.query) return;
      setQuery(detail.query);
      setAlertPage(1);
    }

    window.addEventListener("skyhub:context-search", handleContextSearch as EventListener);
    return () => window.removeEventListener("skyhub:context-search", handleContextSearch as EventListener);
  }, []);

  async function loadAlerts() {
    const response = await fetch("/api/alerts", { cache: "no-store" });
    if (!response.ok) return;
    const payload = (await response.json()) as AlertCenterPayload;
    setData(payload);
  }

  useEffect(() => {
    void loadAlerts();
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await loadAlerts();
    } finally {
      setRefreshing(false);
    }
  }

  const kindOptions = useMemo(() => {
    return Array.from(new Set((data?.alerts ?? []).map((alert) => alert.kind))).sort();
  }, [data?.alerts]);

  const filteredAlerts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return (data?.alerts ?? []).filter((alert) => {
      const matchesSeverity = severity === "all" || alert.severity === severity;
      const matchesKind = kind === "all" || alert.kind === kind;
      const matchesQuery =
        !normalizedQuery ||
        [
          alert.title,
          alert.detail,
          alert.entityLabel,
          alert.route,
          alert.station,
          alert.ownerName,
          alert.recommendedAction,
          alert.cause,
          alert.clearCondition,
          alert.targetModule,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);

      return matchesSeverity && matchesKind && matchesQuery;
    });
  }, [data?.alerts, kind, query, severity]);

  const totalAlertPages = Math.max(1, Math.ceil(filteredAlerts.length / ALERT_PAGE_SIZE));
  const currentAlertPage = Math.min(alertPage, totalAlertPages);
  const pageStartIndex = (currentAlertPage - 1) * ALERT_PAGE_SIZE;
  const paginatedAlerts = useMemo(() => {
    return filteredAlerts.slice(pageStartIndex, pageStartIndex + ALERT_PAGE_SIZE);
  }, [filteredAlerts, pageStartIndex]);
  const visibleStart = filteredAlerts.length ? pageStartIndex + 1 : 0;
  const visibleEnd = Math.min(pageStartIndex + paginatedAlerts.length, filteredAlerts.length);

  const selectedAlert = useMemo<AlertRow | null>(() => {
    return paginatedAlerts.find((alert) => alert.id === selectedAlertId) ?? paginatedAlerts[0] ?? null;
  }, [paginatedAlerts, selectedAlertId]);

  useEffect(() => {
    if (!filteredAlerts.length) {
      setSelectedAlertId(null);
      return;
    }

    if (!selectedAlertId || !paginatedAlerts.some((alert) => alert.id === selectedAlertId)) {
      setSelectedAlertId((paginatedAlerts[0] ?? filteredAlerts[0]).id);
    }
  }, [filteredAlerts, paginatedAlerts, selectedAlertId]);

  useEffect(() => {
    setAlertPage(1);
  }, [kind, query, severity]);

  useEffect(() => {
    setAlertPage((current) => Math.min(current, totalAlertPages));
  }, [totalAlertPages]);

  return (
    <div className="page-workspace alerts-viewport">
      <PageHeader
        eyebrow="Alert Center"
        title="Pusat Alert Operasional"
        subtitle="Daftar masalah yang dibuat otomatis dari aturan shipment, flight, dokumen, readiness, dan kapasitas."
        actions={
          <>
            <button type="button" className="topbar-button" onClick={handleRefresh}>
              <RefreshCw size={16} className={cn(refreshing && "animate-spin")} />
              <span>{refreshing ? "Memuat..." : "Muat ulang"}</span>
            </button>
            <div className="topbar-button hidden xl:flex">
              <Clock3 size={16} />
              <span>{data ? formatRelativeShort(data.generatedAt) : "Belum dimuat"}</span>
            </div>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Butuh Tindakan"
          value={data?.summary.total ?? 0}
          note="Alert aktif dari aturan sistem."
          icon={BellRing}
          tone="primary"
        />
        <StatCard
          label="Kritis"
          value={data?.summary.critical ?? 0}
          note="Perlu diselesaikan lebih dulu."
          icon={ShieldAlert}
          tone="danger"
        />
        <StatCard
          label="Warning"
          value={data?.summary.warning ?? 0}
          note="Risiko operasional belum fatal."
          icon={Clock3}
          tone="warning"
        />
        <StatCard
          label="Normal Check"
          value={(data?.conditionChecks ?? []).filter((item) => item.status === "normal").length}
          note={`${data?.conditionChecks.length ?? 0} aturan dipantau.`}
          icon={CheckCircle2}
          tone="success"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.45fr)]">
        <OpsPanel className="p-5">
          <SectionHeader title="Evaluasi Aturan" subtitle="Alert aktif jika count melewati batas aman. Jika data diperbaiki, alert hilang otomatis." />
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(data?.conditionChecks ?? []).map((item) => (
              <div key={item.id} className="ops-panel-muted p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[color:var(--text-strong)]">{item.label}</p>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--muted-fg)]">{item.detail}</p>
                  </div>
                  <StatusBadge value={item.status === "action" ? "warning" : "success"} label={item.statusLabel} />
                </div>
                <p className="mt-3 text-xs leading-5 text-[color:var(--muted-2)]">{item.mechanism}</p>
              </div>
            ))}
          </div>
        </OpsPanel>

        <OpsPanel className="p-5">
          <SectionHeader title="Mekanisme Selesai" subtitle="Tidak ada tombol selesai manual. Status alert mengikuti data sumber." />
          <div className="mt-5 space-y-3">
            {(data?.environmentMechanisms ?? []).slice(0, 4).map((item) => (
              <div key={item.title} className="ops-panel-muted p-4">
                <p className="font-semibold text-[color:var(--text-strong)]">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-[color:var(--muted-fg)]">{item.detail}</p>
              </div>
            ))}
          </div>
        </OpsPanel>
      </div>

      <FilterBar className="alerts-filter-bar xl:grid-cols-[minmax(0,1fr)_minmax(0,220px)_minmax(0,220px)_auto]">
        <div>
          <label className="label">Cari alert</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[color:var(--muted-2)]" size={16} />
            <input
              className="input-field input-field-leading"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="AWB, flight, station, aksi..."
            />
          </div>
        </div>
        <div>
          <label className="label">Severity</label>
          <select className="select-field" value={severity} onChange={(event) => setSeverity(event.target.value)}>
            {Object.entries(severityLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Jenis</label>
          <select className="select-field" value={kind} onChange={(event) => setKind(event.target.value)}>
            <option value="all">Semua jenis</option>
            {kindOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
        <div className="topbar-button self-end">
          <SlidersHorizontal size={16} />
          <span>{filteredAlerts.length} tampil</span>
        </div>
      </FilterBar>

      <div className="alerts-content-grid grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.55fr)]">
        <OpsPanel className="page-pane alerts-panel p-5">
          <SectionHeader title="Daftar Alert" subtitle="Klik row untuk detail." />
          <div className="page-scroll internal-scrollbar alerts-table-scroll mt-5 table-shell">
            {paginatedAlerts.length ? (
              <table className="data-table min-w-[920px]">
                <thead>
                  <tr>
                    <th>Severity</th>
                    <th>Jenis</th>
                    <th>Entity</th>
                    <th>Rute</th>
                    <th>Umur</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedAlerts.map((alert) => {
                    const selected = selectedAlert?.id === alert.id;
                    return (
                      <tr
                        key={alert.id}
                        className={selected ? "flight-manifest-row-active cursor-pointer" : "cursor-pointer"}
                        onClick={() => setSelectedAlertId(alert.id)}
                      >
                        <td>
                          <StatusBadge value={alert.tone} label={severityLabels[alert.severity]} />
                        </td>
                        <td>
                          <StatusBadge value={alert.entityType === "flight" ? "live" : "review"} label={alert.kind} />
                        </td>
                        <td>
                          <p className="font-semibold text-[color:var(--text-strong)]">{alert.entityLabel}</p>
                          <p className="text-xs text-[color:var(--muted-fg)]">{alert.title}</p>
                        </td>
                        <td>{alert.route}</td>
                        <td>{formatAge(alert.ageMinutes)}</td>
                        <td>{alert.statusLabel}</td>
                        <td>
                          <Link
                            href={alert.href}
                            className="topbar-button"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <ArrowUpRight size={15} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <EmptyState
                icon={BellRing}
                title="Tidak ada alert pada filter ini"
                copy="Tidak ada data."
                className="m-4"
              />
            )}
          </div>
          <div className="alerts-pagination-footer">
            <button
              type="button"
              className="topbar-button"
              onClick={() => setAlertPage((current) => Math.max(1, current - 1))}
              disabled={currentAlertPage <= 1}
            >
              <ChevronLeft size={16} />
              Sebelumnya
            </button>
            <p>
              {visibleStart}-{visibleEnd} dari {filteredAlerts.length} • Halaman {currentAlertPage}/{totalAlertPages}
            </p>
            <button
              type="button"
              className="topbar-button"
              onClick={() => setAlertPage((current) => Math.min(totalAlertPages, current + 1))}
              disabled={currentAlertPage >= totalAlertPages}
            >
              Berikutnya
              <ChevronRight size={16} />
            </button>
          </div>
        </OpsPanel>

        <OpsPanel className="page-pane alerts-panel p-5">
          <SectionHeader title="Detail Alert" subtitle={selectedAlert ? selectedAlert.entityLabel : "Pilih alert"} />
          {selectedAlert ? (
            <div className="page-scroll internal-scrollbar alerts-detail-scroll mt-5 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge value={selectedAlert.tone} label={severityLabels[selectedAlert.severity]} />
                <StatusBadge
                  value={selectedAlert.entityType === "flight" ? "live" : "review"}
                  label={selectedAlert.kind}
                />
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--muted-2)]">
                  {selectedAlert.station}
                </span>
              </div>

              <div>
                <h2 className="font-[family:var(--font-heading)] text-2xl font-black tracking-[-0.04em] text-[color:var(--text-strong)]">
                  {selectedAlert.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[color:var(--muted-fg)]">{selectedAlert.detail}</p>
              </div>

              <div className="grid gap-3">
                <div className="ops-panel-muted p-4">
                  <p className="label">Rute</p>
                  <p className="mt-2 font-semibold text-[color:var(--text-strong)]">{selectedAlert.route}</p>
                </div>
                <div className="ops-panel-muted p-4">
                  <p className="label">Umur</p>
                  <p className="mt-2 font-semibold text-[color:var(--text-strong)]">
                    {formatAge(selectedAlert.ageMinutes)}
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--muted-fg)]">
                    {formatDateTime(selectedAlert.triggeredAt)}
                  </p>
                </div>
                <div className="ops-panel-muted p-4">
                  <p className="label">Owner</p>
                  <p className="mt-2 font-semibold text-[color:var(--text-strong)]">{selectedAlert.ownerName}</p>
                </div>
                <div className="ops-panel-muted p-4">
                  <p className="label">Penyebab</p>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--muted-fg)]">{selectedAlert.cause}</p>
                </div>
                <div className="ops-panel-muted p-4">
                  <p className="label">Aksi</p>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--muted-fg)]">
                    {selectedAlert.recommendedAction}
                  </p>
                </div>
                <div className="ops-panel-muted p-4">
                  <p className="label">Kriteria Selesai</p>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--muted-fg)]">{selectedAlert.clearCondition}</p>
                </div>
                <div className="ops-panel-muted p-4">
                  <p className="label">Modul Tujuan</p>
                  <p className="mt-2 font-semibold text-[color:var(--text-strong)]">{selectedAlert.targetModule}</p>
                </div>
              </div>

              <Link href={selectedAlert.href} className="btn btn-primary w-full justify-center">
                <ArrowUpRight size={16} />
                Buka Data
              </Link>
            </div>
          ) : (
            <EmptyState icon={BellRing} title="Tidak ada alert" copy="Tidak ada data." className="m-0" />
          )}
        </OpsPanel>
      </div>
    </div>
  );
}
