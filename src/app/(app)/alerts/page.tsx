"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock3,
  Hand,
  RotateCcw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Timer,
  UserCheck,
} from "lucide-react";
import { EmptyState, OpsPanel, PageHeader, SectionHeader } from "@/components/ops-ui";
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
  all: "Semua severity",
  critical: "Kritis",
  warning: "Warning",
  info: "Info",
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

function formatSla(remaining: number) {
  if (remaining < 0) {
    return { label: `Lewat ${formatAge(Math.abs(remaining))}`, tone: "danger" as const };
  }
  if (remaining <= 30) {
    return { label: `${formatAge(remaining)} lagi`, tone: "warning" as const };
  }
  return { label: `${formatAge(remaining)} lagi`, tone: "success" as const };
}

const slaTextClass: Record<"danger" | "warning" | "success", string> = {
  danger: "text-[color:var(--tone-danger)]",
  warning: "text-[color:var(--tone-warning)]",
  success: "text-[color:var(--tone-success)]",
};

export default function AlertsPage() {
  const [data, setData] = useState<AlertCenterPayload | null>(null);
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState("all");
  const [kind, setKind] = useState("all");
  const [owner, setOwner] = useState("all");
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [alertPage, setAlertPage] = useState(1);
  const [actionNotice, setActionNotice] = useState("");
  const [actionNoticeTone, setActionNoticeTone] = useState<"info" | "warning">("info");
  const [pendingAction, setPendingAction] = useState(false);
  const [assigneeChoice, setAssigneeChoice] = useState("");
  const [snoozeChoice, setSnoozeChoice] = useState("60");

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
    const response = await fetch("/api/alerts", { cache: "no-store" });
    if (!response.ok) return;
    const payload = (await response.json()) as AlertCenterPayload;
    setData(payload);
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
      <section className="ops-filter-strip" aria-label="Pencarian dan filter Alert Center">
        <div className="ops-filter-search">
          <label className="label" htmlFor="alerts-query">Cari Alert</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[color:var(--muted-fg)]" />
            <input
              id="alerts-query"
              className="input-field input-field-leading"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari alert, rute, station, owner, atau tindakan"
            />
          </div>
        </div>
      <div className="shell-inline-filters" aria-label="Filter Alert Center">
        <div className="shell-filter-field">
          <label className="label" htmlFor="alerts-severity">Severity</label>
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
                {item}
              </option>
            ))}
          </select>
        </div>
        <div className="shell-filter-field">
          <label className="label" htmlFor="alerts-owner">Owner</label>
          <select id="alerts-owner" className="select-field" value={owner} onChange={(event) => setOwner(event.target.value)}>
            <option value="all">Semua owner</option>
            <option value="mine">Ditugaskan ke saya</option>
            <option value="unassigned">Belum ada owner</option>
            {(data?.assignableUsers ?? []).map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </div>
        <span className="shell-filter-count" aria-label={`${filteredAlerts.length} alert tampil`}>
          <SlidersHorizontal size={14} />
          {filteredAlerts.length}
        </span>
      </div>
      </section>
    ),
    [data?.assignableUsers, filteredAlerts.length, kind, kindOptions, owner, query, severity],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!filteredAlerts.length) {
        setSelectedAlertId(null);
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

  useEffect(() => {
    setAssigneeChoice(selectedAlert?.assignedToId ?? "");
  }, [selectedAlert?.alertKey, selectedAlert?.assignedToId]);

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
          setActionNotice(payload.error || "Gagal memperbarui status alert.");
          return;
        }

        const messages: Record<AlertAction, string> = {
          acknowledge: `Alert ${alert.entityLabel} ditandai sedang ditangani.`,
          assign: `Alert ${alert.entityLabel} berhasil ditugaskan.`,
          snooze: `Alert ${alert.entityLabel} ditunda sementara.`,
          resolve: `Alert ${alert.entityLabel} ditandai selesai.`,
          reopen: `Alert ${alert.entityLabel} dibuka kembali.`,
        };
        setActionNoticeTone("info");
        setActionNotice(messages[action]);
        await loadAlerts();
      } finally {
        setPendingAction(false);
      }
    },
    [loadAlerts],
  );

  const conditionChecks = data?.conditionChecks ?? [];

  return (
    <div className="page-workspace alerts-viewport">
      <PageHeader eyebrow="Alert Center" title="Pusat Alert Operasional" subtitle="Exception dan eskalasi." />

      {filterControls}

      <div role="status" aria-live="polite">
        {actionNotice ? (
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

      <OpsPanel className="p-5">
        <SectionHeader title="Eskalasi" />
        <div className="mt-5 table-shell">
          <table className="data-table">
            <thead>
              <tr>
                <th>Aturan</th>
                <th>Status</th>
                <th>Jumlah</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {conditionChecks.map((item) => (
                <tr key={item.id}>
                  <td className="font-semibold text-[color:var(--text-strong)]">{item.label}</td>
                  <td>
                    <StatusBadge value={item.status === "action" ? "warning" : "success"} label={item.statusLabel} />
                  </td>
                  <td>{item.count}</td>
                  <td className="text-sm text-[color:var(--muted-fg)]">{item.mechanism}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </OpsPanel>

      <div className="alerts-content-grid grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.55fr)]">
        <OpsPanel className="page-pane alerts-panel p-5">
          <SectionHeader title="Daftar Alert" subtitle="Klik row untuk detail dan aksi." />
          <div className="page-scroll internal-scrollbar alerts-table-scroll mt-5 table-shell">
            {paginatedAlerts.length ? (
              <table className="data-table min-w-[720px]">
                <thead>
                  <tr>
                    <th>Severity</th>
                    <th>Alert</th>
                    <th>SLA</th>
                    <th>Status</th>
                    <th className="text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedAlerts.map((alert) => {
                    const selected = selectedAlert?.id === alert.id;
                    const sla = formatSla(alert.slaRemainingMinutes);
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
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-[color:var(--text-strong)]">{alert.entityLabel}</p>
                            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[color:var(--muted-2)]">
                              {alert.kind}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-[color:var(--muted-fg)]">{alert.title}</p>
                          <p className="mt-0.5 text-xs text-[color:var(--muted-2)]">{alert.route}</p>
                        </td>
                        <td>
                          <span className={`text-sm font-semibold ${slaTextClass[sla.tone]}`}>{sla.label}</span>
                        </td>
                        <td>
                          <StatusBadge value={workflowBadgeTone[alert.workflowStatus]} label={workflowLabels[alert.workflowStatus]} />
                          <p className="mt-1 text-xs text-[color:var(--muted-fg)]">
                            {alert.assignedToName || "Belum ada owner"}
                          </p>
                        </td>
                        <td className="text-right">
                          <Link
                            href={alert.href}
                            className="topbar-button"
                            onClick={(event) => event.stopPropagation()}
                            aria-label={`Buka data ${alert.entityLabel}`}
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
                icon={CheckCircle2}
                variant="success"
                title="Tidak ada alert pada filter ini"
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
                const sla = formatSla(selectedAlert.slaRemainingMinutes);
                return (
                  <div
                    className={
                      sla.tone === "danger"
                        ? "rounded-[18px] border border-[color:var(--tone-danger-border)] bg-[color:var(--tone-danger-soft)] px-4 py-3"
                        : sla.tone === "warning"
                          ? "rounded-[18px] border border-[color:var(--tone-warning-border)] bg-[color:var(--tone-warning-soft)] px-4 py-3"
                          : "rounded-[18px] border border-[color:var(--tone-success-border)] bg-[color:var(--tone-success-soft)] px-4 py-3"
                    }
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--muted-2)]">
                        <Timer size={14} />
                        SLA {formatAge(selectedAlert.slaMinutes)}
                      </span>
                      <span className={`text-sm font-bold ${slaTextClass[sla.tone]}`}>{sla.label}</span>
                    </div>
                  </div>
                );
              })()}

              <div className="grid gap-3">
                <div className="ops-panel-muted p-4">
                  <p className="label">Rute</p>
                  <p className="mt-2 font-semibold text-[color:var(--text-strong)]">{selectedAlert.route}</p>
                </div>
                <div className="ops-panel-muted p-4">
                  <p className="label">Umur</p>
                  <p className="mt-2 font-semibold text-[color:var(--text-strong)]">{formatAge(selectedAlert.ageMinutes)}</p>
                  <p className="mt-1 text-xs text-[color:var(--muted-fg)]">{formatDateTime(selectedAlert.triggeredAt)}</p>
                </div>
                <div className="ops-panel-muted p-4">
                  <p className="label">Owner</p>
                  <p className="mt-2 font-semibold text-[color:var(--text-strong)]">
                    {selectedAlert.assignedToName || "Belum ditugaskan"}
                  </p>
                  {selectedAlert.acknowledgedByName ? (
                    <p className="mt-1 text-xs text-[color:var(--muted-fg)]">
                      Di-acknowledge oleh {selectedAlert.acknowledgedByName}
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

              <div className="rounded-[18px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-4">
                <p className="label">Tindakan</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedAlert.workflowStatus !== "acknowledged" ? (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={pendingAction}
                      onClick={() => void runAction(selectedAlert, "acknowledge")}
                    >
                      <Hand size={16} />
                      Tangani
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={pendingAction}
                    onClick={() => void runAction(selectedAlert, "resolve")}
                  >
                    <CheckCircle2 size={16} />
                    Selesai
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={pendingAction}
                    onClick={() => void runAction(selectedAlert, "reopen")}
                  >
                    <RotateCcw size={16} />
                    Reset
                  </button>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label" htmlFor="alert-assignee">Tugaskan ke</label>
                    <div className="mt-1 flex gap-2">
                      <select
                        id="alert-assignee"
                        className="select-field"
                        value={assigneeChoice}
                        onChange={(event) => setAssigneeChoice(event.target.value)}
                      >
                        <option value="">Pilih staff</option>
                        {(data?.assignableUsers ?? []).map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name} • {user.station}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn btn-secondary shrink-0"
                        disabled={pendingAction || !assigneeChoice}
                        onClick={() => void runAction(selectedAlert, "assign", { assigneeId: assigneeChoice })}
                      >
                        <UserCheck size={16} />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="label" htmlFor="alert-snooze">Tunda</label>
                    <div className="mt-1 flex gap-2">
                      <select
                        id="alert-snooze"
                        className="select-field"
                        value={snoozeChoice}
                        onChange={(event) => setSnoozeChoice(event.target.value)}
                      >
                        <option value="30">30 menit</option>
                        <option value="60">1 jam</option>
                        <option value="120">2 jam</option>
                        <option value="240">4 jam</option>
                      </select>
                      <button
                        type="button"
                        className="btn btn-secondary shrink-0"
                        disabled={pendingAction}
                        onClick={() => void runAction(selectedAlert, "snooze", { snoozeMinutes: Number(snoozeChoice) })}
                      >
                        <Clock3 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <Link href={selectedAlert.href} className="btn btn-primary w-full justify-center">
                <ArrowUpRight size={16} />
                Buka Data di {selectedAlert.targetModule}
              </Link>
            </div>
          ) : (
            <EmptyState
              icon={ShieldAlert}
              variant="neutral"
              title="Belum ada alert"
              copy="Data operasional belum tersedia atau semua exception sudah ditangani."
              className="m-0"
            />
          )}
        </OpsPanel>
      </div>
    </div>
  );
}
