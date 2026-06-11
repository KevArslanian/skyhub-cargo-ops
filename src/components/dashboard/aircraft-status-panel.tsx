"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import { GlassSelect } from "@/components/glass-select";
import { OpsDrawer } from "@/components/ops-drawer";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import type { AircraftStatusRow, BaseShipment, DashboardFlightSummary } from "@/lib/dashboard-types";
import { isFlightNeedsRecovery } from "@/lib/dashboard-view-model";
import { FLIGHT_MASTER_RULES } from "@/lib/flight-rules";
import { cn, formatDateTimeCompact, formatWeight } from "@/lib/format";
import { networkErrorMessage, readApiError, type OpsAlertInput, type OpsToastInput } from "@/lib/ops-feedback";

const RECOVERY_CARD_LIMIT = 6;

const AIRCRAFT_TONE_BAR_CLASS: Record<AircraftStatusRow["tone"], string> = {
  info: "bg-sky-500",
  warning: "bg-amber-500",
  danger: "bg-rose-500",
  success: "bg-emerald-500",
  neutral: "bg-slate-300",
};

function findReplacementFlights(source: DashboardFlightSummary, flights: DashboardFlightSummary[]) {
  const now = Date.now();
  return flights
    .filter(
      (candidate) =>
        candidate.id !== source.id &&
        candidate.destination === source.destination &&
        candidate.status === "on_time" &&
        new Date(candidate.departureTime).getTime() > now,
    )
    .sort((left, right) => new Date(left.departureTime).getTime() - new Date(right.departureTime).getTime());
}

function AircraftStatusStackedBar({ rows }: { rows: AircraftStatusRow[] }) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const activeRows = rows.filter((row) => row.count > 0);

  return (
    <div
      className="flex h-2.5 w-full overflow-hidden rounded-full bg-[color:var(--panel-muted)]"
      role="img"
      aria-label={
        total > 0
          ? activeRows.map((row) => `${row.label}: ${row.count}`).join(", ")
          : "Belum ada data status pesawat"
      }
    >
      {total > 0 ? (
        activeRows.map((row) => (
          <div
            key={row.id}
            className={cn("min-w-[2px] transition-[flex-grow]", AIRCRAFT_TONE_BAR_CLASS[row.tone])}
            style={{ flexGrow: row.count, flexBasis: 0 }}
            title={`${row.label}: ${row.count}`}
          />
        ))
      ) : (
        <div className="h-full w-full bg-slate-200" />
      )}
    </div>
  );
}

export function AircraftStatusPanel({
  aircraftStatusRows,
  flights,
  shipments,
  onReassignComplete,
  showToast,
  showAlert,
}: {
  aircraftStatusRows: AircraftStatusRow[];
  flights: DashboardFlightSummary[];
  shipments: BaseShipment[];
  onReassignComplete: () => Promise<void>;
  showToast: (input: OpsToastInput) => void;
  showAlert: (input: OpsAlertInput) => void;
}) {
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignSaving, setReassignSaving] = useState(false);
  const [reassignSource, setReassignSource] = useState<DashboardFlightSummary | null>(null);
  const [reassignTargetId, setReassignTargetId] = useState("");
  const [selectedShipmentIds, setSelectedShipmentIds] = useState<string[]>([]);

  const problemFlights = useMemo(
    () =>
      [...flights]
        .filter(isFlightNeedsRecovery)
        .sort((left, right) => new Date(left.departureTime).getTime() - new Date(right.departureTime).getTime())
        .slice(0, RECOVERY_CARD_LIMIT),
    [flights],
  );

  const affectedByFlight = useMemo(() => {
    const map = new Map<string, BaseShipment[]>();
    for (const shipment of shipments) {
      if (!shipment.flightNumber) continue;
      const bucket = map.get(shipment.flightNumber) ?? [];
      bucket.push(shipment);
      map.set(shipment.flightNumber, bucket);
    }
    return map;
  }, [shipments]);

  const replacementOptions = useMemo(() => {
    if (!reassignSource) return [];
    return findReplacementFlights(reassignSource, flights);
  }, [flights, reassignSource]);

  const openReassignDrawer = useCallback(
    (flight: DashboardFlightSummary, preferredTargetId?: string) => {
      const affected = affectedByFlight.get(flight.flightNumber) ?? [];
      const replacements = findReplacementFlights(flight, flights);
      setReassignSource(flight);
      setSelectedShipmentIds(affected.map((item) => item.id));
      setReassignTargetId(preferredTargetId ?? replacements[0]?.id ?? "");
      setReassignOpen(true);
    },
    [affectedByFlight, flights],
  );

  const closeReassignDrawer = useCallback(() => {
    if (reassignSaving) return;
    setReassignOpen(false);
    setReassignSource(null);
    setReassignTargetId("");
    setSelectedShipmentIds([]);
  }, [reassignSaving]);

  const toggleShipmentSelection = useCallback((shipmentId: string) => {
    setSelectedShipmentIds((current) =>
      current.includes(shipmentId) ? current.filter((id) => id !== shipmentId) : [...current, shipmentId],
    );
  }, []);

  const handleBulkReassign = useCallback(async () => {
    if (!reassignSource || !reassignTargetId || selectedShipmentIds.length === 0) {
      showAlert({
        title: "Alihkan muatan belum lengkap",
        description: "Pilih slot pengganti dan minimal satu AWB yang akan dipindahkan.",
        tone: "warning",
      });
      return;
    }

    const targetFlight = flights.find((flight) => flight.id === reassignTargetId);
    setReassignSaving(true);
    let moved = 0;
    try {
      for (const shipmentId of selectedShipmentIds) {
        const response = await fetch(`/api/shipments/${shipmentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ flightId: reassignTargetId }),
        });
        if (response.ok) {
          moved += 1;
          continue;
        }
        const message = await readApiError(response, "Gagal mengalihkan muatan.");
        showAlert({ title: "Alihkan muatan gagal", description: message, tone: "error" });
        break;
      }

      if (moved > 0) {
        showToast({
          title: "Muatan dialihkan",
          description: `${moved} AWB dipindahkan dari ${reassignSource.flightNumber} ke ${targetFlight?.flightNumber ?? "slot baru"}.`,
          tone: "success",
        });
        closeReassignDrawer();
        await onReassignComplete();
      }
    } catch {
      showAlert({
        title: "Koneksi terputus",
        description: networkErrorMessage("mengalihkan muatan"),
        tone: "warning",
      });
    } finally {
      setReassignSaving(false);
    }
  }, [
    closeReassignDrawer,
    flights,
    onReassignComplete,
    reassignSource,
    reassignTargetId,
    selectedShipmentIds,
    showAlert,
    showToast,
  ]);

  const reassignCandidates = reassignSource ? affectedByFlight.get(reassignSource.flightNumber) ?? [] : [];

  return (
    <>
      <div className="dashboard-flight-recovery-panel min-h-0 min-w-0 flex-1 overflow-hidden">
        <div className="dashboard-flight-recovery-header shrink-0 space-y-1.5">
          <AircraftStatusStackedBar rows={aircraftStatusRows} />

          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {aircraftStatusRows.map((row) => (
              <div
                key={row.id}
                className="rounded-[10px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)]/70 px-2 py-1.5 text-center"
              >
                <p className="line-clamp-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--muted-fg)]">
                  {row.label}
                </p>
                <p className="font-[family:var(--font-heading)] text-[1rem] font-black leading-none text-[color:var(--text-strong)]">
                  {row.count}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="dashboard-flight-recovery-scroll min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-0.5">
          {problemFlights.length ? (
            problemFlights.map((flight) => {
              const affected = affectedByFlight.get(flight.flightNumber) ?? [];
              const replacements = findReplacementFlights(flight, flights);
              const totalWeight = affected.reduce((sum, item) => sum + item.weightKg, 0);
              return (
                <div
                  key={flight.id}
                  data-recovery-card
                  className="rounded-[12px] border border-[color:var(--tone-warning-border)] bg-[color:var(--tone-warning-surface)] px-3 py-2.5"
                >
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-[13px] font-bold text-[color:var(--text-strong)]">{flight.flightNumber}</p>
                      <p className="line-clamp-2 text-[11px] text-[color:var(--muted-fg)]">
                        {flight.route} · {flight.statusLabel} · berangkat {formatDateTimeCompact(flight.departureTime)}
                      </p>
                      <p className="mt-0.5 text-[10px] font-semibold text-[color:var(--tone-warning)]">
                        {affected.length ? `${affected.length} AWB · ${formatWeight(totalWeight)}` : "Belum ada muatan terpasang"}
                      </p>
                    </div>
                    <Link
                      href={DASHBOARD_ROUTES.flights.edit(flight.id)}
                      className="shrink-0 text-[11px] font-bold text-[color:var(--brand-primary)] hover:underline"
                    >
                      Atur jadwal
                    </Link>
                  </div>

                  <div className="mt-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--muted-fg)]">Slot pengganti</p>
                    {replacements.length ? (
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {replacements.slice(0, 3).map((replacement) => (
                          <button
                            key={replacement.id}
                            type="button"
                            className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border-soft)] bg-[color:var(--panel-bg)] px-2 py-1 text-[10px] font-bold text-[color:var(--text-strong)] transition-colors hover:border-[color:var(--brand-primary)]"
                            onClick={() => openReassignDrawer(flight, replacement.id)}
                          >
                            <ArrowRightLeft size={11} />
                            {replacement.flightNumber} {formatDateTimeCompact(replacement.departureTime)}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-1 text-[10px] font-semibold text-[color:var(--muted-fg)]">
                        Belum ada penerbangan tujuan {flight.destination} yang masih terbuka. Buat slot baru di Manajemen Pesawat.
                      </p>
                    )}
                  </div>

                  {affected.length > 0 ? (
                    <button
                      type="button"
                      className="mt-2 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-full border border-[color:var(--tone-warning-border)] bg-[color:var(--panel-bg)] px-3 text-[11px] font-bold text-[color:var(--text-strong)] transition-colors hover:bg-[color:var(--panel-muted)]"
                      onClick={() => openReassignDrawer(flight)}
                    >
                      <ArrowRightLeft size={13} />
                      Alihkan {affected.length} AWB ke pesawat lain
                    </button>
                  ) : null}
                </div>
              );
            })
          ) : (
            <div className="rounded-[12px] border border-[color:var(--tone-success-border)] bg-[color:var(--tone-success-soft)] px-3 py-2.5 text-[11px] font-semibold text-[color:var(--tone-success)]">
              Semua slot terjadwal. Tidak ada penerbangan yang perlu dialihkan.
            </div>
          )}
        </div>
      </div>

      <OpsDrawer
        open={reassignOpen && Boolean(reassignSource)}
        eyebrow="Pemulihan Jadwal"
        title={reassignSource ? `Alihkan muatan ${reassignSource.flightNumber}` : "Alihkan muatan"}
        description="Pilih penerbangan pengganti dengan tujuan yang sama, lalu pindahkan AWB terdampak dalam satu langkah."
        onClose={closeReassignDrawer}
        footer={
          <div className="flex w-full justify-end gap-3">
            <button type="button" className="btn btn-secondary" onClick={closeReassignDrawer} disabled={reassignSaving}>
              Batal
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void handleBulkReassign()} disabled={reassignSaving}>
              {reassignSaving ? "Mengalihkan..." : `Alihkan ${selectedShipmentIds.length} AWB`}
            </button>
          </div>
        }
      >
        {reassignSource ? (
          <div className="space-y-4">
            <div className="rounded-[16px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-4 py-3 text-sm">
              <p className="text-[color:var(--muted-fg)]">
                Dari <span className="font-bold text-[color:var(--text-strong)]">{reassignSource.flightNumber}</span> ({reassignSource.route})
              </p>
              <p className="mt-1 text-[color:var(--muted-fg)]">
                Status saat ini: <span className="font-semibold text-[color:var(--text-strong)]">{reassignSource.statusLabel}</span>
              </p>
              <p className="mt-1 text-[10px] text-[color:var(--muted-2)]">
                Cutoff muat kargo T-{FLIGHT_MASTER_RULES.cargoCutoffMinutesBeforeDeparture} sebelum STD.
              </p>
            </div>

            <div>
              <label className="label">Penerbangan pengganti</label>
              <GlassSelect
                aria-label="Penerbangan pengganti"
                value={reassignTargetId}
                onChange={setReassignTargetId}
                options={
                  replacementOptions.length
                    ? replacementOptions.map((flight) => ({
                        value: flight.id,
                        label: `${flight.flightNumber} · ${flight.route} · ${formatDateTimeCompact(flight.departureTime)}`,
                      }))
                    : [{ value: "", label: "Tidak ada slot tersedia" }]
                }
              />
              {!replacementOptions.length ? (
                <p className="form-help">
                  Buat penerbangan baru ke {reassignSource.destination} lewat{" "}
                  <Link href="/flight-board" className="font-semibold text-[color:var(--brand-primary)] hover:underline">
                    Manajemen Pesawat
                  </Link>
                  .
                </p>
              ) : null}
            </div>

            <div>
              <p className="label">AWB yang dialihkan</p>
              <div className="space-y-2">
                {reassignCandidates.map((shipment) => {
                  const checked = selectedShipmentIds.includes(shipment.id);
                  return (
                    <label
                      key={shipment.id}
                      className="flex cursor-pointer items-center justify-between gap-3 rounded-[14px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-3 py-2.5"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <input
                          type="checkbox"
                          className="h-4 w-4 shrink-0 accent-[color:var(--brand-primary)]"
                          checked={checked}
                          onChange={() => toggleShipmentSelection(shipment.id)}
                        />
                        <div className="min-w-0">
                          <p className="font-mono text-[12px] font-bold text-[color:var(--brand-primary)]">{shipment.awb}</p>
                          <p className="truncate text-[11px] text-[color:var(--muted-fg)]">{shipment.commodity}</p>
                        </div>
                      </div>
                      <span className="shrink-0 text-[11px] font-semibold text-[color:var(--muted-fg)]">{formatWeight(shipment.weightKg)}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}
      </OpsDrawer>
    </>
  );
}