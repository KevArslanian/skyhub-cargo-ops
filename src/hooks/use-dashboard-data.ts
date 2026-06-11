"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useOpsAlert } from "@/components/ops-alert-provider";
import { networkErrorMessage, readApiError } from "@/lib/ops-feedback";
import {
  buildAircraftStatusRows,
  buildFlightScheduleItems,
  buildKpiCards,
  buildRevenueSummary,
  buildShipmentFlow,
  sortFlightsByCutoff,
} from "@/lib/dashboard-view-model";
import type { BaseShipment, DashboardFlightSummary } from "@/lib/dashboard-types";

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
  flightsSummary: DashboardFlightSummary[];
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
const EMPTY_SHIPMENTS: BaseShipment[] = [];
const EMPTY_FLIGHTS: DashboardFlightSummary[] = [];

type DashboardFetchFailure = "none" | "toast" | "modal";

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

export function useDashboardData() {
  const { showAlert, showToast } = useOpsAlert();
  const [kpiData, setKpiData] = useState<DashboardKpiPayload | null>(null);
  const [alertsData, setAlertsData] = useState<DashboardAlertsPayload | null>(null);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [kpiSlow, setKpiSlow] = useState(false);
  const [kpiError, setKpiError] = useState<string | null>(null);

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
      if (!detail?.pathname?.startsWith("/dashboard") || !detail.query) return;
      setDashboardQuery(detail.query);
    }
    window.addEventListener("skyhub:context-search", handleContextSearch as EventListener);
    return () => window.removeEventListener("skyhub:context-search", handleContextSearch as EventListener);
  }, []);

  const reportDashboardFailure = useCallback(
    (failure: DashboardFetchFailure, title: string, description: string, tone: "error" | "warning" = "error") => {
      if (failure === "none") return;
      if (failure === "toast") {
        showToast({ title, description, tone: tone === "warning" ? "warning" : "info" });
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
          if (response.ok) return (await response.json()) as T;
          if ((response.status === 503 || response.status === 502) && attempt < maxAttempts) {
            await new Promise((resolve) => window.setTimeout(resolve, 1000 * attempt));
            continue;
          }
          reportDashboardFailure(failureMode, failureTitle, await readApiError(response, errorLabel));
          return null;
        } catch {
          if (attempt < maxAttempts) {
            await new Promise((resolve) => window.setTimeout(resolve, 1000 * attempt));
            continue;
          }
          reportDashboardFailure(failureMode, "Koneksi Terputus", networkErrorMessage("memuat dasbor operasional"), "warning");
          return null;
        }
      }
      return null;
    },
    [reportDashboardFailure],
  );

  const requestDashboardKpis = useCallback(
    async (dateFilter?: { dateFrom?: string; dateTo?: string }, options?: { failure?: DashboardFetchFailure }) => {
      const params = buildDashboardSearchParams({ kpisOnly: true, dateFrom: dateFilter?.dateFrom, dateTo: dateFilter?.dateTo });
      return fetchDashboardEndpoint<DashboardKpiPayload>(params, "Ringkasan dasbor belum bisa dimuat.", {
        failure: options?.failure ?? "modal",
        failureTitle: "Gagal Memuat Dasbor",
      });
    },
    [fetchDashboardEndpoint],
  );

  const requestDashboardAlerts = useCallback(async () => {
    const params = buildDashboardSearchParams({ alertsOnly: true });
    return fetchDashboardEndpoint<DashboardAlertsPayload>(params, "Peringatan dasbor belum bisa dimuat.", {
      failure: "none",
      failureTitle: "Peringatan Dasbor",
    });
  }, [fetchDashboardEndpoint]);

  const loadDashboardAlerts = useCallback(async (mode: "initial" | "refresh" = "refresh") => {
    if (mode === "initial" || !hasAlertsDataRef.current) setAlertsLoading(true);
    const silentRetries = mode === "initial" ? 3 : 1;
    let payload: DashboardAlertsPayload | null = null;

    for (let attempt = 1; attempt <= silentRetries; attempt += 1) {
      payload = await requestDashboardAlerts();
      if (payload) break;
      if (attempt < silentRetries) {
        await new Promise((resolve) => window.setTimeout(resolve, 700 * attempt));
      }
    }

    if (payload) {
      setAlertsData(payload);
      hasAlertsDataRef.current = true;
    }
    setAlertsLoading(false);
  }, [requestDashboardAlerts]);

  const loadDashboardKpis = useCallback(
    async (mode: "initial" | "refresh" = "refresh", dateFilter?: { dateFrom?: string; dateTo?: string }, options?: { failure?: DashboardFetchFailure }) => {
      if (mode === "initial") {
        setKpiLoading(true);
        setKpiSlow(false);
      }
      const failure = options?.failure ?? (mode === "refresh" && kpiData ? "toast" : mode === "initial" ? "none" : "modal");
      const payload = await requestDashboardKpis(dateFilter, { failure });
      if (payload) {
        setKpiData(payload);
        setKpiError(null);
      } else if (mode === "initial" && !kpiData) {
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

    void (async () => {
      const kpiPayload = await requestDashboardKpis({ dateFrom, dateTo }, { failure: "none" });
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
      void loadDashboardAlerts("initial");
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(slowTimer);
    };
  }, [dateFrom, dateTo, loadDashboardAlerts, requestDashboardKpis]);

  useEffect(() => {
    if (!dateFilterReadyRef.current) return;
    void loadDashboardKpis("refresh", { dateFrom, dateTo });
  }, [dateFrom, dateTo, loadDashboardKpis]);

  const retryDashboardKpis = useCallback(() => {
    void loadDashboardKpis("initial", { dateFrom, dateTo });
  }, [dateFrom, dateTo, loadDashboardKpis]);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/settings", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as { settings?: { autoRefresh: boolean; refreshIntervalSeconds: number } };
        if (payload?.settings) {
          setRefreshSettings({
            autoRefresh: payload.settings.autoRefresh,
            refreshIntervalSeconds: payload.settings.refreshIntervalSeconds,
          });
        }
      } catch {
        /* keep defaults */
      }
    })();
  }, []);

  useEffect(() => {
    if (!refreshSettings.autoRefresh || !kpiData) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void Promise.all([
        loadDashboardKpis("refresh", { dateFrom, dateTo }, { failure: "none" }),
        loadDashboardAlerts("refresh"),
      ]);
    }, refreshSettings.refreshIntervalSeconds * 1000);
    return () => window.clearInterval(interval);
  }, [dateFrom, dateTo, kpiData, loadDashboardAlerts, loadDashboardKpis, refreshSettings]);

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

  const metrics = internalData?.metrics;
  const alertSummary = internalData?.alertSummary ?? EMPTY_ALERT_SUMMARY;

  const viewModel = useMemo(() => {
    const inFlowCount = metrics?.inFlowCount ?? 0;
    const flow = buildShipmentFlow(shipmentsToday, inFlowCount);
    const revenue = buildRevenueSummary(shipmentsToday);
    const aircraftRows = buildAircraftStatusRows({
      onTime: metrics?.onTime ?? 0,
      atRisk: metrics?.atRisk ?? 0,
      delayed: metrics?.delayed ?? 0,
      departed: metrics?.departed ?? 0,
    });
    const flightSchedule = buildFlightScheduleItems(sortedFlights);
    const kpiCards = buildKpiCards({
      shipmentsCount: shipmentsToday.length,
      inFlowCount: metrics?.inFlowCount ?? inFlowCount,
      openAlertsCount: alertsLoading ? "…" : alertSummary.open,
      urgentAlertsCount: alertSummary.critical + alertSummary.warning,
      reviewIssuesCount: metrics?.docReviewCount ?? 0,
      holdsToday: metrics?.holds ?? 0,
      alertsLoading,
    });
    const flightScope = metrics?.flightScope ?? "nearest";
    const flightScheduleMetric = flightScope === "window" ? `${flightsToday.length} jadwal` : `${flightsToday.length} terdekat`;

    return { flow, revenue, aircraftRows, flightSchedule, kpiCards, flightScheduleMetric };
  }, [alertSummary, alertsLoading, flightsToday.length, metrics, shipmentsToday, sortedFlights]);

  const refreshKpis = useCallback(async () => {
    await loadDashboardKpis("refresh", { dateFrom, dateTo }, { failure: "none" });
  }, [dateFrom, dateTo, loadDashboardKpis]);

  return {
    kpiLoading,
    kpiSlow,
    kpiError,
    alertsLoading,
    kpiData,
    internalData,
    shipmentsToday,
    flightsToday,
    sortedFlights,
    metrics,
    alertSummary,
    recentActivity: internalData?.recentActivity ?? [],
    dashboardQuery,
    setDashboardQuery,
    dateFrom,
    dateTo,
    viewModel,
    retryDashboardKpis,
    refreshKpis,
    showAlert,
    showToast,
  };
}

export type DashboardDataContext = ReturnType<typeof useDashboardData>;

function textMatchesQuery(values: Array<string | number | null | undefined>, query: string) {
  const n = query.trim().toLowerCase();
  return !n || values.join(" ").toLowerCase().includes(n);
}

export function filterShipmentsByQuery(shipments: BaseShipment[], query: string) {
  if (!query) return shipments;
  return shipments.filter((s) =>
    textMatchesQuery([s.awb, s.commodity, s.origin, s.destination, s.statusLabel, s.flightNumber], query),
  );
}

export function filterFlightsByQuery(flights: DashboardFlightSummary[], query: string) {
  if (!query) return flights;
  return flights.filter((f) => textMatchesQuery([f.flightNumber, f.route, f.statusLabel, f.airlineName], query));
}

export function filterActivitiesByQuery<
  T extends { id: string; action: string; description: string; targetLabel: string; userName: string; level: string; createdAt: string },
>(
  items: T[],
  query: string,
) {
  if (!query) return items;
  return items.filter((a) => textMatchesQuery([a.action, a.description, a.targetLabel, a.userName], query));
}