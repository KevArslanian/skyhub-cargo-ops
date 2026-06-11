"use client";

import Link from "next/link";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import { formatDateTimeCompact } from "@/lib/format";

type AlertSeverity = "critical" | "warning" | "info";

export type DashboardAlertPreviewItem = {
  id: string;
  title: string;
  entityLabel: string;
  severity: AlertSeverity;
  tone: string;
  href: string;
  triggeredAt: string;
};

const SEVERITY_LABELS: Record<AlertSeverity, string> = {
  critical: "Kritis",
  warning: "Perhatian",
  info: "Info",
};

export function DashboardAlertsPanel({
  items,
  loading,
}: {
  items: DashboardAlertPreviewItem[];
  loading?: boolean;
}) {
  if (loading && items.length === 0) {
    return (
      <div className="dashboard-alerts-panel flex min-h-0 flex-1 flex-col overflow-hidden">
        <p className="flex min-h-0 flex-1 items-center justify-center px-3 text-center text-[12px] font-semibold text-[color:var(--muted-fg)]">
          Memuat peringatan…
        </p>
      </div>
    );
  }

  return (
    <div className="dashboard-alerts-panel flex min-h-0 flex-1 flex-col overflow-hidden">
      {items.length === 0 ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-3 text-center">
          <CheckCircle2 className="text-[color:var(--tone-success)]" size={22} aria-hidden="true" />
          <p className="text-[12px] font-semibold text-[color:var(--text-strong)]">Tidak ada peringatan terbuka</p>
        </div>
      ) : (
        <ul className="dashboard-alerts-list min-h-0 flex-1 overflow-hidden">
          {items.map((alert) => (
            <li key={alert.id} className="min-h-0">
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

      <footer className="dashboard-alerts-panel-footer mt-auto flex shrink-0 items-center justify-end gap-2 border-t border-[color:var(--border-soft)] pt-2">
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