"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, BellRing, Clock3, FileCheck2, RefreshCw, Search, ShieldAlert, SlidersHorizontal, TriangleAlert } from "lucide-react";
import { DataCard, EmptyState, FilterBar, OpsPanel, PageHeader, SectionHeader, StatCard } from "@/components/ops-ui";
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

const severityLabels: Record<string, string> = {
  all: "Semua severity",
  critical: "Kritis",
  warning: "Warning",
  info: "Info",
};

function getSeverityTone(severity: AlertSeverity) {
  if (severity === "critical") return "danger";
  if (severity === "warning") return "warning";
  return "info";
}

function formatAge(minutes: number) {
  if (minutes < 60) return `${minutes} menit`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} jam ${rest} menit` : `${hours} jam`;
}

export default function AlertsPage() {
  const [data, setData] = useState<AlertCenterPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState("all");
  const [kind, setKind] = useState("all");

  async function loadAlerts() {
    const response = await fetch("/api/alerts", { cache: "no-store" });
    if (!response.ok) return;
    const payload = (await response.json()) as AlertCenterPayload;
    setData(payload);
  }

  useEffect(() => {
    void loadAlerts().finally(() => setLoading(false));
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
        [alert.title, alert.detail, alert.entityLabel, alert.route, alert.station, alert.ownerName, alert.recommendedAction]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);

      return matchesSeverity && matchesKind && matchesQuery;
    });
  }, [data?.alerts, kind, query, severity]);

  return (
    <div className="page-workspace">
      <PageHeader
        eyebrow="Alert Center"
        title="Pusat Alert Operasional"
        subtitle="Alert shipment, cutoff flight, kapasitas manifest, dan update data."
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

      <div className="grid gap-4 xl:grid-cols-4">
        <StatCard label="Total Alert" value={loading ? "..." : data?.summary.total ?? 0} note="Alert aktif." icon={BellRing} tone="primary" />
        <StatCard label="Kritis" value={loading ? "..." : data?.summary.critical ?? 0} note="Prioritas tinggi." icon={ShieldAlert} tone="danger" />
        <StatCard label="Warning" value={loading ? "..." : data?.summary.warning ?? 0} note="Perlu dicek." icon={TriangleAlert} tone="warning" />
        <StatCard label="Notifikasi" value={loading ? "..." : data?.summary.unreadNotifications ?? 0} note="Belum dibaca." icon={FileCheck2} tone="info" />
      </div>

      <FilterBar className="xl:grid-cols-[minmax(0,1fr)_minmax(0,220px)_minmax(0,220px)_auto]">
        <div>
          <label className="label">Cari alert</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--muted-2)]" size={16} />
            <input className="input-field pl-10" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="AWB, flight, station, aksi..." />
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

      <div className="grid gap-4">
        <OpsPanel className="page-pane p-5">
          <SectionHeader title="Daftar Alert" subtitle="Urut berdasarkan prioritas." />
          <div className="page-scroll mt-5 space-y-3">
            {filteredAlerts.length ? (
              filteredAlerts.map((alert) => (
                <article
                  key={alert.id}
                  className="rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-4 py-4"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge value={alert.tone} label={severityLabels[alert.severity]} />
                        <StatusBadge value={alert.entityType === "flight" ? "live" : "review"} label={alert.kind} />
                        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--muted-2)]">
                          {alert.station}
                        </span>
                      </div>
                      <h2 className="mt-3 font-[family:var(--font-heading)] text-xl font-extrabold text-[color:var(--text-strong)]">
                        {alert.title}
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-[color:var(--muted-fg)]">{alert.detail}</p>
                    </div>
                    <Link href={alert.href} className="btn btn-secondary shrink-0">
                      <ArrowUpRight size={16} />
                      Buka
                    </Link>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-4">
                    <DataCard label="Entity" value={alert.entityLabel} note={alert.statusLabel} tone={getSeverityTone(alert.severity)} />
                    <DataCard label="Rute" value={alert.route} note={`Owner: ${alert.ownerName}`} />
                    <DataCard label="Umur" value={formatAge(alert.ageMinutes)} note={formatDateTime(alert.triggeredAt)} />
                    <DataCard label="Aksi" value="Tindak" note={alert.recommendedAction} tone={getSeverityTone(alert.severity)} />
                  </div>
                </article>
              ))
            ) : (
              <EmptyState
                icon={BellRing}
                title="Tidak ada alert pada filter ini"
                copy="Tidak ada data."
                className="m-4"
              />
            )}
          </div>
        </OpsPanel>
      </div>
    </div>
  );
}
