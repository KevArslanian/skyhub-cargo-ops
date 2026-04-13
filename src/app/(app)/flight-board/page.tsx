"use client";

import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Clock3,
  PlaneTakeoff,
  Radar,
  RefreshCw,
  RotateCcw,
  TowerControl,
} from "lucide-react";
import { formatDateTime, formatRelativeShort } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState, FilterBar, OpsPanel, PageHeader, SectionHeader, StatCard } from "@/components/ops-ui";

type FlightBoardPayload = {
  summary: {
    onTime: number;
    delayed: number;
    departed: number;
  };
  flights: {
    id: string;
    flightNumber: string;
    aircraftType: string;
    route: string;
    origin: string;
    destination: string;
    departureTime: string;
    arrivalTime: string;
    cargoCutoffTime: string;
    status: string;
    statusLabel: string;
    gate: string | null;
    remarks: string | null;
    imageUrl: string;
    airlineCode: string;
    airlineName: string;
    airlineFullName: string;
    airlineLogoUrl: string;
    registration: string;
    category: string;
    brandColor: string;
    shipments: {
      id: string;
      awb: string;
      commodity: string;
      status: string;
      statusLabel: string;
      weightKg: number;
    }[];
  }[];
};

export default function FlightBoardPage() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState(searchParams.get("status") || "all");
  const [query, setQuery] = useState(searchParams.get("query") || "");
  const [date, setDate] = useState(searchParams.get("date") || new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<FlightBoardPayload | null>(null);
  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setStatus(searchParams.get("status") || "all");
      setQuery(searchParams.get("query") || "");
      setDate(searchParams.get("date") || new Date().toISOString().slice(0, 10));
    }, 0);

    return () => window.clearTimeout(timer);
  }, [searchParams]);

  const loadFlightBoard = useCallback(async () => {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (query.trim()) params.set("query", query.trim());
    const response = await fetch(`/api/flights?${params.toString()}`, { cache: "no-store" });
    if (!response.ok) return;
    const payload = (await response.json()) as FlightBoardPayload;
    setData(payload);
    setLastUpdated(new Date().toISOString());
    setSelectedFlightId((current) => current ?? payload.flights[0]?.id ?? null);
  }, [query, status]);

  useEffect(() => {
    let active = true;

    async function load() {
      const params = new URLSearchParams();
      if (status !== "all") params.set("status", status);
      if (query.trim()) params.set("query", query.trim());
      const response = await fetch(`/api/flights?${params.toString()}`, { cache: "no-store" });
      if (!response.ok || !active) return;
      const payload = (await response.json()) as FlightBoardPayload;
      setData(payload);
      setLastUpdated(new Date().toISOString());
      setSelectedFlightId((current) => current ?? payload.flights[0]?.id ?? null);
    }

    void load();
    return () => {
      active = false;
    };
  }, [query, status]);

  async function handleRefresh() {
    setRefreshing(true);
    await loadFlightBoard();
    setRefreshing(false);
  }

  function handleResetFilters() {
    setStatus("all");
    setQuery("");
    setDate(new Date().toISOString().slice(0, 10));
  }

  const visibleFlights = useMemo(() => {
    if (!data) return [];
    return data.flights.filter((flight) => flight.departureTime.slice(0, 10) === date);
  }, [data, date]);

  const selectedFlight = visibleFlights.find((flight) => flight.id === selectedFlightId) ?? visibleFlights[0] ?? null;
  const nearCutoff = visibleFlights.filter((flight) => flight.status !== "departed").slice(0, 3);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Departure Watch"
        title="Flight Board"
        subtitle="Pantau flight yang on-time, delayed, atau departed dengan cutoff terdekat, maskapai, gambar pesawat, dan shipment terkait dalam satu operator board."
        actions={
          <>
            <button type="button" className="topbar-button" onClick={handleRefresh}>
              <RefreshCw size={16} className={refreshing ? "animate-spin" : undefined} />
              <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
            </button>
            <button type="button" className="topbar-button" onClick={handleResetFilters}>
              <RotateCcw size={16} />
              <span>Reset Filter</span>
            </button>
            <div className="topbar-button hidden xl:flex">
              <Clock3 size={16} />
              <span>{lastUpdated ? `Update ${formatRelativeShort(lastUpdated)}` : "Menunggu data"}</span>
            </div>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <StatCard label="On-Time" value={data?.summary.onTime ?? 0} note="Penerbangan yang masih sesuai jadwal." icon={PlaneTakeoff} tone="success" />
        <StatCard label="Delayed" value={data?.summary.delayed ?? 0} note="Flight yang berpotensi mengganggu slot muat." icon={Clock3} tone="warning" />
        <StatCard label="Departed" value={data?.summary.departed ?? 0} note="Penerbangan yang sudah meninggalkan bandara." icon={Radar} tone="info" />
      </div>

      <FilterBar className="md:grid-cols-[1fr_180px_180px]">
        <div>
          <label className="label">Cari Flight</label>
          <input className="input-field" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="GA-714, SJ-182, atau CGK" />
        </div>
        <div>
          <label className="label">Status</label>
          <select className="select-field" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">Semua</option>
            <option value="on_time">On-Time</option>
            <option value="delayed">Delayed</option>
            <option value="departed">Departed</option>
          </select>
        </div>
        <div>
          <label className="label">Tanggal</label>
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[color:var(--muted-fg)]" />
            <input type="date" className="input-field input-field-leading" value={date} onChange={(event) => setDate(event.target.value)} />
          </div>
        </div>
      </FilterBar>

      <div className="grid gap-4 lg:grid-cols-3">
        {nearCutoff.length ? (
          nearCutoff.map((flight) => (
            <button
              key={flight.id}
              type="button"
              className="ops-panel overflow-hidden text-left"
              onClick={() => setSelectedFlightId(flight.id)}
            >
              <div className="relative h-44 overflow-hidden border-b border-[color:var(--border-soft)]">
                <Image src={flight.imageUrl} alt={flight.flightNumber} fill className="object-cover" />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,20,38,0.08),rgba(8,20,38,0.74))]" />
                <div className="absolute left-4 top-4 flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/90 p-1 shadow-sm">
                    <Image src={flight.airlineLogoUrl} alt={flight.airlineName} width={36} height={36} className="h-full w-full object-contain" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">{flight.airlineName}</p>
                    <p className="text-xs text-white/74">{flight.aircraftType}</p>
                  </div>
                </div>
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 px-4 pb-4">
                  <div>
                    <p className="font-[family:var(--font-heading)] text-2xl font-black tracking-[-0.05em] text-white">{flight.flightNumber}</p>
                    <p className="text-sm text-white/75">{flight.route}</p>
                  </div>
                  <StatusBadge value={flight.status} label={flight.statusLabel} className="border-white/20 bg-white/10 text-white" />
                </div>
              </div>
              <div className="grid gap-3 px-4 py-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="label">Cutoff</p>
                    <p className="font-semibold text-[color:var(--text-strong)]">{formatDateTime(flight.cargoCutoffTime)}</p>
                  </div>
                  <div>
                    <p className="label">Departure</p>
                    <p className="font-semibold text-[color:var(--text-strong)]">{formatDateTime(flight.departureTime)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="label">Registrasi</p>
                    <p className="font-semibold text-[color:var(--text-strong)]">{flight.registration}</p>
                  </div>
                  <div>
                    <p className="label">Shipment</p>
                    <p className="font-semibold text-[color:var(--text-strong)]">{flight.shipments.length} item</p>
                  </div>
                </div>
              </div>
            </button>
          ))
        ) : (
          <div className="lg:col-span-3">
            <EmptyState
              icon={TowerControl}
              title="Tidak ada flight pada filter ini"
              copy="Ubah kata kunci, status, atau tanggal untuk melihat flight board yang tersedia."
            />
          </div>
        )}
      </div>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.25fr)_420px]">
        <OpsPanel className="p-5">
          <SectionHeader title="Flight Manifest" subtitle="Daftar flight yang sudah difilter dan siap dipilih untuk detail lebih lanjut." />
          <div className="mt-5 table-shell">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Flight</th>
                  <th>Rute</th>
                  <th>Cutoff</th>
                  <th>Departure</th>
                  <th>Status</th>
                  <th>Shipment</th>
                </tr>
              </thead>
              <tbody>
                {visibleFlights.length ? (
                  visibleFlights.map((flight) => (
                    <tr
                      key={flight.id}
                      onClick={() => setSelectedFlightId(flight.id)}
                      className={selectedFlight?.id === flight.id ? "bg-[color:var(--brand-primary-soft)]" : "cursor-pointer"}
                    >
                      <td>
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[color:var(--border-soft)] bg-white/90 p-1">
                            <Image src={flight.airlineLogoUrl} alt={flight.airlineName} width={32} height={32} className="h-full w-full object-contain" />
                          </span>
                          <div>
                            <p className="font-[family:var(--font-heading)] text-lg font-extrabold tracking-[-0.03em] text-[color:var(--text-strong)]">{flight.flightNumber}</p>
                            <p className="text-xs text-[color:var(--muted-fg)]">{flight.aircraftType}</p>
                          </div>
                        </div>
                      </td>
                      <td>{flight.route}</td>
                      <td>{formatDateTime(flight.cargoCutoffTime)}</td>
                      <td>{formatDateTime(flight.departureTime)}</td>
                      <td><StatusBadge value={flight.status} label={flight.statusLabel} /></td>
                      <td>{flight.shipments.length}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState
                        icon={PlaneTakeoff}
                        title="Tidak ada data manifest"
                        copy="Belum ada flight yang sesuai dengan tanggal dan filter yang dipilih."
                        className="m-4"
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </OpsPanel>

        <OpsPanel className="p-5">
          {selectedFlight ? (
            <div className="space-y-5">
              <div className="overflow-hidden rounded-[26px] border border-[color:var(--border-soft)]">
                <div className="relative h-56">
                  <Image src={selectedFlight.imageUrl} alt={selectedFlight.flightNumber} fill className="object-cover" />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,20,38,0.1),rgba(8,20,38,0.78))]" />
                  <div className="absolute inset-x-0 bottom-0 px-5 pb-5">
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <div className="mb-3 flex items-center gap-3">
                          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/90 p-1 shadow-sm">
                            <Image src={selectedFlight.airlineLogoUrl} alt={selectedFlight.airlineName} width={40} height={40} className="h-full w-full object-contain" />
                          </span>
                          <div>
                            <p className="text-base font-semibold text-white">{selectedFlight.airlineName}</p>
                            <p className="text-xs text-white/74">{selectedFlight.airlineFullName}</p>
                          </div>
                        </div>
                        <p className="ops-eyebrow !text-white/70">Selected Flight</p>
                        <h2 className="mt-1 font-[family:var(--font-heading)] text-[2rem] font-black tracking-[-0.05em] text-white">{selectedFlight.flightNumber}</h2>
                        <p className="mt-2 text-sm text-white/74">{selectedFlight.route}</p>
                      </div>
                      <StatusBadge value={selectedFlight.status} label={selectedFlight.statusLabel} className="border-white/20 bg-white/10 text-white" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="ops-panel-muted p-4">
                  <p className="label">Cutoff</p>
                  <p className="font-semibold text-[color:var(--text-strong)]">{formatDateTime(selectedFlight.cargoCutoffTime)}</p>
                </div>
                <div className="ops-panel-muted p-4">
                  <p className="label">Departure</p>
                  <p className="font-semibold text-[color:var(--text-strong)]">{formatDateTime(selectedFlight.departureTime)}</p>
                </div>
                <div className="ops-panel-muted p-4">
                  <p className="label">Arrival</p>
                  <p className="font-semibold text-[color:var(--text-strong)]">{formatDateTime(selectedFlight.arrivalTime)}</p>
                </div>
                <div className="ops-panel-muted p-4">
                  <p className="label">Gate</p>
                  <p className="font-semibold text-[color:var(--text-strong)]">{selectedFlight.gate || "-"}</p>
                </div>
                <div className="ops-panel-muted p-4">
                  <p className="label">Registrasi</p>
                  <p className="font-semibold text-[color:var(--text-strong)]">{selectedFlight.registration}</p>
                </div>
                <div className="ops-panel-muted p-4">
                  <p className="label">Kategori</p>
                  <p className="font-semibold text-[color:var(--text-strong)]">{selectedFlight.category}</p>
                </div>
              </div>

              <div>
                <p className="label">Shipment Terkait</p>
                <div className="space-y-3">
                  {selectedFlight.shipments.length ? (
                    selectedFlight.shipments.map((shipment) => (
                      <div key={shipment.id} className="rounded-[22px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-4 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-mono text-sm font-semibold text-[color:var(--brand-primary)]">{shipment.awb}</p>
                            <p className="mt-1 font-semibold text-[color:var(--text-strong)]">{shipment.commodity}</p>
                            <p className="mt-1 text-xs text-[color:var(--muted-fg)]">{shipment.weightKg} kg</p>
                          </div>
                          <StatusBadge value={shipment.status} label={shipment.statusLabel} />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-[color:var(--muted-fg)]">Belum ada shipment yang terhubung ke flight ini.</p>
                  )}
                </div>
              </div>

              {selectedFlight.remarks ? (
                <div className="rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-4 py-4 text-sm leading-6 text-[color:var(--muted-fg)]">
                  {selectedFlight.remarks}
                </div>
              ) : null}
            </div>
          ) : (
            <EmptyState
              icon={PlaneTakeoff}
              title="Pilih flight"
              copy="Klik salah satu card atau baris flight untuk melihat detail maskapai, manifest, dan shipment terkait."
            />
          )}
        </OpsPanel>
      </div>
    </div>
  );
}
