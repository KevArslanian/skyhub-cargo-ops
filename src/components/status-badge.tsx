import { cn } from "@/lib/format";

const toneMap: Record<string, string> = {
  received: "border-[color:var(--tone-info-border)] bg-[color:var(--tone-info-soft)] text-[color:var(--tone-info)]",
  sortation: "border-[color:var(--tone-info-border)] bg-[color:var(--tone-info-soft)] text-[color:var(--tone-info)]",
  loaded_to_aircraft: "border-[color:var(--tone-info-border)] bg-[color:var(--tone-info-soft)] text-[color:var(--tone-info)]",
  departed: "border-[color:var(--tone-success-border)] bg-[color:var(--tone-success-soft)] text-[color:var(--tone-success)]",
  arrived: "border-[color:var(--tone-success-border)] bg-[color:var(--tone-success-soft)] text-[color:var(--tone-success)]",
  in_transit: "border-[color:var(--status-in-transit-border)] bg-[color:var(--status-in-transit-soft)] text-[color:var(--status-in-transit)]",
  on_hold: "border-[color:var(--status-on-hold-border)] bg-[color:var(--status-on-hold-soft)] text-[color:var(--status-on-hold)]",
  hold: "border-[color:var(--tone-warning-border)] bg-[color:var(--tone-warning-soft)] text-[color:var(--tone-warning)]",
  on_time: "border-[color:var(--tone-success-border)] bg-[color:var(--tone-success-soft)] text-[color:var(--tone-success)]",
  at_risk: "border-[color:var(--tone-warning-border)] bg-[color:var(--tone-warning-soft)] text-[color:var(--tone-warning)]",
  delayed: "border-[color:var(--status-delayed-border)] bg-[color:var(--status-delayed-soft)] text-[color:var(--status-delayed)]",
  complete: "border-[color:var(--tone-success-border)] bg-[color:var(--tone-success-soft)] text-[color:var(--tone-success)]",
  warning: "border-[color:var(--tone-warning-border)] bg-[color:var(--tone-warning-soft)] text-[color:var(--tone-warning)]",
  success: "border-[color:var(--tone-success-border)] bg-[color:var(--tone-success-soft)] text-[color:var(--tone-success)]",
  info: "border-[color:var(--tone-info-border)] bg-[color:var(--tone-info-soft)] text-[color:var(--tone-info)]",
  error: "border-[color:var(--tone-danger-border)] bg-[color:var(--tone-danger-soft)] text-[color:var(--tone-danger)]",
  active: "border-[color:var(--tone-success-border)] bg-[color:var(--tone-success-soft)] text-[color:var(--tone-success)]",
  invited: "border-[color:var(--tone-warning-border)] bg-[color:var(--tone-warning-soft)] text-[color:var(--tone-warning)]",
  disabled: "border-[color:var(--border-strong)] bg-[color:var(--panel-muted)] text-[color:var(--muted-fg)]",
  normal: "border-[color:var(--tone-success-border)] bg-[color:var(--tone-success-soft)] text-[color:var(--tone-success)]",
  ready: "border-[color:var(--tone-success-border)] bg-[color:var(--tone-success-soft)] text-[color:var(--tone-success)]",
  synced: "border-[color:var(--tone-success-border)] bg-[color:var(--tone-success-soft)] text-[color:var(--tone-success)]",
  live: "border-[color:var(--tone-info-border)] bg-[color:var(--tone-info-soft)] text-[color:var(--tone-info)]",
  review: "border-[color:var(--tone-warning-border)] bg-[color:var(--tone-warning-soft)] text-[color:var(--tone-warning)]",
  incomplete: "border-[color:var(--tone-warning-border)] bg-[color:var(--tone-warning-soft)] text-[color:var(--tone-warning)]",
  pending: "border-[color:var(--tone-warning-border)] bg-[color:var(--tone-warning-soft)] text-[color:var(--tone-warning)]",
  offline: "border-[color:var(--tone-danger-border)] bg-[color:var(--tone-danger-soft)] text-[color:var(--tone-danger)]",
  butuh_review: "border-[color:var(--tone-warning-border)] bg-[color:var(--tone-warning-soft)] text-[color:var(--tone-warning)]",
  "butuh review": "border-[color:var(--tone-warning-border)] bg-[color:var(--tone-warning-soft)] text-[color:var(--tone-warning)]",
  needs_review: "border-[color:var(--tone-warning-border)] bg-[color:var(--tone-warning-soft)] text-[color:var(--tone-warning)]",
  sortasi: "border-[color:var(--tone-info-border)] bg-[color:var(--tone-info-soft)] text-[color:var(--tone-info)]",
  "muat ke pesawat": "border-[color:var(--tone-info-border)] bg-[color:var(--tone-info-soft)] text-[color:var(--tone-info)]",
  belum_lunas: "border-[color:var(--tone-warning-border)] bg-[color:var(--tone-warning-soft)] text-[color:var(--tone-warning)]",
  lunas: "border-[color:var(--tone-success-border)] bg-[color:var(--tone-success-soft)] text-[color:var(--tone-success)]",
  tidak_ditagih: "border-[color:var(--border-strong)] bg-[color:var(--panel-muted)] text-[color:var(--muted-fg)]",
  menunggu_verifikasi: "border-[color:var(--tone-info-border)] bg-[color:var(--tone-info-soft)] text-[color:var(--tone-info)]",
  diterima: "border-[color:var(--tone-info-border)] bg-[color:var(--tone-info-soft)] text-[color:var(--tone-info)]",
  berangkat: "border-[color:var(--tone-success-border)] bg-[color:var(--tone-success-soft)] text-[color:var(--tone-success)]",
  tiba: "border-[color:var(--tone-success-border)] bg-[color:var(--tone-success-soft)] text-[color:var(--tone-success)]",
  tertahan: "border-[color:var(--tone-warning-border)] bg-[color:var(--tone-warning-soft)] text-[color:var(--tone-warning)]",
  partial: "border-[color:var(--tone-warning-border)] bg-[color:var(--tone-warning-soft)] text-[color:var(--tone-warning)]",
};

export function StatusBadge({
  value,
  label,
  className,
  compact = false,
}: {
  value: string;
  label?: string;
  className?: string;
  compact?: boolean;
}) {
  return (
    <span
      aria-label={label ?? value}
      title={compact ? (label ?? value) : undefined}
      className={cn(
        "inline-flex h-7 max-w-full items-center gap-1.5 rounded-full border px-3 text-[11px] font-semibold uppercase tracking-[0.12em]",
        compact ? "min-w-0 truncate" : "whitespace-nowrap",
        toneMap[value.toLowerCase()] || "border-[color:var(--border-strong)] bg-[color:var(--panel-muted)] text-[color:var(--muted-fg)]",
        className,
      )}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
      <span className={compact ? "min-w-0 truncate" : undefined}>{label ?? value}</span>
    </span>
  );
}
