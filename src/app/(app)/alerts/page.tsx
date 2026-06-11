"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  Hand,
  Search,
  ShieldAlert,
} from "lucide-react";
import { GlassSelect } from "@/components/glass-select";

import { CrudPageScaffold, EmptyState, FilterBar, FilterFields, FilterSearch, OpsPanel, PaginationBar, SectionHeader, SkeletonBlock } from "@/components/ops-ui";
import { useVisibleTablePageSize } from "@/lib/use-visible-table-page-size";
import { OpsDrawer } from "@/components/ops-drawer";
import { useOpsAlert } from "@/components/ops-alert-provider";
import { StatusBadge } from "@/components/status-badge";
import { cn, formatDateTime } from "@/lib/format";
import { networkErrorMessage, readApiError } from "@/lib/ops-feedback";
import {
  alertAllowsManualClose,
  alertMatchesGroupFilter,
  ALERT_GROUP_FILTER_OPTIONS,
  ALERT_WORKFLOW_FILTER_OPTIONS,
  formatAlertSlaLabel,
  getAlertGroupLabel,
  isAlertGroupFilter,
  type AlertGroupFilter,
  type AlertResolutionMode,
} from "@/lib/ops-resolution";

type AlertSeverity = "critical" | "warning" | "info";
type AlertWorkflowStatus = "open" | "acknowledged" | "snoozed" | "resolved";

type AlertCenterPayload = {
  generatedAt: string;
  viewer: { id: string; name: string };
  summary: {
    total: number;
    critical: number;
    warning: number;
    info: number;
  };
  alerts: {
    id: string;
    alertKey: string;
    kind: string;
    title: string;
    detail: string;
    severity: AlertSeverity;
    tone: string;
    entityLabel: string;
    href: string;
    route: string;
    station: string;
    recommendedAction: string;
    cause: string;
    clearCondition: string;
    targetModule: string;
    triggeredAt: string;
    workflowStatus: AlertWorkflowStatus;
    assignedToName: string | null;
    acknowledgedByName: string | null;
    resolutionMode: AlertResolutionMode;
    resolutionModeLabel: string;
    resolutionFootnote: string;
    slaMinutes: number;
    slaRemainingMinutes: number;
  }[];
};

type AlertRow = AlertCenterPayload["alerts"][number];
type AlertAction = "acknowledge" | "resolve";

const severityLabels: Record<string, string> = {
  all: "Semua tingkat",
  critical: "Kritis",
  warning: "Perhatian",
  info: "Info",
};

const alertKindLabels: Record<string, string> = {
  "shipment-hold": "Hold",
  "readiness-gate": "Kesiapan",
  "stale-update": "Update Lama",
  "unassigned-flight": "Tanpa Penerbangan",
  "reported-awb-issue": "Isu AWB",
  "departure-overdue": "Konfirmasi berangkat",
  "cutoff-risk": "Batas Terima",
  "capacity-risk": "Kapasitas",
};

const workflowLabels: Record<AlertWorkflowStatus, string> = {
  open: "Belum ditangani",
  acknowledged: "Sedang ditangani",
  snoozed: "Ditunda",
  resolved: "Selesai",
};

const workflowBadgeTone: Record<AlertWorkflowStatus, string> = {
  open: "warning",
  acknowledged: "info",
  snoozed: "pending",
  resolved: "success",
};

function getAlertKindLabel(kind: string) {
  return alertKindLabels[kind] ?? "Operasional";
}

function resolveInitialGroupFilter(value: string | null): AlertGroupFilter {
  return value && isAlertGroupFilter(value) ? value : "all";
}

function resolveInitialWorkflowFilter(value: string | null) {
  return ALERT_WORKFLOW_FILTER_OPTIONS.some((option) => option.value === value) ? value! : "all";
}

export default function AlertsPage() {
  const { showAlert } = useOpsAlert();
  const searchParams = useSearchParams();
  const latestUrlParamsRef = useRef(searchParams.toString());
  const [data, setData] = useState<AlertCenterPayload | null>(null);
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [query, setQuery] = useState(searchParams.get("query") || "");
  const [severity, setSeverity] = useState(searchParams.get("severity") || "all");
  const [group, setGroup] = useState<AlertGroupFilter>(() => resolveInitialGroupFilter(searchParams.get("group")));
  const [workflow, setWorkflow] = useState(() => resolveInitialWorkflowFilter(searchParams.get("workflow")));
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [alertPage, setAlertPage] = useState(1);
  const [pendingAction, setPendingAction] = useState(false);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const tableRef = useRef<HTMLTableElement | null>(null);

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
    try {
      const response = await fetch("/api/alerts", { cache: "no-store" });
      if (!response.ok) {
        showAlert({
          title: "Gagal Memuat",
          description: await readApiError(response, "Gagal memuat peringatan operasional."),
          tone: "error",
        });
        return;
      }
      const payload = (await response.json()) as AlertCenterPayload;
      setData(payload);
    } catch {
      showAlert({
        title: "Koneksi Terputus",
        description: networkErrorMessage("memuat peringatan operasional"),
        tone: "warning",
      });
    } finally {
      setLoadingAlerts(false);
    }
  }, [showAlert]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAlerts();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadAlerts]);

  const filteredAlerts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return (data?.alerts ?? []).filter((alert) => {
      const matchesSeverity = severity === "all" || alert.severity === severity;
      const matchesGroup = alertMatchesGroupFilter(alert.kind, group);
      const matchesWorkflow = workflow === "all" || alert.workflowStatus === workflow;
      const matchesQuery =
        !normalizedQuery ||
        [
          alert.title,
          alert.detail,
          alert.entityLabel,
          alert.route,
          alert.station,
          alert.targetModule,
          getAlertKindLabel(alert.kind),
          getAlertGroupLabel(alert.kind),
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);

      return matchesSeverity && matchesGroup && matchesWorkflow && matchesQuery;
    });
  }, [data?.alerts, group, query, severity, workflow]);

  const alertPageSize = useVisibleTablePageSize(
    tableScrollRef,
    tableRef,
    Boolean(data) && !loadingAlerts && filteredAlerts.length > 0,
    filteredAlerts.length,
    {
      fallback: 3,
      min: 1,
      max: 8,
    },
  );

  const totalAlertPages = Math.max(1, Math.ceil(filteredAlerts.length / alertPageSize));
  const currentAlertPage = Math.min(alertPage, totalAlertPages);
  const pageStartIndex = (currentAlertPage - 1) * alertPageSize;
  const paginatedAlerts = useMemo(() => {
    return filteredAlerts.slice(pageStartIndex, pageStartIndex + alertPageSize);
  }, [alertPageSize, filteredAlerts, pageStartIndex]);
  const visibleStart = filteredAlerts.length ? pageStartIndex + 1 : 0;
  const visibleEnd = Math.min(pageStartIndex + paginatedAlerts.length, filteredAlerts.length);

  const selectedAlert = useMemo<AlertRow | null>(() => {
    if (selectedAlertId) {
      return (
        filteredAlerts.find((alert) => alert.id === selectedAlertId) ??
        (data?.alerts ?? []).find((alert) => alert.id === selectedAlertId) ??
        null
      );
    }
    return paginatedAlerts[0] ?? null;
  }, [data?.alerts, filteredAlerts, paginatedAlerts, selectedAlertId]);

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
  }, [group, query, severity, workflow]);

  useEffect(() => {
    setAlertPage((current) => Math.min(current, totalAlertPages));
  }, [alertPageSize, totalAlertPages]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("query", query.trim());
    if (severity !== "all") params.set("severity", severity);
    if (group !== "all") params.set("group", group);
    if (workflow !== "all") params.set("workflow", workflow);

    const nextQueryString = params.toString();
    if (nextQueryString !== latestUrlParamsRef.current) {
      latestUrlParamsRef.current = nextQueryString;
      const nextUrl = nextQueryString ? `${window.location.pathname}?${nextQueryString}` : window.location.pathname;
      window.history.replaceState(null, "", nextUrl);
    }
  }, [group, query, severity, workflow]);

  const openAlertDetail = useCallback((alertId: string) => {
    setSelectedAlertId(alertId);
    setDetailOpen(true);
  }, []);

  const runAction = useCallback(
    async (alert: AlertRow, action: AlertAction) => {
      setPendingAction(true);
      try {
        const response = await fetch("/api/alerts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            alertKey: alert.alertKey,
            action,
          }),
        });

        if (!response.ok) {
          showAlert({
            title: "Gagal Memperbarui",
            description: await readApiError(response, "Gagal memperbarui status peringatan."),
            tone: "error",
          });
          return;
        }

        const messages: Record<AlertAction, string> = {
          acknowledge: `Peringatan ${alert.entityLabel} ditandai sedang ditangani.`,
          resolve: `Peringatan ${alert.entityLabel} ditandai selesai.`,
        };
        showAlert({ title: "Berhasil", description: messages[action], tone: "success" });
        await loadAlerts();
      } catch {
        showAlert({
          title: "Koneksi Terputus",
          description: networkErrorMessage("memperbarui status peringatan"),
          tone: "warning",
        });
      } finally {
        setPendingAction(false);
      }
    },
    [loadAlerts, showAlert],
  );

  const selectedAlertManualClose = selectedAlert ? alertAllowsManualClose(selectedAlert.resolutionMode) : false;
  const initialLoading = loadingAlerts && !data;

  return (
    <>
    <CrudPageScaffold
      className="alerts-viewport"
      eyebrow="Pusat Peringatan"
      title="Pusat Peringatan Operasional"
      subtitle="Peringatan sistem: perbaiki data atau tangani insiden, lalu tutup bila perlu. Berbeda dari Kotak Keluhan yang menangani tiket pelanggan."

      filters={
      <FilterBar ariaLabel="Pencarian dan filter pusat peringatan" stacked>
        <FilterSearch>
          <label className="label" htmlFor="alerts-query">
            Cari Peringatan
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[color:var(--muted-fg)]" />
            <input
              id="alerts-query"
              className="input-field input-field-leading"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari AWB, rute, atau jenis masalah"
            />
          </div>
        </FilterSearch>
        <FilterFields aria-label="Filter pusat peringatan">
          <div className="shell-filter-field">
            <label className="label" htmlFor="alerts-group">
              Kelompok
            </label>
            <GlassSelect
              id="alerts-group"
              aria-label="Filter kelompok peringatan"
              value={group}
              onChange={(value) => setGroup(resolveInitialGroupFilter(value))}
              options={ALERT_GROUP_FILTER_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
            />
          </div>
          <div className="shell-filter-field">
            <label className="label" htmlFor="alerts-workflow">
              Status
            </label>
            <GlassSelect
              id="alerts-workflow"
              aria-label="Filter status penanganan peringatan"
              value={workflow}
              onChange={setWorkflow}
              options={ALERT_WORKFLOW_FILTER_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
            />
          </div>
          <div className="shell-filter-field">
            <label className="label" htmlFor="alerts-severity">
              Tingkat
            </label>
            <GlassSelect
              id="alerts-severity"
              aria-label="Filter tingkat peringatan"
              value={severity}
              onChange={setSeverity}
              options={Object.entries(severityLabels).map(([value, label]) => ({ value, label }))}
            />
          </div>
          <span className="shell-filter-count" aria-label={data ? `${filteredAlerts.length} peringatan tampil` : "Peringatan sedang dimuat"}>
            {data
              ? `${filteredAlerts.length} tampil · ${data.summary.critical} kritis · ${data.summary.warning} perhatian`
              : "…"}
          </span>
        </FilterFields>
      </FilterBar>
      }
      body={
        <OpsPanel className="page-pane alerts-panel flex h-full min-h-0 flex-col overflow-hidden p-4 sm:p-5">
          <SectionHeader className="shrink-0" title="Daftar Peringatan" subtitle="Klik baris untuk detail." />
          <div
            ref={tableScrollRef}
            className="page-scroll internal-scrollbar alerts-table-scroll mt-4 min-h-0 flex-1 table-shell"
          >
            {initialLoading ? (
              <div className="grid gap-3 p-4" aria-label="Memuat daftar peringatan">
                {Array.from({ length: 3 }).map((_, index) => (
                  <SkeletonBlock key={index} className="h-[72px] w-full rounded-[18px]" />
                ))}
              </div>
            ) : paginatedAlerts.length ? (
              <table ref={tableRef} className="data-table min-w-[640px]">
                <thead>
                  <tr>
                    <th>Tingkat</th>
                    <th>Masalah</th>
                    <th>Status</th>
                    <th className="text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedAlerts.map((alert) => {
                    const selected = selectedAlert?.id === alert.id;
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
                          <StatusBadge value={workflowBadgeTone[alert.workflowStatus]} label={workflowLabels[alert.workflowStatus]} />
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
        </OpsPanel>
      }
      footer={
        <PaginationBar
          page={currentAlertPage}
          totalPages={totalAlertPages}
          visibleStart={visibleStart}
          visibleEnd={visibleEnd}
          totalItems={filteredAlerts.length}
          onPageChange={(nextPage) => setAlertPage(nextPage)}
          label="Peringatan"
        />
      }
    />

        <OpsDrawer
          open={detailOpen && Boolean(selectedAlert)}
          eyebrow="Langkah Perbaikan"
          title={selectedAlert ? selectedAlert.entityLabel : "Pilih Peringatan"}
          description={
            selectedAlert
              ? selectedAlert.resolutionFootnote
              : "Ikuti dua langkah: perbaiki data di modul sumber, lalu tandai ditangani di sini bila perlu."
          }
          onClose={() => setDetailOpen(false)}
          className="alerts-detail-modal"
        >
          {initialLoading ? (
            <div className="mt-5 grid gap-4" aria-label="Memuat detail peringatan">
              <SkeletonBlock className="h-8 w-48 rounded-[16px]" />
              <SkeletonBlock className="h-24 w-full rounded-[18px]" />
              <SkeletonBlock className="h-28 w-full rounded-[18px]" />
            </div>
          ) : selectedAlert ? (
            <div className="page-scroll internal-scrollbar alerts-detail-scroll mt-5 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge value={selectedAlert.tone} label={severityLabels[selectedAlert.severity]} />
                <StatusBadge value={workflowBadgeTone[selectedAlert.workflowStatus]} label={workflowLabels[selectedAlert.workflowStatus]} />
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--muted-2)]">
                  {getAlertKindLabel(selectedAlert.kind)}
                </span>
                <span className="rounded-full border border-[color:var(--border-soft)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[color:var(--muted-fg)]">
                  {getAlertGroupLabel(selectedAlert.kind)}
                </span>
                <span className="rounded-full border border-[color:var(--brand-primary)]/25 bg-[color:var(--brand-primary-soft)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[color:var(--brand-primary)]">
                  {selectedAlert.resolutionModeLabel}
                </span>
              </div>

              <div>
                <h2 className="font-[family:var(--font-heading)] text-2xl font-black tracking-[-0.04em] text-[color:var(--text-strong)]">
                  {selectedAlert.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[color:var(--muted-fg)]">{selectedAlert.detail}</p>
              </div>

              <div className="ops-panel-muted space-y-3 p-4">
                <div>
                  <p className="label">Rute</p>
                  <p className="mt-1 font-semibold text-[color:var(--text-strong)]">{selectedAlert.route}</p>
                </div>
                <div>
                  <p className="label">Penyebab</p>
                  <p className="mt-1 text-sm leading-6 text-[color:var(--muted-fg)]">{selectedAlert.cause}</p>
                </div>
                <div>
                  <p className="label">Cara selesai</p>
                  <p className="mt-1 text-sm leading-6 text-[color:var(--muted-fg)]">{selectedAlert.clearCondition}</p>
                </div>
                <div>
                  <p className="label">Muncul sejak</p>
                  <p className="mt-1 text-sm text-[color:var(--muted-fg)]">{formatDateTime(selectedAlert.triggeredAt)}</p>
                </div>
                <div>
                  <p className="label">Batas waktu</p>
                  <p
                    className={cn(
                      "mt-1 text-sm font-semibold",
                      selectedAlert.slaRemainingMinutes < 0
                        ? "text-[color:var(--tone-danger)]"
                        : "text-[color:var(--text-strong)]",
                    )}
                  >
                    {formatAlertSlaLabel(selectedAlert)}
                  </p>
                </div>
                <div>
                  <p className="label">Rekomendasi aksi</p>
                  <p className="mt-1 text-sm leading-6 text-[color:var(--muted-fg)]">{selectedAlert.recommendedAction}</p>
                </div>
              </div>

              <Link href={selectedAlert.href} className="btn btn-primary w-full justify-center">
                <ArrowUpRight size={16} />
                Langkah 1: Buka {selectedAlert.targetModule}
              </Link>

              <div className="flex flex-wrap gap-2">
                {selectedAlert.workflowStatus === "open" ? (
                  <button
                    type="button"
                    className="btn btn-secondary flex-1"
                    disabled={pendingAction}
                    onClick={() => void runAction(selectedAlert, "acknowledge")}
                  >
                    <Hand size={16} />
                    Catat: Sedang Ditangani
                  </button>
                ) : null}
                {selectedAlertManualClose ? (
                  <button
                    type="button"
                    className="btn btn-secondary flex-1"
                    disabled={pendingAction}
                    onClick={() => void runAction(selectedAlert, "resolve")}
                  >
                    <CheckCircle2 size={16} />
                    Tutup Peringatan
                  </button>
                ) : null}
              </div>

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
    </>
  );
}