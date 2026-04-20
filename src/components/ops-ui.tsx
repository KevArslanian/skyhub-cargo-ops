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
    <header className={cn("flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between", className)}>
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

const dataCardToneClasses = {
  default: "border-[color:var(--border-soft)] bg-[color:var(--panel-muted)]",
  primary:
    "border-[color:rgba(0,82,204,0.12)] bg-[linear-gradient(180deg,rgba(0,82,204,0.08),var(--panel-bg))]",
  success:
    "border-[color:var(--tone-success-border)] bg-[linear-gradient(180deg,var(--tone-success-soft),var(--panel-bg))]",
  warning:
    "border-[color:var(--tone-warning-border)] bg-[linear-gradient(180deg,var(--tone-warning-soft),var(--panel-bg))]",
  danger:
    "border-[color:var(--tone-danger-border)] bg-[linear-gradient(180deg,var(--tone-danger-soft),var(--panel-bg))]",
  info: "border-[color:var(--tone-info-border)] bg-[linear-gradient(180deg,var(--tone-info-soft),var(--panel-bg))]",
} as const;

export function DataCard({
  label,
  value,
  note,
  meta,
  icon: Icon,
  tone = "default",
  className,
  valueClassName,
  footer,
}: {
  label: string;
  value: React.ReactNode;
  note?: React.ReactNode;
  meta?: React.ReactNode;
  icon?: LucideIcon;
  tone?: keyof typeof dataCardToneClasses;
  className?: string;
  valueClassName?: string;
  footer?: React.ReactNode;
}) {
  return (
    <article
      className={cn(
        "rounded-[24px] border px-4 py-4 transition-transform duration-150 hover:-translate-y-[1px]",
        dataCardToneClasses[tone],
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-2)]">{label}</p>
          <div
            className={cn(
              "mt-3 font-[family:var(--font-heading)] text-[1.45rem] font-black tracking-[-0.04em] text-[color:var(--text-strong)]",
              valueClassName,
            )}
          >
            {value}
          </div>
          {note ? <div className="mt-2 text-sm leading-6 text-[color:var(--muted-fg)]">{note}</div> : null}
        </div>
        {Icon ? (
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] border border-[color:var(--border-soft)] bg-white/65 text-[color:var(--brand-primary)] dark:bg-white/5">
            <Icon size={18} />
          </span>
        ) : null}
      </div>
      {meta ? <div className="mt-4 border-t border-[color:var(--border-soft)] pt-3 text-xs text-[color:var(--muted-fg)]">{meta}</div> : null}
      {footer ? <div className="mt-4">{footer}</div> : null}
    </article>
  );
}

export function FilterBar({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("ops-filter-bar", className)}>{children}</div>;
}

export function SkeletonBlock({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("ops-skeleton rounded-[20px]", className)} />;
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
