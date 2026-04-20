"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BellRing,
  Boxes,
  Clock3,
  PackageCheck,
  PlaneTakeoff,
  RefreshCw,
  ShieldAlert,
  TowerControl,
} from "lucide-react";
import { cn, formatDateTime, formatRelativeShort, formatWeight } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState, OpsPanel, PageHeader, SectionHeader, StatCard } from "@/components/ops-ui";

type DashboardData = {
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
    brandColor: string;
  }[];
  shipmentsToday: {
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
  }[];
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

type DashboardSettingsPayload = {
  settings: {
    autoRefresh: boolean;
    refreshIntervalSeconds: number;
  } | null;
};

type DashboardRefreshSettings = {
  autoRefresh: boolean;
  refreshIntervalSeconds: number;
};

function getCurrentShift(): "Pagi" | "Siang" | "Malam" {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      hour12: false,
      timeZone: "Asia/Makassar",
    }).format(new Date()),
  );
  if (hour >= 6 && hour < 14) return "Pagi";
  if (hour >= 14 && hour < 22) return "Siang";
  return "Malam";
}

function getOpsHour(value: string) {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      hour12: false,
      timeZone: "Asia/Makassar",
    }).format(new Date(value)),
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [shift, setShift] = useState<"Pagi" | "Siang" | "Malam">(getCurrentShift);
  const [refreshSettings, setRefreshSettings] = useState({
    autoRefresh: true,
    refreshIntervalSeconds: 5,
  });

  const loadDashboard = useCallback(async () => {
    const response = await fetch("/api/dashboard", { cache: "no-store" });
    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as DashboardData;
    setData(payload);
    setLoading(false);
    setLastUpdated(new Date().toISOString());
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDashboard();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadDashboard]);

  useEffect(() => {
    let mounted = true;

    async function loadSettings() {
      const response = await fetch("/api/settings", { cache: "no-store" });
      if (!response.ok || !mounted) return;

      const payload = (await response.json()) as DashboardSettingsPayload;
      setRefreshSettings({
        autoRefresh: payload.settings?.autoRefresh ?? true,
        refreshIntervalSeconds: payload.settings?.refreshIntervalSeconds ?? 5,
      });
    }

    void loadSettings();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    function handleSettingsPreview(event: Event) {
      const detail = (event as CustomEvent<Partial<DashboardRefreshSettings>>).detail;
      if (!detail) return;

      setRefreshSettings((current) => ({
        autoRefresh: detail.autoRefresh ?? current.autoRefresh,
        refreshIntervalSeconds: detail.refreshIntervalSeconds ?? current.refreshIntervalSeconds,
      }));
    }

    window.addEventListener("skyhub:settings-preview", handleSettingsPreview as EventListener);
    return () => window.removeEventListener("skyhub:settings-preview", handleSettingsPreview as EventListener);
  }, []);

  useEffect(() => {
    if (!refreshSettings.autoRefresh) return;

    const timer = window.setInterval(() => {
      void loadDashboard();
    }, Math.max(5, refreshSettings.refreshIntervalSeconds) * 1000);

    return () => window.clearInterval(timer);
  }, [loadDashboard, refreshSettings.autoRefresh, refreshSettings.refreshIntervalSeconds]);

  async function handleRefresh() {
    setRefreshing(true);
    await loadDashboard();
    setRefreshing(false);
  }

  const isInShift = useMemo(() => {
    return (value: string) => {
      const hour = getOpsHour(value);
      if (shift === "Pagi") return hour >= 6 && hour < 14;
      if (shift === "Siang") return hour >= 14 && hour < 22;
      return hour >= 22 || hour < 6;
    };
  }, [shift]);

  const filteredShipments = useMemo(
    () => (data?.shipmentsToday ?? []).filter((shipment) => isInShift(shipment.receivedAt)).slice(0, 10),
    [data?.shipmentsToday, isInShift],
  );

  const filteredFlights = useMemo(
    () => (data?.flightsSummary ?? []).filter((flight) => isInShift(flight.departureTime)).slice(0, 6),
    [data?.flightsSummary, isInShift],
  );

  const filteredActivities = useMemo(
    () => (data?.recentActivity ?? []).filter((activity) => isInShift(activity.createdAt)).slice(0, 8),
    [data?.recentActivity, isInShift],
  );

  const filteredAlerts = useMemo(() => {
    const awbs = new Set(filteredShipments.map((shipment) => shipment.awb));
    return (data?.alerts ?? []).filter((alert) => awbs.has(alert.awb)).slice(0, 4);
  }, [data?.alerts, filteredShipments]);

  const activeLoaded = filteredShipments.filter((shipment) => shipment.status === "loaded_to_aircraft").length;

  return (
    <div className="dashboard-viewport">
      <PageHeader
        eyebrow="Cargo Control"
        title="Dashboard Operator"
        subtitle="Ringkasan shift, flight status, manifest board, dan alert operasional dalam satu layar kontrol tanpa perlu scroll halaman utama."
        actions={
          <>
            <div className="inline-flex rounded-full border border-[color:var(--border-soft)] bg-[color:var(--panel-bg)] p-1 shadow-[var(--shadow-soft)]">
              {(["Pagi", "Siang", "Malam"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                    shift === option ? "bg-[color:var(--brand-primary)] text-white" : "text-[color:var(--muted-fg)]",
                  )}
                  onClick={() => setShift(option)}
                >
                  {option}
                </button>
              ))}
            </div>
            <button type="button" className="topbar-button" onClick={handleRefresh}>
              <RefreshCw size={16} className={cn(refreshing && "animate-spin")} />
              <span>{refreshing ? "Refreshing..." : "Refresh sekarang"}</span>
            </button>
            <div className="topbar-button hidden xl:flex">
              <Clock3 size={16} />
              <span>
                {refreshSettings.autoRefresh
                  ? `Auto ${Math.max(5, refreshSettings.refreshIntervalSeconds)} detik • ${lastUpdated ? `update ${formatRelativeShort(lastUpdated)}` : "menunggu data"}`
                  : lastUpdated
                    ? `Auto-refresh off • update ${formatRelativeShort(lastUpdated)}`
                    : "Auto-refresh off"}
              </span>
            </div>
          </>
        }
      />

      <div className="dashboard-stats grid gap-3 xl:grid-cols-4">
        <StatCard
          label="Kargo Masuk"
          value={loading ? "..." : filteredShipments.length}
          note={`Manifest yang aktif pada shift ${shift.toLowerCase()}.`}
          icon={Boxes}
          tone="primary"
        />
        <StatCard
          label="Flight Aktif"
          value={loading ? "..." : filteredFlights.length}
          note={`${filteredFlights.filter((flight) => flight.status === "on_time").length} on-time, ${filteredFlights.filter((flight) => flight.status === "delayed").length} delayed.`}
          icon={PlaneTakeoff}
          tone="info"
        />
        <StatCard
          label="Sudah Loaded"
          value={loading ? "..." : activeLoaded}
          note="Shipment yang sudah siap berangkat ke pesawat."
          icon={PackageCheck}
          tone="success"
        />
        <StatCard
          label="Perlu Tindakan"
          value={loading ? "..." : filteredAlerts.length}
          note="Alert hold, cutoff, atau masalah validasi AWB."
          icon={ShieldAlert}
          tone="warning"
        />
      </div>

      <div className="dashboard-main">
        <OpsPanel className="dashboard-panel p-4 xl:p-5">
          <SectionHeader
            title="Operator Board"
            subtitle="Daftar manifest yang terakhir masuk gudang udara untuk shift aktif."
            action={
              <Link href="/shipment-ledger" className="btn btn-secondary">
                Buka ledger
              </Link>
            }
          />

          <div className="dashboard-split mt-4">
            <div className="dashboard-table-scroll ops-table-scroll ops-table-sticky table-shell">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>AWB</th>
                    <th>Komoditas</th>
                    <th>Rute</th>
                    <th>Status</th>
                    <th>Flight</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredShipments.length ? (
                    filteredShipments.map((shipment) => (
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
                          title="Belum ada shipment untuk shift ini"
                          copy="Dashboard tetap aktif, tetapi belum ada manifest baru yang masuk pada rentang shift yang dipilih."
                          className="m-4"
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="dashboard-flight-scroll space-y-3">
              <div className="rounded-[28px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-[color:var(--brand-primary-soft)] text-[color:var(--brand-primary)]">
                    <TowerControl size={18} />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-2)]">Flight Status</p>
                    <p className="font-[family:var(--font-heading)] text-xl font-extrabold tracking-[-0.03em] text-[color:var(--text-strong)]">Near Cutoff Board</p>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {filteredFlights.length ? (
                    filteredFlights.map((flight) => (
                      <div key={flight.id} className="overflow-hidden rounded-[22px] border border-[color:var(--border-soft)] bg-[color:var(--panel-bg)]">
                        <div className="relative h-28 overflow-hidden border-b border-[color:var(--border-soft)]">
                          <Image
                            src={flight.imageUrl}
                            alt={flight.flightNumber}
                            fill
                            sizes="(max-width: 1279px) 100vw, 320px"
                            className="object-cover"
                          />
                          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,20,38,0.08),rgba(8,20,38,0.72))]" />
                          <div className="absolute left-3 top-3 flex items-center gap-2">
                            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/92 p-1 shadow-sm">
                              <Image
                                src={flight.airlineLogoUrl}
                                alt={flight.airlineName}
                                width={32}
                                height={32}
                                sizes="32px"
                                className="object-contain"
                                style={{ height: "100%", width: "auto" }}
                              />
                            </span>
                            <div>
                              <p className="text-xs font-semibold text-white">{flight.airlineName}</p>
                              <p className="text-[11px] text-white/70">{flight.aircraftType}</p>
                            </div>
                          </div>
                          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 px-4 pb-4">
                            <div>
                              <p className="font-[family:var(--font-heading)] text-xl font-black tracking-[-0.04em] text-white">{flight.flightNumber}</p>
                              <p className="text-sm text-white/75">{flight.route}</p>
                            </div>
                            <StatusBadge value={flight.status} label={flight.statusLabel} className="border-white/20 bg-white/10 text-white" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 px-4 py-4 text-sm">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted-2)]">Cutoff</p>
                            <p className="mt-1 font-semibold text-[color:var(--text-strong)]">{formatDateTime(flight.cargoCutoffTime)}</p>
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted-2)]">Registration</p>
                            <p className="mt-1 font-semibold text-[color:var(--text-strong)]">{flight.registration}</p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted-2)]">Departure</p>
                            <p className="mt-1 font-semibold text-[color:var(--text-strong)]">{formatDateTime(flight.departureTime)}</p>
                          </div>
                        </div>
                        {flight.cutoffAtRisk ? (
                          <div className="border-t border-[color:var(--tone-warning-border)] bg-[color:var(--tone-warning-soft)] px-4 py-3 text-sm font-medium text-[color:var(--tone-warning)]">
                            Cutoff mendekat. Pastikan status kargo terbaru sudah tercatat.
                          </div>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-[color:var(--muted-fg)]">Tidak ada flight aktif di shift ini.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </OpsPanel>

        <div className="dashboard-side-stack">
          <OpsPanel className="dashboard-panel p-4 xl:p-5">
            <SectionHeader title="Action Center" subtitle="AWB yang membutuhkan intervensi operator atau supervisor." />
            <div className="dashboard-alert-scroll mt-4 space-y-3">
              {filteredAlerts.length ? (
                filteredAlerts.map((alert) => (
                  <div key={alert.id} className="rounded-[24px] border border-[color:var(--tone-warning-border)] bg-[color:var(--tone-warning-soft)] px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[color:var(--tone-warning)]">{alert.title}</p>
                        <p className="mt-2 text-sm leading-6 text-[color:var(--text-strong)]">{alert.detail}</p>
                      </div>
                      <BellRing size={18} className="shrink-0 text-[color:var(--tone-warning)]" />
                    </div>
                    <Link href={`/awb-tracking?awb=${alert.awb}`} className="mt-4 inline-flex text-sm font-semibold text-[color:var(--brand-primary)]">
                      Buka tracking
                    </Link>
                  </div>
                ))
              ) : (
                <EmptyState
                  icon={BellRing}
                  title="Tidak ada alert kritis"
                  copy="Semua shipment pada shift ini berada dalam kondisi normal atau sudah tertangani."
                />
              )}
            </div>
          </OpsPanel>

          <OpsPanel className="dashboard-panel p-4 xl:p-5">
            <SectionHeader
              title="Recent Activity"
              subtitle="Log terbaru yang relevan untuk operator control room."
              action={
                <Link href="/activity-log" className="btn btn-secondary">
                  Buka log
                </Link>
              }
            />
            <div className="dashboard-activity-scroll mt-4 space-y-3">
              {filteredActivities.length ? (
                filteredActivities.map((activity) => (
                  <div key={activity.id} className="rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[color:var(--text-strong)]">{activity.action}</p>
                        <p className="mt-1 text-sm text-[color:var(--muted-fg)]">{activity.targetLabel}</p>
                      </div>
                      <StatusBadge value={activity.level} label={activity.level} />
                    </div>
                    <p className="mt-3 text-sm leading-6">{activity.description}</p>
                    <p className="mt-3 text-xs text-[color:var(--muted-2)]">{activity.userName} | {formatDateTime(activity.createdAt)}</p>
                  </div>
                ))
              ) : (
                <EmptyState
                  icon={Clock3}
                  title="Belum ada aktivitas"
                  copy="Audit trail untuk shift ini akan muncul otomatis saat operator mulai melakukan aksi."
                />
              )}
            </div>
          </OpsPanel>
        </div>
      </div>
    </div>
  );
}
