"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  CalendarDays,
  Clock3,
  PlaneTakeoff,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  TowerControl,
  X,
} from "lucide-react";
import { formatDateTime, formatRelativeShort } from "@/lib/format";
import {
  AIRLINE_CODE_OPTIONS,
  buildFlightNumber,
  parseFlightNumberParts,
  type SupportedAirlineCode,
} from "@/lib/flight-meta";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState, FilterBar, OpsPanel, PageHeader, SectionHeader, StatCard } from "@/components/ops-ui";

type FlightBoardPayload = {
  permissions: {
    canManageFlights: boolean;
  };
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
    archivedAt: string | null;
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

type FlightRow = FlightBoardPayload["flights"][number];

const blankForm = {
  airlineCode: "GA" as SupportedAirlineCode,
  flightNumberSuffix: "",
  aircraftType: "",
  origin: "SOQ",
  destination: "CGK",
  departureTime: new Date().toISOString().slice(0, 16),
  arrivalTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().slice(0, 16),
  cargoCutoffTime: new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16),
  status: "on_time",
  gate: "",
  remarks: "",
};

type FlightFormState = typeof blankForm;

function normalizeFlightNumberSuffix(value: string) {
  return value.replace(/\D/g, "").slice(0, 4);
}

function isFlightNumberSuffixValid(value: string) {
  return /^\d{3,4}$/.test(value);
}

function createFlightDraft(flight: FlightRow | null) {
  if (!flight) {
    return { ...blankForm };
  }

  const parsed = parseFlightNumberParts(flight.flightNumber);
  const airlineCode = parsed?.airlineCode;
  const selectedCode = AIRLINE_CODE_OPTIONS.some((option) => option.code === airlineCode)
    ? (airlineCode as SupportedAirlineCode)
    : "GA";

  return {
    airlineCode: selectedCode,
    flightNumberSuffix: parsed?.numberPart ?? "",
    aircraftType: flight.aircraftType,
    origin: flight.origin,
    destination: flight.destination,
    departureTime: flight.departureTime.slice(0, 16),
    arrivalTime: flight.arrivalTime.slice(0, 16),
    cargoCutoffTime: flight.cargoCutoffTime.slice(0, 16),
    status: flight.status,
    gate: flight.gate || "",
    remarks: flight.remarks || "",
  };
}

function filterFlightsByDate(flights: FlightRow[], date: string) {
  return flights.filter((flight) => flight.departureTime.slice(0, 10) === date);
}

export default function FlightBoardPage() {
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<FlightBoardPayload | null>(null);
  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(() => ({ ...blankForm }));
  const [editDraft, setEditDraft] = useState(() => ({ ...blankForm }));
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<"info" | "warning">("info");

  const applyFlightBoardPayload = useCallback(
    (payload: FlightBoardPayload, nextDate = date, preferredFlightId = selectedFlightId) => {
      const visibleFlights = filterFlightsByDate(payload.flights, nextDate);
      const nextSelectedFlight =
        visibleFlights.find((flight) => flight.id === preferredFlightId) ?? visibleFlights[0] ?? null;

      setData(payload);
      setLastUpdated(new Date().toISOString());
      setSelectedFlightId(nextSelectedFlight?.id ?? null);
      setEditDraft(createFlightDraft(nextSelectedFlight));
    },
    [date, selectedFlightId],
  );

  const requestFlightBoard = useCallback(async () => {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (query.trim()) params.set("query", query.trim());
    const response = await fetch(`/api/flights?${params.toString()}`, { cache: "no-store" });
    if (!response.ok) return null;

    return (await response.json()) as FlightBoardPayload;
  }, [query, status]);

  const loadFlightBoard = useCallback(
    async (options?: { preferredDate?: string; preferredFlightId?: string | null }) => {
      const payload = await requestFlightBoard();
      if (!payload) return;

      applyFlightBoardPayload(
        payload,
        options?.preferredDate ?? date,
        options?.preferredFlightId ?? selectedFlightId,
      );
    },
    [applyFlightBoardPayload, date, requestFlightBoard, selectedFlightId],
  );

  useEffect(() => {
    let cancelled = false;

    void requestFlightBoard().then((payload) => {
      if (!payload || cancelled) {
        return;
      }

      applyFlightBoardPayload(payload);
    });

    return () => {
      cancelled = true;
    };
  }, [applyFlightBoardPayload, requestFlightBoard]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await loadFlightBoard();
    } finally {
      setRefreshing(false);
    }
  }

  const handleSelectFlight = useCallback(
    (flightId: string) => {
      const nextFlight = (data?.flights ?? []).find((flight) => flight.id === flightId) ?? null;
      setSelectedFlightId(flightId);
      setEditDraft(createFlightDraft(nextFlight));
    },
    [data?.flights],
  );

  const handleDateChange = useCallback(
    (nextDate: string) => {
      setDate(nextDate);
      const visibleFlights = filterFlightsByDate(data?.flights ?? [], nextDate);
      const nextSelectedFlight =
        visibleFlights.find((flight) => flight.id === selectedFlightId) ?? visibleFlights[0] ?? null;

      setSelectedFlightId(nextSelectedFlight?.id ?? null);
      setEditDraft(createFlightDraft(nextSelectedFlight));
    },
    [data?.flights, selectedFlightId],
  );

  function handleResetFilters() {
    const nextDate = new Date().toISOString().slice(0, 10);
    setStatus("all");
    setQuery("");
    handleDateChange(nextDate);
  }

  function toIso(value: string) {
    return new Date(value).toISOString();
  }

  async function resolveErrorMessage(response: Response, fallback: string) {
    try {
      const payload = (await response.json()) as { error?: string };
      return payload.error || fallback;
    } catch {
      return fallback;
    }
  }

  function composeFlightNumber(form: FlightFormState) {
    return buildFlightNumber(form.airlineCode, form.flightNumberSuffix);
  }

  async function handleCreateFlight(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isFlightNumberSuffixValid(createForm.flightNumberSuffix)) {
      setNoticeTone("warning");
      setNotice("Nomor flight harus terdiri dari 3-4 digit.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/flights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flightNumber: composeFlightNumber(createForm),
          aircraftType: createForm.aircraftType,
          origin: createForm.origin,
          destination: createForm.destination,
          departureTime: toIso(createForm.departureTime),
          arrivalTime: toIso(createForm.arrivalTime),
          cargoCutoffTime: toIso(createForm.cargoCutoffTime),
          status: createForm.status,
          gate: createForm.gate || null,
          remarks: createForm.remarks || null,
        }),
      });

      if (response.ok) {
        setCreateOpen(false);
        setCreateForm({ ...blankForm });
        setNoticeTone("info");
        setNotice("Flight berhasil dibuat.");
        await loadFlightBoard();
      } else {
        const errorMessage = await resolveErrorMessage(response, "Gagal membuat flight.");
        setNoticeTone("warning");
        setNotice(errorMessage);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveFlight() {
    if (!selectedFlight) return;

    if (!isFlightNumberSuffixValid(editDraft.flightNumberSuffix)) {
      setNoticeTone("warning");
      setNotice("Nomor flight harus terdiri dari 3-4 digit.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(`/api/flights/${selectedFlight.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flightNumber: composeFlightNumber(editDraft),
          aircraftType: editDraft.aircraftType,
          origin: editDraft.origin,
          destination: editDraft.destination,
          departureTime: toIso(editDraft.departureTime),
          arrivalTime: toIso(editDraft.arrivalTime),
          cargoCutoffTime: toIso(editDraft.cargoCutoffTime),
          status: editDraft.status,
          gate: editDraft.gate || null,
          remarks: editDraft.remarks || null,
        }),
      });

      if (response.ok) {
        setNoticeTone("info");
        setNotice("Perubahan flight berhasil disimpan.");
        await loadFlightBoard();
      } else {
        const errorMessage = await resolveErrorMessage(response, "Gagal memperbarui flight.");
        setNoticeTone("warning");
        setNotice(errorMessage);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleArchiveFlight() {
    if (!selectedFlight) return;

    const response = await fetch(`/api/flights/${selectedFlight.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true }),
    });

    if (response.ok) {
      setNoticeTone("info");
      setNotice(`Flight ${selectedFlight.flightNumber} berhasil diarsipkan.`);
      await loadFlightBoard();
    } else {
      const errorMessage = await resolveErrorMessage(response, "Gagal mengarsipkan flight.");
      setNoticeTone("warning");
      setNotice(errorMessage);
    }
  }

  const visibleFlights = useMemo(() => {
    if (!data) return [];
    return filterFlightsByDate(data.flights, date);
  }, [data, date]);

  const selectedFlight = visibleFlights.find((flight) => flight.id === selectedFlightId) ?? null;
  const nearCutoff = visibleFlights.filter((flight) => flight.status !== "departed").slice(0, 3);

  return (
    <div className="page-workspace">
      <PageHeader
        eyebrow="Pemantauan Keberangkatan"
        title="Papan Flight"
        subtitle="Pantau cutoff, keberangkatan, dan shipment terkait dalam layout split yang tetap stabil di desktop."
        actions={
          <>
            <button type="button" className="topbar-button" onClick={handleRefresh}>
              <RefreshCw size={16} className={refreshing ? "animate-spin" : undefined} />
              <span>{refreshing ? "Memuat ulang..." : "Muat ulang"}</span>
            </button>
            <button type="button" className="topbar-button" onClick={handleResetFilters}>
              <RotateCcw size={16} />
              <span>Reset</span>
            </button>
            {data?.permissions.canManageFlights ? (
              <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
                <Plus size={16} />
                Buat Flight
              </button>
            ) : null}
            <div className="topbar-button hidden xl:flex">
              <Clock3 size={16} />
              <span>{lastUpdated ? `Update ${formatRelativeShort(lastUpdated)}` : "Menunggu data"}</span>
            </div>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <StatCard label="Tepat Waktu" value={data?.summary.onTime ?? 0} note="Penerbangan yang masih sesuai jadwal." icon={PlaneTakeoff} tone="success" />
        <StatCard label="Terlambat" value={data?.summary.delayed ?? 0} note="Flight yang berpotensi mengganggu slot muat." icon={Clock3} tone="warning" />
        <StatCard label="Berangkat" value={data?.summary.departed ?? 0} note="Penerbangan yang sudah meninggalkan bandara." icon={TowerControl} tone="info" />
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
            <option value="on_time">Tepat Waktu</option>
            <option value="delayed">Terlambat</option>
            <option value="departed">Berangkat</option>
          </select>
        </div>
        <div>
          <label className="label">Tanggal</label>
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[color:var(--muted-fg)]" />
            <input type="date" className="input-field input-field-leading" value={date} onChange={(event) => handleDateChange(event.target.value)} />
          </div>
        </div>
      </FilterBar>

      {notice ? (
        <div
          className={
            noticeTone === "warning"
              ? "rounded-[18px] border border-[color:var(--tone-warning-border)] bg-[color:var(--tone-warning-soft)] px-4 py-3 text-sm font-medium text-[color:var(--tone-warning)]"
              : "rounded-[18px] border border-[color:var(--tone-info-border)] bg-[color:var(--tone-info-soft)] px-4 py-3 text-sm font-medium text-[color:var(--tone-info)]"
          }
        >
          {notice}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {nearCutoff.length ? (
          nearCutoff.map((flight) => (
            <button
              key={flight.id}
              type="button"
              className="ops-panel overflow-hidden text-left"
              onClick={() => handleSelectFlight(flight.id)}
            >
              <div className="relative h-44 overflow-hidden border-b border-[color:var(--border-soft)]">
                <Image
                  src={flight.imageUrl}
                  alt={flight.flightNumber}
                  fill
                  sizes="(max-width: 1023px) 100vw, 33vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,20,38,0.08),rgba(8,20,38,0.74))]" />
                <div className="absolute left-4 top-4 flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/90 p-1 shadow-sm">
                    <Image
                      src={flight.airlineLogoUrl}
                      alt={flight.airlineName}
                      width={36}
                      height={36}
                      sizes="36px"
                      className="object-contain"
                      style={{ height: "100%", width: "auto" }}
                    />
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
                    <p className="label">Berangkat</p>
                    <p className="font-semibold text-[color:var(--text-strong)]">{formatDateTime(flight.departureTime)}</p>
                  </div>
                </div>
              </div>
            </button>
          ))
        ) : (
          <div className="lg:col-span-3">
            <EmptyState icon={TowerControl} title="Tidak ada flight pada filter ini" copy="Ubah kata kunci, status, atau tanggal untuk melihat flight yang tersedia." />
          </div>
        )}
      </div>

      <div className="page-grid-2">
        <OpsPanel className="page-pane p-5">
          <SectionHeader title="Manifest Flight" subtitle="Daftar flight yang sudah difilter dan siap dipilih untuk detail lebih lanjut." />
          <div className="page-scroll mt-5 table-shell">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Flight</th>
                  <th>Rute</th>
                  <th>Cutoff</th>
                  <th>Berangkat</th>
                  <th>Status</th>
                  <th>Shipment</th>
                </tr>
              </thead>
              <tbody>
                {visibleFlights.length ? (
                  visibleFlights.map((flight) => (
                    <tr
                      key={flight.id}
                      onClick={() => handleSelectFlight(flight.id)}
                      className={selectedFlight?.id === flight.id ? "bg-[color:var(--brand-primary-soft)]" : "cursor-pointer"}
                    >
                      <td>
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[color:var(--border-soft)] bg-white/90 p-1">
                            <Image
                              src={flight.airlineLogoUrl}
                              alt={flight.airlineName}
                              width={32}
                              height={32}
                              sizes="32px"
                              className="object-contain"
                              style={{ height: "100%", width: "auto" }}
                            />
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
                      <EmptyState icon={PlaneTakeoff} title="Tidak ada data manifest" copy="Belum ada flight yang sesuai dengan tanggal dan filter yang dipilih." className="m-4" />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </OpsPanel>

        <OpsPanel className="page-pane p-5">
          {selectedFlight ? (
            <div className="page-scroll space-y-5">
              <div className="overflow-hidden rounded-[26px] border border-[color:var(--border-soft)]">
                <div className="relative h-56">
                  <Image
                    src={selectedFlight.imageUrl}
                    alt={selectedFlight.flightNumber}
                    fill
                    sizes="(max-width: 1535px) 100vw, 420px"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,20,38,0.1),rgba(8,20,38,0.78))]" />
                  <div className="absolute inset-x-0 bottom-0 px-5 pb-5">
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <div className="mb-3 flex items-center gap-3">
                          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/90 p-1 shadow-sm">
                            <Image
                              src={selectedFlight.airlineLogoUrl}
                              alt={selectedFlight.airlineName}
                              width={40}
                              height={40}
                              sizes="40px"
                              className="object-contain"
                              style={{ height: "100%", width: "auto" }}
                            />
                          </span>
                          <div>
                            <p className="text-base font-semibold text-white">{selectedFlight.airlineName}</p>
                            <p className="text-xs text-white/74">{selectedFlight.airlineFullName}</p>
                          </div>
                        </div>
                        <p className="ops-eyebrow !text-white/70">Flight Terpilih</p>
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
                  <p className="label">Berangkat</p>
                  <p className="font-semibold text-[color:var(--text-strong)]">{formatDateTime(selectedFlight.departureTime)}</p>
                </div>
                <div className="ops-panel-muted p-4">
                  <p className="label">Tiba</p>
                  <p className="font-semibold text-[color:var(--text-strong)]">{formatDateTime(selectedFlight.arrivalTime)}</p>
                </div>
                <div className="ops-panel-muted p-4">
                  <p className="label">Gate</p>
                  <p className="font-semibold text-[color:var(--text-strong)]">{selectedFlight.gate || "-"}</p>
                </div>
              </div>

              {data?.permissions.canManageFlights ? (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="label">Kode Maskapai</label>
                      <select
                        className="select-field"
                        value={editDraft.airlineCode}
                        onChange={(event) =>
                          setEditDraft((current) => ({
                            ...current,
                            airlineCode: event.target.value as SupportedAirlineCode,
                          }))
                        }
                      >
                        {AIRLINE_CODE_OPTIONS.map((item) => (
                          <option key={item.code} value={item.code}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">Nomor Flight (3-4 digit)</label>
                      <input
                        className="input-field"
                        value={editDraft.flightNumberSuffix}
                        onChange={(event) =>
                          setEditDraft((current) => ({
                            ...current,
                            flightNumberSuffix: normalizeFlightNumberSuffix(event.target.value),
                          }))
                        }
                        placeholder="714"
                      />
                    </div>
                    <div>
                      <label className="label">Jenis Pesawat</label>
                      <input className="input-field" value={editDraft.aircraftType} onChange={(event) => setEditDraft((current) => ({ ...current, aircraftType: event.target.value }))} />
                    </div>
                    <div>
                      <label className="label">Asal</label>
                      <input className="input-field" value={editDraft.origin} onChange={(event) => setEditDraft((current) => ({ ...current, origin: event.target.value.toUpperCase() }))} />
                    </div>
                    <div>
                      <label className="label">Tujuan</label>
                      <input className="input-field" value={editDraft.destination} onChange={(event) => setEditDraft((current) => ({ ...current, destination: event.target.value.toUpperCase() }))} />
                    </div>
                    <div>
                      <label className="label">Berangkat</label>
                      <input type="datetime-local" className="input-field" value={editDraft.departureTime} onChange={(event) => setEditDraft((current) => ({ ...current, departureTime: event.target.value }))} />
                    </div>
                    <div>
                      <label className="label">Tiba</label>
                      <input type="datetime-local" className="input-field" value={editDraft.arrivalTime} onChange={(event) => setEditDraft((current) => ({ ...current, arrivalTime: event.target.value }))} />
                    </div>
                    <div>
                      <label className="label">Cargo Cutoff</label>
                      <input type="datetime-local" className="input-field" value={editDraft.cargoCutoffTime} onChange={(event) => setEditDraft((current) => ({ ...current, cargoCutoffTime: event.target.value }))} />
                    </div>
                    <div>
                      <label className="label">Status</label>
                      <select className="select-field" value={editDraft.status} onChange={(event) => setEditDraft((current) => ({ ...current, status: event.target.value }))}>
                        <option value="on_time">Tepat Waktu</option>
                        <option value="delayed">Terlambat</option>
                        <option value="departed">Berangkat</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Gate</label>
                      <input className="input-field" value={editDraft.gate} onChange={(event) => setEditDraft((current) => ({ ...current, gate: event.target.value }))} />
                    </div>
                  </div>

                  <div>
                    <label className="label">Catatan</label>
                    <textarea className="textarea-field" value={editDraft.remarks} onChange={(event) => setEditDraft((current) => ({ ...current, remarks: event.target.value }))} />
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button type="button" className="btn btn-primary flex-1" onClick={handleSaveFlight} disabled={saving}>
                      <Save size={16} />
                      {saving ? "Menyimpan..." : "Simpan Flight"}
                    </button>
                    <button type="button" className="btn btn-warning" onClick={handleArchiveFlight}>
                      <Archive size={16} />
                      Arsipkan
                    </button>
                  </div>
                </>
              ) : null}

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
            <EmptyState icon={PlaneTakeoff} title="Pilih Flight" copy="Klik salah satu card atau baris flight untuk melihat detail dan manifest terkait." />
          )}
        </OpsPanel>
      </div>

      {createOpen ? (
        <div className="ops-modal-backdrop" onClick={() => setCreateOpen(false)}>
          <div className="ops-modal-panel" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b border-[color:var(--border-soft)] pb-5">
              <div>
                <p className="ops-eyebrow">Buat Flight</p>
                <h2 className="mt-2 font-[family:var(--font-heading)] text-[2rem] font-black tracking-[-0.05em] text-[color:var(--text-strong)]">
                  Tambah flight baru
                </h2>
              </div>
              <button type="button" className="topbar-button" onClick={() => setCreateOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <form className="mt-6 space-y-5" onSubmit={handleCreateFlight}>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label">Kode Maskapai</label>
                  <select
                    className="select-field"
                    value={createForm.airlineCode}
                    onChange={(event) =>
                      setCreateForm((current) => ({
                        ...current,
                        airlineCode: event.target.value as SupportedAirlineCode,
                      }))
                    }
                  >
                    {AIRLINE_CODE_OPTIONS.map((item) => (
                      <option key={item.code} value={item.code}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Nomor Flight (3-4 digit)</label>
                  <input
                    className="input-field"
                    value={createForm.flightNumberSuffix}
                    onChange={(event) =>
                      setCreateForm((current) => ({
                        ...current,
                        flightNumberSuffix: normalizeFlightNumberSuffix(event.target.value),
                      }))
                    }
                    placeholder="714"
                  />
                </div>
                <div>
                  <label className="label">Jenis Pesawat</label>
                  <input className="input-field" value={createForm.aircraftType} onChange={(event) => setCreateForm((current) => ({ ...current, aircraftType: event.target.value }))} />
                </div>
                <div>
                  <label className="label">Asal</label>
                  <input className="input-field" value={createForm.origin} onChange={(event) => setCreateForm((current) => ({ ...current, origin: event.target.value.toUpperCase() }))} />
                </div>
                <div>
                  <label className="label">Tujuan</label>
                  <input className="input-field" value={createForm.destination} onChange={(event) => setCreateForm((current) => ({ ...current, destination: event.target.value.toUpperCase() }))} />
                </div>
                <div>
                  <label className="label">Berangkat</label>
                  <input type="datetime-local" className="input-field" value={createForm.departureTime} onChange={(event) => setCreateForm((current) => ({ ...current, departureTime: event.target.value }))} />
                </div>
                <div>
                  <label className="label">Tiba</label>
                  <input type="datetime-local" className="input-field" value={createForm.arrivalTime} onChange={(event) => setCreateForm((current) => ({ ...current, arrivalTime: event.target.value }))} />
                </div>
                <div>
                  <label className="label">Cargo Cutoff</label>
                  <input type="datetime-local" className="input-field" value={createForm.cargoCutoffTime} onChange={(event) => setCreateForm((current) => ({ ...current, cargoCutoffTime: event.target.value }))} />
                </div>
                <div>
                  <label className="label">Status</label>
                  <select className="select-field" value={createForm.status} onChange={(event) => setCreateForm((current) => ({ ...current, status: event.target.value }))}>
                    <option value="on_time">Tepat Waktu</option>
                    <option value="delayed">Terlambat</option>
                    <option value="departed">Berangkat</option>
                  </select>
                </div>
                <div>
                  <label className="label">Gate</label>
                  <input className="input-field" value={createForm.gate} onChange={(event) => setCreateForm((current) => ({ ...current, gate: event.target.value }))} />
                </div>
              </div>
              <div>
                <label className="label">Catatan</label>
                <textarea className="textarea-field" value={createForm.remarks} onChange={(event) => setCreateForm((current) => ({ ...current, remarks: event.target.value }))} />
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" className="btn btn-secondary" onClick={() => setCreateOpen(false)}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Menyimpan..." : "Buat Flight"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
