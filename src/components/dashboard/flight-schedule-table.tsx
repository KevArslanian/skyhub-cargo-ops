"use client";

import Link from "next/link";
import { useRef } from "react";
import { TowerControl } from "lucide-react";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import { formatDateTimeCompact } from "@/lib/format";
import type { FlightScheduleItem } from "@/lib/dashboard-types";
import { FlightStatusBadge } from "@/components/dashboard/shared";
import { useVisibleListPageSize } from "@/lib/use-visible-list-page-size";

/** Jadwal pesawat format tabel — tanpa scroll horizontal */
export function FlightScheduleTable({ flights, metric }: { flights: FlightScheduleItem[]; metric: string }) {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const visibleCount = useVisibleListPageSize(
    bodyRef,
    flights.length > 0,
    flights.length,
    "[data-flight-schedule-table-row]",
    { fallback: 4, min: 3, max: 5, gapPx: 0, headSelector: "thead", footerPx: 0 },
  );
  const renderCount = Math.min(flights.length, Math.max(visibleCount, 3));
  const renderFlights = flights.slice(0, renderCount);
  const hiddenCount = Math.max(0, flights.length - renderCount);

  return (
    <section className="dashboard-flight-schedule-table flex min-h-0 flex-1 flex-col overflow-hidden rounded-[16px] border border-[color:var(--border-soft)] bg-[color:var(--panel-bg)] p-3 shadow-[0_1px_3px_rgba(15,23,42,0.05)] sm:p-4">
      <header className="mb-2 flex shrink-0 items-center justify-between gap-2">
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
          Lihat semua
        </Link>
      </header>

      <div ref={bodyRef} className="dashboard-flight-schedule-table-body min-h-0 flex-1 overflow-hidden">
        {flights.length ? (
          <table className="dashboard-flight-schedule-table-grid w-full table-fixed border-collapse">
            <thead>
              <tr>
                <th className="w-[18%]">Penerbangan</th>
                <th className="w-[22%]">Status</th>
                <th className="w-[24%]">Rute</th>
                <th className="w-[22%]">STD</th>
                <th className="w-[14%] text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {renderFlights.map((flight) => (
                <tr key={flight.id} data-flight-schedule-table-row className="dashboard-flight-schedule-table-row">
                  <td>
                    <span className="truncate font-mono text-[12px] font-bold text-[color:var(--text-strong)]">{flight.flightNumber}</span>
                  </td>
                  <td>
                    <FlightStatusBadge status={flight.status} label={flight.statusLabel} />
                  </td>
                  <td>
                    <span className="truncate text-[11px] text-[color:var(--muted-fg)]">{flight.route}</span>
                  </td>
                  <td>
                    <span className="truncate text-[11px] font-semibold text-[color:var(--muted-2)]">
                      {formatDateTimeCompact(flight.departureTime)}
                    </span>
                  </td>
                  <td className="text-right">
                    <div className="inline-flex items-center justify-end gap-2">
                      <Link href={flight.openHref} className="text-[11px] font-bold text-[color:var(--brand-primary)] hover:underline">
                        Buka
                      </Link>
                      {flight.needsAction ? (
                        <Link href={flight.manageHref} className="text-[11px] font-bold text-[color:var(--tone-warning)] hover:underline">
                          Atur
                        </Link>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="py-4 text-center text-sm text-[color:var(--muted-fg)]">Belum ada penerbangan hari ini.</p>
        )}
      </div>
    </section>
  );
}