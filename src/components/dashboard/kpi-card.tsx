import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/format";
import type { DashboardKpiTone } from "@/lib/dashboard-types";

type KpiCardProps = {
  id: string;
  href: string;
  label: string;
  value: string | number;
  note?: string;
  icon: LucideIcon;
  tone: DashboardKpiTone;
};

const toneClass: Record<DashboardKpiTone, string> = {
  primary: "bg-[color:var(--brand-primary-soft)] text-[color:var(--brand-primary)]",
  success: "bg-[color:var(--tone-success-soft)] text-[color:var(--tone-success)]",
  warning: "bg-[color:var(--tone-warning-soft)] text-[color:var(--tone-warning)]",
  danger: "bg-[color:var(--tone-danger-soft)] text-[color:var(--tone-danger)]",
  info: "bg-[color:var(--tone-info-soft)] text-[color:var(--tone-info)]",
};

const toneSurfaceClass: Record<DashboardKpiTone, string> = {
  primary: "dashboard-kpi-card--primary",
  success: "dashboard-kpi-card--success",
  warning: "dashboard-kpi-card--warning",
  danger: "dashboard-kpi-card--danger",
  info: "dashboard-kpi-card--info",
};

/** KPI utama — angka besar, label line-clamp agar tidak terpotong ekstrem */
export function KpiCard({ id, href, label, value, note, icon: Icon, tone }: KpiCardProps) {
  return (
    <Link
      id={id}
      href={href}
      className={cn(
        "dashboard-kpi-card group flex min-h-[72px] min-w-0 flex-col justify-center gap-2 rounded-[14px] border border-[color:var(--border-soft)] px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-[color:var(--brand-primary)]/35",
        toneSurfaceClass[tone],
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]", toneClass[tone])}>
          <Icon size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <span className="line-clamp-2 text-[12px] font-semibold leading-snug text-[color:var(--muted-fg)]">{label}</span>
          <div className="mt-1 flex min-w-0 items-baseline gap-1.5">
            <strong className="font-[family:var(--font-heading)] text-[1.5rem] font-black leading-none tracking-[-0.02em] text-[color:var(--text-strong)] tabular-nums">
              {value}
            </strong>
            {note ? <span className="truncate text-[11px] font-semibold text-[color:var(--muted-fg)]">{note}</span> : null}
          </div>
        </div>
      </div>
    </Link>
  );
}