import { cn, formatDateTime } from "@/lib/format";

export function FlightStatusBadge({ status, label }: { status: string; label: string }) {
  const toneMap: Record<string, string> = {
    on_time: "border-[color:var(--tone-info-border)] text-[color:var(--tone-info)] bg-[color:var(--tone-info-soft)]",
    at_risk: "border-[color:var(--tone-warning-border)] text-[color:var(--tone-warning)] bg-[color:var(--tone-warning-soft)]",
    delayed: "border-[color:var(--tone-danger-border)] text-[color:var(--tone-danger)] bg-[color:var(--tone-danger-soft)]",
    departed: "border-[color:var(--tone-success-border)] text-[color:var(--tone-success)] bg-[color:var(--tone-success-soft)]",
  };

  return (
    <span className={cn("inline-flex max-w-[120px] truncate rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", toneMap[status] ?? "border-[color:var(--border-soft)] text-[color:var(--muted-fg)] bg-[color:var(--panel-muted)]")} title={label}>
      {label}
    </span>
  );
}

export function ActivityLevelDot({ level, className }: { level: string; className?: string }) {
  const color =
    level === "error"
      ? "hsl(350, 89%, 60%)"
      : level === "warning"
        ? "hsl(38, 92%, 50%)"
        : level === "success"
          ? "hsl(142, 72%, 35%)"
          : "hsl(226, 70%, 50%)";

  return <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", className)} style={{ backgroundColor: color }} aria-hidden="true" />;
}

export function MicroBadge({ value, label }: { value: string; label: string }) {
  const toneMap: Record<string, string> = {
    arrived: "border-[color:var(--tone-success-border)] text-[color:var(--tone-success)] bg-[color:var(--tone-success-soft)]",
    departed: "border-[color:var(--tone-info-border)] text-[color:var(--tone-info)] bg-[color:var(--tone-info-soft)]",
    loaded_to_aircraft: "border-[color:var(--brand-primary)]/30 text-[color:var(--brand-primary)] bg-[color:var(--brand-primary-soft)]",
    sortation: "border-[color:var(--tone-info-border)] text-[color:var(--tone-info)] bg-[color:var(--tone-info-soft)]",
    received: "border-[color:var(--border-soft)] text-[color:var(--muted-fg)] bg-[color:var(--panel-muted)]",
    hold: "border-[color:var(--tone-warning-border)] text-[color:var(--tone-warning)] bg-[color:var(--tone-warning-soft)]",
  };

  return (
    <span className={cn("inline-block max-w-full truncate rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", toneMap[value] ?? "border-[color:var(--border-soft)] text-[color:var(--muted-fg)] bg-[color:var(--panel-muted)]")} title={label}>
      {label}
    </span>
  );
}

export function AlertPriorityBadge({ level }: { level: "P1" | "P2" | "P3" }) {
  const tone =
    level === "P1"
      ? "bg-[color:var(--tone-danger-soft)] text-[color:var(--tone-danger)] border-[color:var(--tone-danger-border)]"
      : level === "P2"
        ? "bg-[color:var(--tone-warning-soft)] text-[color:var(--tone-warning)] border-[color:var(--tone-warning-border)]"
        : "bg-[color:var(--tone-info-soft)] text-[color:var(--tone-info)] border-[color:var(--tone-info-border)]";

  return (
    <span className={cn("inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase", tone)}>
      {level}
    </span>
  );
}

export function formatActivityTime(createdAt: string) {
  return formatDateTime(createdAt);
}