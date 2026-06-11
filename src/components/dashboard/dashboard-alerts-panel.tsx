"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, BellRing, CheckCircle2 } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { SkeletonBlock } from "@/components/ops-ui";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import { formatDateTimeCompact } from "@/lib/format";
import { networkErrorMessage, readApiError } from "@/lib/ops-feedback";

type AlertSeverity = "critical" | "warning" | "info";
type AlertWorkflowStatus = "open" | "acknowledged" | "snoozed" | "resolved";

type DashboardAlertItem = {
  id: string;
  title: string;
  entityLabel: string;
  severity: AlertSeverity;
  tone: string;
  href: string;
  triggeredAt: string;
  workflowStatus: AlertWorkflowStatus;
};

const SEVERITY_LABELS: Record<AlertSeverity, string> = {
  critical: "Kritis",
  warning: "Perhatian",
  info: "Info",
};

const PREVIEW_LIMIT = 4;

export function DashboardAlertsPanel({
  openCount,
  loading: summaryLoading,
}: {
  openCount: number;
  loading?: boolean;
}) {
  const [items, setItems] = useState<DashboardAlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/alerts", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(await readApiError(response, "Gagal memuat peringatan."));
      }
      const payload = (await response.json()) as { alerts?: DashboardAlertItem[] };
      const open = (payload.alerts ?? [])
        .filter((alert) => alert.workflowStatus === "open")
        .slice(0, PREVIEW_LIMIT);
      setItems(open);
    } catch {
      setError(networkErrorMessage("memuat peringatan"));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAlerts();
  }, [loadAlerts, openCount]);

  const showSkeleton = loading || summaryLoading;

  return (
    <div className="dashboard-alerts-panel flex min-h-0 flex-1 flex-col overflow-hidden">
      {showSkeleton ? (
        <div className="grid min-h-0 flex-1 gap-2 overflow-hidden p-1" aria-label="Memuat peringatan">
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonBlock key={`alert-sk-${index}`} className="h-[44px] w-full rounded-[12px]" />
          ))}
        </div>
      ) : error ? (
        <div className="flex min-h-0 flex-1 flex-col items-start justify-center gap-2 px-2 py-3">
          <p className="text-[12px] text-[color:var(--tone-danger)]">{error}</p>
          <button type="button" className="btn btn-secondary h-8 px-3 text-xs" onClick={() => void loadAlerts()}>
            Muat ulang
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-3 text-center">
          <CheckCircle2 className="text-[color:var(--tone-success)]" size={22} aria-hidden="true" />
          <p className="text-[12px] font-semibold text-[color:var(--text-strong)]">Tidak ada peringatan terbuka</p>
        </div>
      ) : (
        <ul className="dashboard-alerts-list min-h-0 flex-1 overflow-hidden">
          {items.map((alert) => (
            <li key={alert.id}>
              <Link href={alert.href || DASHBOARD_ROUTES.alerts.center} className="dashboard-alerts-item group" title={alert.title}>
                <StatusBadge value={alert.tone} label={SEVERITY_LABELS[alert.severity]} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-semibold text-[color:var(--text-strong)]">{alert.entityLabel}</p>
                  <p className="truncate text-[11px] text-[color:var(--muted-fg)]">{alert.title}</p>
                </div>
                <span className="shrink-0 text-[10px] font-semibold tabular-nums text-[color:var(--muted-2)]">
                  {formatDateTimeCompact(alert.triggeredAt)}
                </span>
                <ArrowUpRight
                  size={14}
                  className="shrink-0 text-[color:var(--muted-2)] opacity-0 transition-opacity group-hover:opacity-100"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <footer className="dashboard-alerts-panel-footer mt-auto flex shrink-0 items-center justify-between gap-2 border-t border-[color:var(--border-soft)] pt-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[color:var(--muted-fg)]">
          <BellRing size={13} aria-hidden="true" />
          {summaryLoading ? "…" : openCount} terbuka
        </span>
        <Link
          href={DASHBOARD_ROUTES.alerts.center}
          className="text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--brand-primary)] hover:underline"
        >
          Lihat semua
        </Link>
      </footer>
    </div>
  );
}