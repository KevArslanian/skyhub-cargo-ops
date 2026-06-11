import Link from "next/link";
import { TowerControl } from "lucide-react";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import { formatDateTimeCompact } from "@/lib/format";
import type { FlightScheduleItem } from "@/lib/dashboard-types";
import { cn } from "@/lib/format";
import { FlightStatusBadge } from "@/components/dashboard/shared";

/** Panel jadwal — layout dua baris per item agar tidak overlap di kolom sempit */
export function FlightSchedulePanel({ flights, metric }: { flights: FlightScheduleItem[]; metric: string }) {
  return (
    <aside className="dashboard-flight-schedule flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-[16px] border border-[color:var(--border-soft)] bg-[color:var(--panel-bg)] p-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
      <header className="mb-3 flex shrink-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <TowerControl size={16} className="shrink-0 text-[color:var(--brand-primary)]" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-[color:var(--muted-2)]">Jadwal Pesawat</p>
            <p className="truncate text-[11px] text-[color:var(--muted-fg)]">{metric}</p>
          </div>
        </div>
        {/* Route unik: daftar penerbangan control-center */}
        <Link href={DASHBOARD_ROUTES.flights.list} className="shrink-0 text-[12px] font-bold text-[color:var(--brand-primary)] hover:underline">
          Semua
        </Link>
      </header>

      <div className="dashboard-flight-schedule-list min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5">
        {flights.length ? (
          flights.slice(0, 5).map((flight) => (
            <article
              key={flight.id}
              className={cn(
                "dashboard-flight-schedule-item rounded-[12px] border px-3 py-2.5",
                flight.needsAction
                  ? "border-[color:var(--tone-warning-border)] bg-[color:var(--tone-warning-soft)]"
                  : flight.status === "departed"
                    ? "border-[color:var(--tone-success-border)] bg-[color:var(--tone-success-soft)]"
                    : "border-[color:var(--border-soft)] bg-[color:var(--panel-muted)]",
              )}
            >
              <div className="flex min-w-0 items-center justify-between gap-2">
                <p className="truncate font-mono text-[14px] font-bold text-[color:var(--text-strong)]">{flight.flightNumber}</p>
                <FlightStatusBadge status={flight.status} label={flight.statusLabel} />
              </div>
              <div className="mt-1.5 flex min-w-0 flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[12px] text-[color:var(--muted-fg)]">{flight.route}</p>
                  <p className="text-[11px] font-medium text-[color:var(--muted-2)]">STD {formatDateTimeCompact(flight.departureTime)}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Link href={flight.openHref} className="text-[12px] font-bold text-[color:var(--brand-primary)] hover:underline">
                    Buka
                  </Link>
                  {flight.needsAction ? (
                    <Link href={flight.manageHref} className="text-[12px] font-bold text-[color:var(--tone-warning)] hover:underline">
                      Atur
                    </Link>
                  ) : null}
                </div>
              </div>
            </article>
          ))
        ) : (
          <p className="py-4 text-center text-sm text-[color:var(--muted-fg)]">Belum ada penerbangan hari ini.</p>
        )}
      </div>
    </aside>
  );
}