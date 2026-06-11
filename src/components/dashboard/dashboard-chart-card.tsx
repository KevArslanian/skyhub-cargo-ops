import type { ReactNode } from "react";
import { cn } from "@/lib/format";

export function DashboardChartCard({
  title,
  metric,
  metricNote,
  metricWide = false,
  accent,
  className,
  footerNote,
  children,
}: {
  title: string;
  metric?: string;
  metricNote?: string;
  metricWide?: boolean;
  accent?: string;
  className?: string;
  footerNote?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "dashboard-chart-card flex min-h-[200px] max-h-full min-w-0 flex-col overflow-hidden rounded-[16px] border border-[color:var(--border-soft)] bg-[color:var(--panel-bg)] p-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)]",
        className,
      )}
    >
      <header className="flex shrink-0 items-start justify-between gap-3">
        <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-[color:var(--muted-2)]">{title}</p>
        {metric ? (
          <div className="shrink-0 text-right">
            <strong
              className={cn(
                "inline-block truncate rounded-full px-2.5 py-1 font-bold tabular-nums",
                metricWide ? "max-w-[min(240px,42vw)] text-[12px]" : "max-w-[96px] text-[1.05rem]",
              )}
              style={accent ? { color: accent, backgroundColor: `${accent}18` } : undefined}
              title={metric}
            >
              {metric}
            </strong>
            {metricNote ? (
              <span
                className={cn(
                  "mt-0.5 block truncate text-[11px] font-semibold text-[color:var(--muted-fg)]",
                  metricWide ? "max-w-[min(240px,42vw)]" : "max-w-[180px]",
                )}
                title={metricNote}
              >
                {metricNote}
              </span>
            ) : null}
          </div>
        ) : null}
      </header>
      <div className="dashboard-chart-card-body mt-2 min-h-0 flex-1 overflow-hidden">{children}</div>
      {footerNote ? (
        <footer className="dashboard-chart-card-footer mt-2 shrink-0 border-t border-[color:var(--border-soft)] pt-2">{footerNote}</footer>
      ) : null}
    </section>
  );
}