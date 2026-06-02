"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Hand,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Timer,
} from "lucide-react";
import { EmptyState, OpsPanel, PageHeader, SectionHeader, SkeletonBlock } from "@/components/ops-ui";
import { OpsDrawer } from "@/components/ops-drawer";
import { StatusBadge } from "@/components/status-badge";
import { formatDateTime } from "@/lib/format";

type AlertSeverity = "critical" | "warning" | "info";
type AlertWorkflowStatus = "open" | "acknowledged" | "snoozed" | "resolved";

type AlertCenterPayload = {
  generatedAt: string;
  viewer: { id: string; name: string };
  assignableUsers: { id: string; name: string; role: string; station: string }[];
  summary: {
    total: number;
    critical: number;
    warning: number;
    info: number;
    acknowledged: number;
    assigned: number;
    slaBreached: number;
    unreadNotifications: number;
  };
  alerts: {
    id: string;
    alertKey: string;
    kind: string;
    title: string;
    detail: string;
    severity: AlertSeverity;
    tone: string;
    entityType: string;
    entityId: string;
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
    slaMinutes: number;
    slaRemainingMinutes: number;
    workflowStatus: AlertWorkflowStatus;
    assignedToId: string | null;
    assignedToName: string | null;
    acknowledgedByName: string | null;
    acknowledgedAt: string | null;
    snoozedUntil: string | null;
    note: string | null;
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
type AlertAction = "acknowledge" | "assign" | "snooze" | "resolve" | "reopen";

const severityLabels: Record<string, string> = {
  all: "Semua tingkat",
  critical: "Kritis",
  warning: "Perhatian",
  info: "Info",
};

const alertKindLabels: Record<string, string> = {
  "shipment-hold": "Pengiriman Tertahan",
  "document-gate": "Dokumen Belum Lengkap",
  "readiness-gate": "Kesiapan Belum Aman",
  "stale-update": "Update Terlalu Lama",
  "unassigned-flight": "Belum Masuk Penerbangan",
  "reported-awb-issue": "Isu AWB Dilaporkan",
  "flight-delay": "Penerbangan Terlambat",
  "cutoff-risk": "Risiko Batas Terima",
  "capacity-risk": "Risiko Kapasitas",
};

const workflowLabels: Record<AlertWorkflowStatus, string> = {
  open: "Terbuka",
  acknowledged: "Ditangani",
  snoozed: "Ditunda",
  resolved: "Selesai",
};

const workflowBadgeTone: Record<AlertWorkflowStatus, string> = {
  open: "warning",
  acknowledged: "info",
  snoozed: "pending",
  resolved: "success",
};

const ALERT_PAGE_SIZE = 12;

function formatAge(minutes: number) {
  if (minutes < 60) return `${minutes} menit`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} jam ${rest} menit` : `${hours} jam`;
}

function formatResponseDeadline(remaining: number) {
  if (remaining < 0) {
    return { label: `Terlambat ${formatAge(Math.abs(remaining))}`, tone: "danger" as const };
  }
  if (remaining <= 30) {
    return { label: `Sisa ${formatAge(remaining)}`, tone: "warning" as const };
  }
  return { label: `Sisa ${formatAge(remaining)}`, tone: "success" as const };
}

function getAlertTimerContext(alert: AlertRow) {
  if (alert.kind === "cutoff-risk") {
    return {
      columnLabel: "Sisa ke Batas Terima",
      title: `Batas kargo ${formatDateTime(alert.triggeredAt)}`,
      description: "Hitung mundur ini mengikuti jadwal batas terima kargo penerbangan, bukan umur peringatan.",
      ageLabel: "Jarak ke batas terima",
    };
  }

  return {
    columnLabel: "Batas Tindak Lanjut",
    title: `Batas tindak lanjut ${formatAge(alert.slaMinutes)} sejak peringatan muncul`,
    description: "Hitung mundur ini menunjukkan sisa waktu untuk mengambil tindakan pertama yang tercatat.",
    ageLabel: "Umur peringatan",
  };
}

function getAlertKindLabel(kind: string) {
  return alertKindLabels[kind] ?? "Kondisi Operasional";
}

const responseDeadlineTextClass: Record<"danger" | "warning" | "success", string> = {
  danger: "text-[color:var(--tone-danger)]",
  warning: "text-[color:var(--tone-warning)]",
  success: "text-[color:var(--tone-success)]",
};

export default function AlertsPage() {
  const [data, setData] = useState<AlertCenterPayload | null>(null);
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState("all");
  const [kind, setKind] = useState("all");
  const [owner, setOwner] = useState("all");
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [alertPage, setAlertPage] = useState(1);
  const [actionNotice, setActionNotice] = useState("");
  const [actionNoticeTone, setActionNoticeTone] = useState<"info" | "warning">("info");
  const [pendingAction, setPendingAction] = useState(false);

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

  const loadAlerts = useCallback(async () => {
    setLoadingAlerts(true);
    setLoadError("");
    try {
      const response = await fetch("/api/alerts", { cache: "no-store" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setLoadError(payload.error || "Gagal memuat peringatan operasional.");
        return;
      }
      const payload = (await response.json()) as AlertCenterPayload;
      setData(payload);
    } catch {
      setLoadError("Koneksi terputus saat memuat peringatan operasional.");
    } finally {
      setLoadingAlerts(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAlerts();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadAlerts]);

  useEffect(() => {
    if (!actionNotice) return;
    const timer = window.setTimeout(() => setActionNotice(""), 2800);
    return () => window.clearTimeout(timer);
  }, [actionNotice]);

  const kindOptions = useMemo(() => {
    return Array.from(new Set((data?.alerts ?? []).map((alert) => alert.kind))).sort();
  }, [data?.alerts]);

  const filteredAlerts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return (data?.alerts ?? []).filter((alert) => {
      const matchesSeverity = severity === "all" || alert.severity === severity;
      const matchesKind = kind === "all" || alert.kind === kind;
      const matchesOwner =
        owner === "all" ||
        (owner === "unassigned" && !alert.assignedToId) ||
        (owner === "mine" && alert.assignedToId === data?.viewer.id) ||
        alert.assignedToId === owner;
      const matchesQuery =
        !normalizedQuery ||
        [
          alert.title,
          alert.detail,
          alert.entityLabel,
          alert.route,
          alert.station,
          alert.ownerName,
          alert.assignedToName ?? "",
          alert.recommendedAction,
          alert.cause,
          alert.clearCondition,
          alert.targetModule,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);

      return matchesSeverity && matchesKind && matchesOwner && matchesQuery;
    });
  }, [data?.alerts, data?.viewer.id, kind, owner, query, severity]);

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

  const filterControls = useMemo(
    () => (
      <section className="ops-filter-strip" aria-label="Pencarian dan filter pusat peringatan">
        <div className="ops-filter-search">
          <label className="label" htmlFor="alerts-query">Cari Peringatan</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[color:var(--muted-fg)]" />
            <input
              id="alerts-query"
              className="input-field input-field-leading"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari peringatan, rute, stasiun, penanggung jawab, atau tindakan"
            />
          </div>
        </div>
      <div className="shell-inline-filters" aria-label="Filter pusat peringatan">
        <div className="shell-filter-field">
          <label className="label" htmlFor="alerts-severity">Tingkat</label>
          <select id="alerts-severity" className="select-field" value={severity} onChange={(event) => setSeverity(event.target.value)}>
            {Object.entries(severityLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="shell-filter-field">
          <label className="label" htmlFor="alerts-kind">Jenis</label>
          <select id="alerts-kind" className="select-field" value={kind} onChange={(event) => setKind(event.target.value)}>
            <option value="all">Semua jenis</option>
            {kindOptions.map((item) => (
              <option key={item} value={item}>
                {getAlertKindLabel(item)}
              </option>
            ))}
          </select>
        </div>
        <div className="shell-filter-field">
          <label className="label" htmlFor="alerts-owner">Penanggung Jawab</label>
          <select id="alerts-owner" className="select-field" value={owner} onChange={(event) => setOwner(event.target.value)}>
            <option value="all">Semua penanggung jawab</option>
            <option value="mine">Ditugaskan ke saya</option>
            <option value="unassigned">Belum ada penanggung jawab</option>
            {(data?.assignableUsers ?? []).map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </div>
        <span className="shell-filter-count" aria-label={data ? `${filteredAlerts.length} peringatan tampil` : "Peringatan sedang dimuat"}>
          <SlidersHorizontal size={14} />
          {data ? filteredAlerts.length : "Memuat"}
        </span>
      </div>
      </section>
    ),
    [data, filteredAlerts.length, kind, kindOptions, owner, query, severity],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!filteredAlerts.length) {
        setSelectedAlertId(null);
        setDetailOpen(false);
        return;
      }

      if (!selectedAlertId || !paginatedAlerts.some((alert) => alert.id === selectedAlertId)) {
        setSelectedAlertId((paginatedAlerts[0] ?? filteredAlerts[0]).id);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [filteredAlerts, paginatedAlerts, selectedAlertId]);

  useEffect(() => {
    const timer = window.setTimeout(() => setAlertPage(1), 0);
    return () => window.clearTimeout(timer);
  }, [severity, kind, owner, query]);

  const openAlertDetail = useCallback((alertId: string) => {
    setSelectedAlertId(alertId);
    setDetailOpen(true);
  }, []);

  const runAction = useCallback(
    async (alert: AlertRow, action: AlertAction, extra?: { assigneeId?: string; snoozeMinutes?: number }) => {
      setPendingAction(true);
      try {
        const response = await fetch("/api/alerts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            alertKey: alert.alertKey,
            action,
            assigneeId: extra?.assigneeId,
            snoozeMinutes: extra?.snoozeMinutes,
          }),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string };
          setActionNoticeTone("warning");
          setActionNotice(payload.error || "Gagal memperbarui status peringatan.");
          return;
        }

        const messages: Record<AlertAction, string> = {
          acknowledge: `Peringatan ${alert.entityLabel} ditandai sedang ditangani.`,
          assign: `Peringatan ${alert.entityLabel} berhasil ditugaskan.`,
          snooze: `Peringatan ${alert.entityLabel} ditunda sementara.`,
          resolve: `Peringatan ${alert.entityLabel} ditandai selesai.`,
          reopen: `Peringatan ${alert.entityLabel} dibuka kembali.`,
        };
        setActionNoticeTone("info");
        setActionNotice(messages[action]);
        await loadAlerts();
      } catch {
        setActionNoticeTone("warning");
        setActionNotice("Koneksi terputus saat memperbarui status peringatan.");
      } finally {
        setPendingAction(false);
      }
    },
    [loadAlerts],
  );

  const selectedAlertManualResolve = selectedAlert?.kind === "reported-awb-issue";
  const initialLoading = loadingAlerts && !data;

  return (
    <div className="page-workspace alerts-viewport">
      <PageHeader eyebrow="Pusat Peringatan" title="Pusat Peringatan Operasional" subtitle="Masalah dan eskalasi." />

      {filterControls}

      <div role="status" aria-live="polite">
        {loadError ? (
          <div className="rounded-[18px] border border-[color:var(--tone-warning-border)] bg-[color:var(--tone-warning-soft)] px-4 py-3 text-sm font-medium text-[color:var(--tone-warning)]">
            {loadError}
          </div>
        ) : actionNotice ? (
          <div
            className={
              actionNoticeTone === "warning"
                ? "rounded-[18px] border border-[color:var(--tone-warning-border)] bg-[color:var(--tone-warning-soft)] px-4 py-3 text-sm font-medium text-[color:var(--tone-warning)]"
                : "rounded-[18px] border border-[color:var(--tone-info-border)] bg-[color:var(--tone-info-soft)] px-4 py-3 text-sm font-medium text-[color:var(--tone-info)]"
            }
          >
            {actionNotice}
          </div>
        ) : null}
      </div>

      <div className="alerts-content-grid grid gap-4">
        <OpsPanel className="page-pane alerts-panel p-5">
          <SectionHeader title="Daftar Peringatan" subtitle="Gunakan tombol Detail untuk membuka tindakan di jendela kerja." />
          <div className="page-scroll internal-scrollbar alerts-table-scroll mt-5 table-shell">
            {initialLoading ? (
              <div className="grid gap-3 p-4" aria-label="Memuat daftar peringatan">
                {Array.from({ length: 8 }).map((_, index) => (
                  <SkeletonBlock key={index} className="h-[72px] w-full rounded-[18px]" />
                ))}
              </div>
            ) : paginatedAlerts.length ? (
              <table className="data-table min-w-[720px]">
                <thead>
                  <tr>
                    <th>Tingkat</th>
                    <th>Peringatan</th>
                    <th>Batas Tindak Lanjut</th>
                    <th>Status</th>
                    <th className="text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedAlerts.map((alert) => {
                    const selected = selectedAlert?.id === alert.id;
                    const responseDeadline = formatResponseDeadline(alert.slaRemainingMinutes);
                    const timerContext = getAlertTimerContext(alert);
                    return (
                      <tr
                        key={alert.id}
                        className={selected ? "flight-manifest-row-active cursor-pointer" : "cursor-pointer"}
                        onClick={() => openAlertDetail(alert.id)}
                      >
                        <td>
                          <StatusBadge value={alert.tone} label={severityLabels[alert.severity]} />
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-[color:var(--text-strong)]">{alert.entityLabel}</p>
                            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[color:var(--muted-2)]">
                              {getAlertKindLabel(alert.kind)}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-[color:var(--muted-fg)]">{alert.title}</p>
                          <p className="mt-0.5 text-xs text-[color:var(--muted-2)]">{alert.route}</p>
                        </td>
                        <td>
                          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[color:var(--muted-2)]">
                            {timerContext.columnLabel}
                          </p>
                          <span className={`text-sm font-semibold ${responseDeadlineTextClass[responseDeadline.tone]}`}>{responseDeadline.label}</span>
                        </td>
                        <td>
                          <StatusBadge value={workflowBadgeTone[alert.workflowStatus]} label={workflowLabels[alert.workflowStatus]} />
                          <p className="mt-1 text-xs text-[color:var(--muted-fg)]">
                            {alert.assignedToName || "Belum ada penanggung jawab"}
                          </p>
                        </td>
                        <td className="text-right">
                          <button
                            type="button"
                            className="btn btn-secondary h-9 min-h-9 px-3 text-xs"
                            onClick={(event) => {
                              event.stopPropagation();
                              openAlertDetail(alert.id);
                            }}
                            aria-label={`Buka detail ${alert.entityLabel}`}
                          >
                            <ArrowUpRight size={15} />
                            Detail
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <EmptyState
                icon={CheckCircle2}
                variant="success"
                title="Tidak ada peringatan pada filter ini"
                copy="Semua kondisi pada filter ini sudah aman atau sudah ditangani."
                className="m-4"
              />
            )}
          </div>
          <div className="alerts-pagination-footer">
            <button
              type="button"
              className="topbar-button"
              onClick={() => setAlertPage((current) => Math.max(1, current - 1))}
              disabled={initialLoading || currentAlertPage <= 1}
            >
              <ChevronLeft size={16} />
              Sebelumnya
            </button>
            <p>{initialLoading ? "Memuat data peringatan" : `${visibleStart}-${visibleEnd} dari ${filteredAlerts.length} • Halaman ${currentAlertPage}/${totalAlertPages}`}</p>
            <button
              type="button"
              className="topbar-button"
              onClick={() => setAlertPage((current) => Math.min(totalAlertPages, current + 1))}
              disabled={initialLoading || currentAlertPage >= totalAlertPages}
            >
              Berikutnya
              <ChevronRight size={16} />
            </button>
          </div>
        </OpsPanel>

        <OpsDrawer
          open={detailOpen && Boolean(selectedAlert)}
          eyebrow="Detail Peringatan"
          title={selectedAlert ? selectedAlert.entityLabel : "Pilih Peringatan"}
          description="Tindakan, penugasan, penundaan, dan tautan perbaikan dikumpulkan di sini agar daftar utama tetap lapang."
          onClose={() => setDetailOpen(false)}
          className="alerts-detail-modal"
        >
          {initialLoading ? (
            <div className="mt-5 grid gap-4" aria-label="Memuat detail peringatan">
              <SkeletonBlock className="h-8 w-48 rounded-[16px]" />
              <SkeletonBlock className="h-24 w-full rounded-[18px]" />
              <SkeletonBlock className="h-28 w-full rounded-[18px]" />
              <SkeletonBlock className="h-48 w-full rounded-[18px]" />
            </div>
          ) : selectedAlert ? (
            <div className="page-scroll internal-scrollbar alerts-detail-scroll mt-5 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge value={selectedAlert.tone} label={severityLabels[selectedAlert.severity]} />
                <StatusBadge value={workflowBadgeTone[selectedAlert.workflowStatus]} label={workflowLabels[selectedAlert.workflowStatus]} />
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

              {(() => {
                const responseDeadline = formatResponseDeadline(selectedAlert.slaRemainingMinutes);
                const timerContext = getAlertTimerContext(selectedAlert);
                return (
                  <div
                    className={
                      responseDeadline.tone === "danger"
                        ? "rounded-[18px] border border-[color:var(--tone-danger-border)] bg-[color:var(--tone-danger-soft)] px-4 py-3"
                        : responseDeadline.tone === "warning"
                          ? "rounded-[18px] border border-[color:var(--tone-warning-border)] bg-[color:var(--tone-warning-soft)] px-4 py-3"
                          : "rounded-[18px] border border-[color:var(--tone-success-border)] bg-[color:var(--tone-success-soft)] px-4 py-3"
                    }
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--muted-2)]">
                        <Timer size={14} />
                        {timerContext.columnLabel}
                      </span>
                      <span className={`text-sm font-bold ${responseDeadlineTextClass[responseDeadline.tone]}`}>{responseDeadline.label}</span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-[color:var(--muted-fg)]">
                      {timerContext.title}. {timerContext.description}
                    </p>
                  </div>
                );
              })()}

              <div className="grid gap-3">
                <div className="ops-panel-muted p-4">
                  <p className="label">Rute</p>
                  <p className="mt-2 font-semibold text-[color:var(--text-strong)]">{selectedAlert.route}</p>
                </div>
                <div className="ops-panel-muted p-4">
                  <p className="label">{getAlertTimerContext(selectedAlert).ageLabel}</p>
                  <p className="mt-2 font-semibold text-[color:var(--text-strong)]">{formatAge(selectedAlert.ageMinutes)}</p>
                  <p className="mt-1 text-xs text-[color:var(--muted-fg)]">{formatDateTime(selectedAlert.triggeredAt)}</p>
                </div>
                <div className="ops-panel-muted p-4">
                  <p className="label">Penanggung Jawab</p>
                  <p className="mt-2 font-semibold text-[color:var(--text-strong)]">
                    {selectedAlert.assignedToName || "Belum ditugaskan"}
                  </p>
                  {selectedAlert.acknowledgedByName ? (
                    <p className="mt-1 text-xs text-[color:var(--muted-fg)]">
                      Ditangani oleh {selectedAlert.acknowledgedByName}
                    </p>
                  ) : null}
                </div>
                <div className="ops-panel-muted p-4">
                  <p className="label">Aksi Disarankan</p>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--muted-fg)]">{selectedAlert.recommendedAction}</p>
                </div>
                <div className="ops-panel-muted p-4">
                  <p className="label">Kriteria Selesai</p>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--muted-fg)]">{selectedAlert.clearCondition}</p>
                </div>
              </div>

              <Link href={selectedAlert.href} className="btn btn-primary w-full justify-center">
                <ArrowUpRight size={16} />
                Perbaiki di {selectedAlert.targetModule}
              </Link>

              <div className="flex flex-wrap gap-2">
                {selectedAlert.workflowStatus !== "acknowledged" ? (
                  <button
                    type="button"
                    className="btn btn-secondary flex-1"
                    disabled={pendingAction}
                    onClick={() => void runAction(selectedAlert, "acknowledge")}
                  >
                    <Hand size={16} />
                    Tangani
                  </button>
                ) : null}
                {selectedAlertManualResolve ? (
                  <button
                    type="button"
                    className="btn btn-secondary flex-1"
                    disabled={pendingAction}
                    onClick={() => void runAction(selectedAlert, "resolve")}
                  >
                    <CheckCircle2 size={16} />
                    Tandai Selesai
                  </button>
                ) : null}
              </div>

              <p className="text-xs leading-5 text-[color:var(--muted-2)]">
                {selectedAlertManualResolve
                  ? "Laporan AWB manual. Periksa buku pengiriman, lalu tandai selesai."
                  : "Peringatan selesai otomatis setelah data di modul sumber sudah beres."}
              </p>

            </div>
          ) : (


            <EmptyState
              icon={ShieldAlert}
              variant="neutral"
              title="Belum ada peringatan"
              copy="Data operasional belum tersedia atau semua pengecualian sudah ditangani."
              className="m-0"
            />
          )}
        </OpsDrawer>
      </div>
    </div>
  );
}
