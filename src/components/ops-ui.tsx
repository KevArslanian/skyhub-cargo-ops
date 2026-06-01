import { ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";
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
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  // The visible page title lives in the app topbar; expose a semantic heading
  // here for screen readers and landmark navigation, then render the action bar.
  return (
    <>
      <h1 className="sr-only">{eyebrow ? `${eyebrow} — ${title}` : title}</h1>
      {subtitle ? <p className="sr-only">{subtitle}</p> : null}
      {actions ? (
        <header className={cn("page-action-toolbar", className)} aria-label="Aksi halaman">
          <div className="flex max-w-full shrink-0 flex-wrap items-center gap-3">{actions}</div>
        </header>
      ) : null}
    </>
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
  return <section className={cn(toneClass, "min-w-0 max-w-full", className)}>{children}</section>;
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
    <div className={cn("flex min-w-0 max-w-full flex-col gap-3 border-b border-[color:var(--border-soft)] pb-4 xl:flex-row xl:items-end xl:justify-between", className)}>
      <div className="min-w-0">
        <h2 className="text-[1.25rem] font-[family:var(--font-heading)] font-extrabold tracking-[-0.03em] text-[color:var(--text-strong)]">
          {title}
        </h2>
        {subtitle ? <p className="mt-1 text-sm leading-6 text-[color:var(--muted-fg)]">{subtitle}</p> : null}
      </div>
      {action ? <div className="flex max-w-full shrink-0 flex-wrap items-center gap-3 xl:justify-end">{action}</div> : null}
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
  value: React.ReactNode;
  note: string;
  icon?: LucideIcon;
  tone?: keyof typeof statToneClasses;
  className?: string;
}) {
  const renderedValue = typeof value === "number" ? formatNumber(value) : value;

  return (
    <article className={cn("metric-card min-w-0 max-w-full", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-2)]">{label}</p>
          <p className="mt-4 break-words font-[family:var(--font-heading)] text-[2rem] font-black tracking-[-0.05em] text-[color:var(--text-strong)]">
            {renderedValue}
          </p>
        </div>
        {Icon ? (
          <div className={cn("inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", statToneClasses[tone])}>
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
        "min-w-0 max-w-full rounded-[24px] border px-4 py-4 transition-transform duration-150 hover:-translate-y-[1px]",
        dataCardToneClasses[tone],
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-2)]">{label}</p>
          <div
            className={cn(
              "mt-3 break-words font-[family:var(--font-heading)] text-[1.45rem] font-black tracking-[-0.04em] text-[color:var(--text-strong)]",
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
      {meta ? <div className="mt-4 min-w-0 border-t border-[color:var(--border-soft)] pt-3 text-xs text-[color:var(--muted-fg)]">{meta}</div> : null}
      {footer ? <div className="mt-4 min-w-0">{footer}</div> : null}
    </article>
  );
}

export function FilterBar({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("ops-filter-bar", className)}>{children}</div>;
}

export function SkeletonBlock({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("ops-skeleton rounded-[20px]", className)} />;
}

const emptyVariantIconClasses: Record<string, string> = {
  neutral: "text-[color:var(--muted-2)] bg-[color:var(--panel-muted)]",
  filtered: "text-[color:var(--brand-primary)] bg-[color:var(--brand-primary-soft)]",
  success: "text-[color:var(--tone-success)] bg-[color:var(--tone-success-soft)]",
  warning: "text-[color:var(--tone-warning)] bg-[color:var(--tone-warning-soft)]",
};

export function EmptyState({
  icon: Icon,
  title,
  copy,
  action,
  variant = "neutral",
  className,
}: {
  icon: LucideIcon;
  title: string;
  copy: string;
  action?: React.ReactNode;
  variant?: "neutral" | "filtered" | "success" | "warning";
  className?: string;
}) {
  return (
    <div className={cn("ops-empty", className)}>
      <div className={cn("ops-empty-icon", emptyVariantIconClasses[variant])}>
        <Icon size={26} />
      </div>
      <h3 className="mt-5 font-[family:var(--font-heading)] text-xl font-extrabold tracking-[-0.03em] text-[color:var(--text-strong)]">
        {title}
      </h3>
      <p className="mx-auto mt-3 max-w-xl text-center text-sm leading-7 text-[color:var(--muted-fg)]">{copy}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function PaginationBar({
  page,
  totalPages,
  visibleStart,
  visibleEnd,
  totalItems,
  onPageChange,
  label = "Halaman",
}: {
  page: number;
  totalPages: number;
  visibleStart: number;
  visibleEnd: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  label?: string;
}) {
  return (
    <div className="table-pagination-footer">
      <button
        type="button"
        className="topbar-button"
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page <= 1}
      >
        <ChevronLeft size={16} />
        Sebelumnya
      </button>
      <p className="text-xs font-semibold text-[color:var(--muted-fg)]">
        {totalItems > 0 ? `${visibleStart}-${visibleEnd}` : "0-0"} dari {totalItems} • {label} {page}/{totalPages}
      </p>
      <button
        type="button"
        className="topbar-button"
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
      >
        Berikutnya
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
