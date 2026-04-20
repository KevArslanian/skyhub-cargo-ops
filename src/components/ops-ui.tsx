"use client";

import type { LucideIcon } from "lucide-react";
import { cn, formatNumber } from "@/lib/format";

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("ops-page-header flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between", className)}>
      <div className="space-y-2">
        {eyebrow ? <p className="ops-eyebrow">{eyebrow}</p> : null}
        <h1 className="page-title">{title}</h1>
        <p className="page-subtitle max-w-3xl">{subtitle}</p>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </header>
  );
}

export function OpsPanel({
  children,
  className,
  tone = "default",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "default" | "muted" | "strong";
}) {
  const toneClass =
    tone === "muted" ? "ops-panel-muted" : tone === "strong" ? "ops-panel-strong" : "ops-panel";
  return <section className={cn(toneClass, className)}>{children}</section>;
}

export function SectionHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 border-b border-[color:var(--border-soft)] pb-4 xl:flex-row xl:items-end xl:justify-between", className)}>
      <div>
        <h2 className="text-[1.25rem] font-[family:var(--font-heading)] font-extrabold tracking-[-0.03em] text-[color:var(--text-strong)]">
          {title}
        </h2>
        {subtitle ? <p className="mt-1 text-sm leading-6 text-[color:var(--muted-fg)]">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

const statToneClasses: Record<string, string> = {
  primary: "text-[color:var(--brand-primary)] bg-[color:var(--brand-primary-soft)]",
  success: "text-[color:var(--tone-success)] bg-[color:var(--tone-success-soft)]",
  warning: "text-[color:var(--tone-warning)] bg-[color:var(--tone-warning-soft)]",
  danger: "text-[color:var(--tone-danger)] bg-[color:var(--tone-danger-soft)]",
  info: "text-[color:var(--tone-info)] bg-[color:var(--tone-info-soft)]",
};

export function StatCard({
  label,
  value,
  note,
  icon: Icon,
  tone = "primary",
  className,
}: {
  label: string;
  value: number | string;
  note: string;
  icon?: LucideIcon;
  tone?: keyof typeof statToneClasses;
  className?: string;
}) {
  const renderedValue = typeof value === "number" ? formatNumber(value) : value;

  return (
    <article className={cn("metric-card", className)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-2)]">{label}</p>
          <p className="mt-4 font-[family:var(--font-heading)] text-[2rem] font-black tracking-[-0.05em] text-[color:var(--text-strong)]">
            {renderedValue}
          </p>
        </div>
        {Icon ? (
          <div className={cn("inline-flex h-11 w-11 items-center justify-center rounded-2xl", statToneClasses[tone])}>
            <Icon size={18} />
          </div>
        ) : null}
      </div>
      <p className="mt-3 text-sm leading-6 text-[color:var(--muted-fg)]">{note}</p>
    </article>
  );
}

export function FilterBar({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("ops-filter-bar", className)}>{children}</div>;
}

export function EmptyState({
  icon: Icon,
  title,
  copy,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  copy: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("ops-empty", className)}>
      <div className="ops-empty-icon">
        <Icon size={26} />
      </div>
      <h3 className="mt-5 font-[family:var(--font-heading)] text-xl font-extrabold tracking-[-0.03em] text-[color:var(--text-strong)]">
        {title}
      </h3>
      <p className="mt-3 max-w-xl text-sm leading-7 text-[color:var(--muted-fg)]">{copy}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
