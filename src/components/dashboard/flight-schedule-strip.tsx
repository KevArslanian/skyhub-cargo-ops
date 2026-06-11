"use client";

import Link from "next/link";
import { useRef } from "react";
import { TowerControl } from "lucide-react";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import { formatDateTimeCompact } from "@/lib/format";
import type { FlightScheduleItem } from "@/lib/dashboard-types";
import { cn } from "@/lib/format";
import { FlightStatusBadge } from "@/components/dashboard/shared";
import { useVisibleListPageSize } from "@/lib/use-visible-list-page-size";

/** Jadwal vertikal — baris muat di panel, tanpa scroll horizontal */
export function FlightScheduleStrip({ flights, metric }: { flights: FlightScheduleItem[]; metric: string }) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const visibleCount = useVisibleListPageSize(
    listRef,
    flights.length > 0,
    flights.length,
    "[data-flight-schedule-row]",
    { fallback: 3, min: 2, max: 6, gapPx: 6 },
  );
  const renderCount = Math.min(flights.length, Math.max(visibleCount, 2));
  const renderFlights = flights.slice(0, renderCount);
  const hiddenCount = Math.max(0, flights.length - renderCount);

  return (
    <section className="dashboard-flight-schedule-strip dashboard-flight-schedule-stack flex min-h-0 shrink-0 flex-col overflow-hidden rounded-[16px] border border-[color:var(--border-soft)] bg-[color:var(--panel-bg)] p-3 shadow-[0_1px_3px_rgba(15,23,42,0.05)] sm:p-4">
      <header className="dashboard-flight-schedule-stack-head mb-2 flex shrink-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <TowerControl size={15} className="shrink-0 text-[color:var(--brand-primary)]" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[color:var(--muted-2)]">Jadwal Pesawat</p>
            <p className="truncate text-[11px] text-[color:var(--muted-fg)]">
              {metric}
              {hiddenCount > 0 ? ` · +${hiddenCount} lainnya` : ""}
            </p>
          </div>
        </div>
        <Link href={DASHBOARD_ROUTES.flights.list} className="shrink-0 text-[12px] font-bold text-[color:var(--brand-primary)] hover:underline">
          Semua
        </Link>
      </header>

      <div ref={listRef} className="dashboard-flight-schedule-stack-list min-h-0 flex-1 overflow-hidden">
        {flights.length ? (
          <div className="flex min-h-0 flex-col gap-1.5 overflow-hidden">
            {renderFlights.map((flight) => (
              <article
                key={flight.id}
                data-flight-schedule-row
                className={cn(
                  "dashboard-flight-schedule-row grid min-h-[48px] shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-0.5 rounded-[12px] border px-3 py-2",
                  flight.needsAction
                    ? "border-[color:var(--tone-warning-border)] bg-[color:var(--tone-warning-soft)]"
                    : flight.status === "departed"
                      ? "border-[color:var(--tone-success-border)] bg-[color:var(--tone-success-soft)]"
                      : "border-[color:var(--border-soft)] bg-[color:var(--panel-muted)]",
                )}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <p className="truncate font-mono text-[13px] font-bold text-[color:var(--text-strong)]">{flight.flightNumber}</p>
                  <FlightStatusBadge status={flight.status} label={flight.statusLabel} />
                </div>
                <div className="flex shrink-0 justify-end gap-2">
                  <Link href={flight.openHref} className="text-[11px] font-bold text-[color:var(--brand-primary)] hover:underline">
                    Buka
                  </Link>
                  {flight.needsAction ? (
                    <Link href={flight.manageHref} className="text-[11px] font-bold text-[color:var(--tone-warning)] hover:underline">
                      Atur
                    </Link>
                  ) : null}
                </div>
                <p className="col-span-2 truncate text-[11px] text-[color:var(--muted-fg)]">
                  {flight.route} · STD {formatDateTimeCompact(flight.departureTime)}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="py-2 text-center text-sm text-[color:var(--muted-fg)]">Belum ada penerbangan hari ini.</p>
        )}
      </div>
    </section>
  );
}