"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  Pencil,
  PlaneTakeoff,
  Plus,
  Save,
  Search,
  TowerControl,
  X,
} from "lucide-react";
import { cn, formatDateTime } from "@/lib/format";
import { AIRCRAFT_TYPE_OPTIONS, STATION_OPTIONS } from "@/lib/constants";
import {
  getCargoCutoffTime,
  getDefaultAircraftType,
  getEstimatedArrivalTime,
  getGateForDestination,
} from "@/lib/flight-rules";
import {
  AIRLINE_CODE_OPTIONS,
  buildFlightNumber,
  getFlightVisualMeta,
  parseFlightNumberParts,
  type SupportedAirlineCode,
} from "@/lib/flight-meta";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState, FilterBar, OpsPanel, PageHeader, SectionHeader, StatCard } from "@/components/ops-ui";
import { OpsDrawer } from "@/components/ops-drawer";

type FlightBoardPayload = {
  permissions: {
    canManageFlights: boolean;
    canExport: boolean;
  };
  summary: {
    onTime: number;
    delayed: number;
    departed: number;
  };
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
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

type FlightMutationRow = {
  id: string;
  flightNumber: string;
  aircraftType: string;
  origin: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  cargoCutoffTime: string;
  status: string;
  gate: string | null;
  remarks: string | null;
  archivedAt?: string | null;
};

const FLIGHT_STATUS_LABELS: Record<string, string> = {
  on_time: "Terjadwal",
  delayed: "Terlambat",
  departed: "Berangkat",
};

function createBlankFlightForm() {
  const departureTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const origin = "SOQ";
  const destination = "CGK";

  return {
    airlineCode: "GA" as SupportedAirlineCode,
    flightNumberSuffix: "",
    aircraftType: getDefaultAircraftType("GA"),
    origin,
    destination,
    departureTime: toDateTimeInputValue(departureTime),
    arrivalTime: toDateTimeInputValue(getEstimatedArrivalTime(departureTime, origin, destination)),
    cargoCutoffTime: toDateTimeInputValue(getCargoCutoffTime(departureTime)),
    status: "on_time",
    gate: getGateForDestination(destination),
    remarks: "",
  };
}

type FlightFormState = ReturnType<typeof createBlankFlightForm>;

function normalizeFlightNumberSuffix(value: string) {
  return value.replace(/\D/g, "").slice(0, 4);
}

function isFlightNumberSuffixValid(value: string) {
  return /^\d{3,4}$/.test(value);
}

function toDateInputValue(value: string | Date = new Date()) {
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function toDateTimeInputValue(value: string | Date = new Date()) {
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function applyFlightMasterRules(form: FlightFormState, next: Partial<FlightFormState>) {
  const draft = { ...form, ...next };
  const departureTime = new Date(draft.departureTime);

  if (Number.isNaN(departureTime.getTime())) {
    return {
      ...draft,
      gate: getGateForDestination(draft.destination),
    };
  }

  return {
    ...draft,
    cargoCutoffTime: toDateTimeInputValue(getCargoCutoffTime(departureTime)),
    arrivalTime: toDateTimeInputValue(getEstimatedArrivalTime(departureTime, draft.origin, draft.destination)),
    gate: getGateForDestination(draft.destination),
  };
}

function getFlightScheduleIssues(form: FlightFormState, mode: "create" | "edit") {
  const now = new Date();
  const departureTime = new Date(form.departureTime);
  const arrivalTime = new Date(form.arrivalTime);
  const cargoCutoffTime = new Date(form.cargoCutoffTime);
  const issues: { tone: "error" | "warning"; message: string }[] = [];

  if ([departureTime, arrivalTime, cargoCutoffTime].some((date) => Number.isNaN(date.getTime()))) {
    return [{ tone: "error" as const, message: "Jadwal belum valid." }];
  }

  if (arrivalTime <= departureTime) {
    issues.push({ tone: "error", message: "Estimasi tiba harus setelah waktu berangkat." });
  }

  if (cargoCutoffTime >= departureTime) {
    issues.push({ tone: "error", message: "Cutoff harus sebelum waktu berangkat." });
  }

  if (mode === "create" && departureTime <= now) {
    issues.push({ tone: "error", message: "Flight baru tidak boleh berangkat di masa lalu." });
  }

  if (mode === "create" && cargoCutoffTime <= now) {
    issues.push({ tone: "error", message: "Cutoff sudah lewat. Pilih berangkat minimal 70 menit dari sekarang." });
  } else if (cargoCutoffTime.getTime() - now.getTime() < 30 * 60 * 1000) {
    issues.push({ tone: "warning", message: "Cutoff kurang dari 30 menit. Pastikan manifest sudah siap." });
  }

  return issues;
}

function createFlightDraft(flight: FlightRow | null) {
  if (!flight) {
    return createBlankFlightForm();
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
  if (!date) {
    return flights;
  }

  return flights.filter((flight) => toDateInputValue(flight.departureTime) === date);
}

function createFlightRowFromMutation(flight: FlightMutationRow): FlightRow {
  const meta = getFlightVisualMeta(flight.flightNumber, flight.aircraftType);

  return {
    id: flight.id,
    flightNumber: flight.flightNumber,
    aircraftType: meta.aircraftType,
    route: `${flight.origin} -> ${flight.destination}`,
    origin: flight.origin,
    destination: flight.destination,
    departureTime: flight.departureTime,
    arrivalTime: flight.arrivalTime,
    cargoCutoffTime: flight.cargoCutoffTime,
    status: flight.status,
    statusLabel: FLIGHT_STATUS_LABELS[flight.status] ?? flight.status,
    gate: flight.gate,
    remarks: flight.remarks,
    imageUrl: meta.aircraftImageUrl,
    airlineCode: meta.airlineCode,
    airlineName: meta.airlineName,
    airlineFullName: meta.airlineFullName,
    airlineLogoUrl: meta.airlineLogoUrl,
    registration: meta.registration,
    category: meta.category,
    brandColor: meta.brandColor,
    archivedAt: flight.archivedAt ?? null,
    shipments: [],
  };
}

function parsePageParam(value: string | null) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export default function FlightBoardPage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState(() => searchParams.get("status") || "all");
  const [query, setQuery] = useState(() => searchParams.get("query") || "");
  const [appliedQuery, setAppliedQuery] = useState(() => searchParams.get("query") || "");
  const [date, setDate] = useState(() => searchParams.get("date") || "");
  const [page, setPage] = useState(() => parsePageParam(searchParams.get("page")));
  const [data, setData] = useState<FlightBoardPayload | null>(null);
  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [createForm, setCreateForm] = useState(() => createBlankFlightForm());
  const [editDraft, setEditDraft] = useState(() => createBlankFlightForm());
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<"info" | "warning">("info");
  const initialDateResolvedRef = useRef(false);
  const latestUrlParamsRef = useRef(searchParams.toString());

  const replaceFlightBoardUrl = useCallback(
    (next: { status?: string; query?: string; date?: string; page?: number }) => {
      const params = new URLSearchParams(searchParams);
      const nextStatus = next.status ?? status;
      const nextQuery = next.query ?? query;
      const nextDate = next.date ?? date;
      const nextPage = next.page ?? page;

      if (nextStatus && nextStatus !== "all") params.set("status", nextStatus);
      else params.delete("status");

      if (nextQuery.trim()) params.set("query", nextQuery.trim());
      else params.delete("query");

      if (nextDate) params.set("date", nextDate);
      else params.delete("date");

      if (nextPage > 1) params.set("page", String(nextPage));
      else params.delete("page");

      const nextQueryString = params.toString();
      if (nextQueryString !== latestUrlParamsRef.current) {
        latestUrlParamsRef.current = nextQueryString;
        router.replace(nextQueryString ? `${pathname}?${nextQueryString}` : pathname, { scroll: false });
      }
    },
    [date, page, pathname, query, router, searchParams, status],
  );

  useEffect(() => {
    function handleContextSearch(event: Event) {
      const detail = (event as CustomEvent<{ pathname?: string; query?: string }>).detail;
      if (detail?.pathname !== "/flight-board" || !detail.query) return;
      setQuery(detail.query);
      setAppliedQuery(detail.query);
      setPage(1);
      replaceFlightBoardUrl({ query: detail.query, page: 1 });
    }

    window.addEventListener("skyhub:context-search", handleContextSearch as EventListener);
    return () => window.removeEventListener("skyhub:context-search", handleContextSearch as EventListener);
  }, [replaceFlightBoardUrl]);

  useEffect(() => {
    if (query === appliedQuery) {
      return;
    }

    const timer = window.setTimeout(() => {
      setAppliedQuery(query);
      setPage(1);
      replaceFlightBoardUrl({ query, page: 1 });
    }, 300);

    return () => window.clearTimeout(timer);
  }, [appliedQuery, query, replaceFlightBoardUrl]);

  const applyFlightBoardPayload = useCallback(
    (payload: FlightBoardPayload, nextDate = date, preferredFlightId = selectedFlightId) => {
      const visibleFlights = filterFlightsByDate(payload.flights, nextDate);
      const nextSelectedFlight = preferredFlightId
        ? visibleFlights.find((flight) => flight.id === preferredFlightId) ?? null
        : null;

      setData(payload);
      setPage(payload.pagination.page);
      setSelectedFlightId(nextSelectedFlight?.id ?? null);
      setEditDraft(createFlightDraft(nextSelectedFlight));
    },
    [date, selectedFlightId],
  );

  const requestFlightBoard = useCallback(async (options?: { includeDate?: boolean; page?: number }) => {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (appliedQuery.trim()) params.set("query", appliedQuery.trim());
    if ((options?.includeDate ?? initialDateResolvedRef.current) && date) params.set("date", date);
    params.set("page", String(options?.page ?? page));
    params.set("pageSize", "10");
    const response = await fetch(`/api/flights?${params.toString()}`, { cache: "no-store" });
    if (!response.ok) return null;

    return (await response.json()) as FlightBoardPayload;
  }, [appliedQuery, date, page, status]);

  const loadFlightBoard = useCallback(
    async (options?: { preferredDate?: string; preferredFlightId?: string | null }) => {
      const payload = await requestFlightBoard({ includeDate: true });
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

    void requestFlightBoard({ includeDate: initialDateResolvedRef.current }).then((payload) => {
      if (!payload || cancelled) {
        return;
      }

      initialDateResolvedRef.current = true;
      replaceFlightBoardUrl({ date, page: payload.pagination.page });
      applyFlightBoardPayload(payload, date);
    });

    return () => {
      cancelled = true;
    };
  }, [applyFlightBoardPayload, date, replaceFlightBoardUrl, requestFlightBoard]);

  useEffect(() => {
    const nextParams = searchParams.toString();
    if (nextParams === latestUrlParamsRef.current) {
      return;
    }

    latestUrlParamsRef.current = nextParams;
    setStatus(searchParams.get("status") || "all");
    setQuery(searchParams.get("query") || "");
    setAppliedQuery(searchParams.get("query") || "");
    setDate(searchParams.get("date") || "");
    setPage(parsePageParam(searchParams.get("page")));
  }, [searchParams]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible" || createOpen || editOpen || saving) return;
      void loadFlightBoard();
    }, 10000);

    return () => window.clearInterval(timer);
  }, [createOpen, editOpen, loadFlightBoard, saving]);

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
      setPage(1);
      replaceFlightBoardUrl({ date: nextDate, page: 1 });
      const visibleFlights = data?.flights ?? [];
      const nextSelectedFlight = selectedFlightId
        ? visibleFlights.find((flight) => flight.id === selectedFlightId) ?? null
        : null;

      setSelectedFlightId(nextSelectedFlight?.id ?? null);
      setEditDraft(createFlightDraft(nextSelectedFlight));
    },
    [data?.flights, replaceFlightBoardUrl, selectedFlightId],
  );

  const handleStatusChange = useCallback(
    (nextStatus: string) => {
      setStatus(nextStatus);
      setPage(1);
      replaceFlightBoardUrl({ status: nextStatus, page: 1 });
    },
    [replaceFlightBoardUrl],
  );


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

    const createBlockingIssue = createScheduleIssues.find((issue) => issue.tone === "error");
    if (createBlockingIssue) {
      setNoticeTone("warning");
      setNotice(createBlockingIssue.message);
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
          remarks: createForm.remarks || null,
        }),
      });

      if (response.ok) {
        const payload = (await response.json()) as { flight: FlightMutationRow };
        const nextFlight = createFlightRowFromMutation(payload.flight);
        const nextDate = toDateInputValue(payload.flight.departureTime);
        const nextQuery = payload.flight.flightNumber;
        setCreateOpen(false);
        setCreateForm(createBlankFlightForm());
        setDate(nextDate);
        setQuery(nextQuery);
        setAppliedQuery(nextQuery);
        setPage(1);
        replaceFlightBoardUrl({ date: nextDate, query: nextQuery, page: 1 });
        setData((current) =>
          current
            ? {
                ...current,
                pagination: { ...current.pagination, page: 1, totalItems: Math.max(1, current.pagination.totalItems + 1) },
                flights: [nextFlight, ...current.flights.filter((flight) => flight.id !== nextFlight.id)],
              }
            : current,
        );
        setSelectedFlightId(nextFlight.id);
        setEditDraft(createFlightDraft(nextFlight));
        setNoticeTone("info");
        setNotice("Flight berhasil dibuat.");
        void loadFlightBoardWithParams({
          date: nextDate,
          query: nextQuery,
          preferredFlightId: payload.flight.id,
        });
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

    const editBlockingIssue = editScheduleIssues.find((issue) => issue.tone === "error");
    if (editBlockingIssue) {
      setNoticeTone("warning");
      setNotice(editBlockingIssue.message);
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
          remarks: editDraft.remarks || null,
        }),
      });

      if (response.ok) {
        const payload = (await response.json()) as { flight: FlightMutationRow };
        const nextFlight = createFlightRowFromMutation(payload.flight);
        const nextDate = toDateInputValue(payload.flight.departureTime);
        setDate(nextDate);
        setPage(1);
        replaceFlightBoardUrl({ date: nextDate, page: 1 });
        setData((current) =>
          current
            ? {
                ...current,
                pagination: { ...current.pagination, page: 1 },
                flights: current.flights.map((flight) => (flight.id === nextFlight.id ? nextFlight : flight)),
              }
            : current,
        );
        setSelectedFlightId(nextFlight.id);
        setEditDraft(createFlightDraft(nextFlight));
        setEditOpen(false);
        setNoticeTone("info");
        setNotice("Perubahan flight berhasil disimpan.");
        void loadFlightBoardWithParams({
          date: nextDate,
          query: appliedQuery,
          preferredFlightId: payload.flight.id,
        });
      } else {
        const errorMessage = await resolveErrorMessage(response, "Gagal memperbarui flight.");
        setNoticeTone("warning");
        setNotice(errorMessage);
      }
    } finally {
      setSaving(false);
    }
  }

  async function loadFlightBoardWithParams(input: { date: string; query?: string; preferredFlightId?: string | null }) {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (input.query?.trim()) params.set("query", input.query.trim());
    if (input.date) params.set("date", input.date);
    params.set("page", "1");
    params.set("pageSize", "10");

    const response = await fetch(`/api/flights?${params.toString()}`, { cache: "no-store" });
    if (!response.ok) return;

    const payload = (await response.json()) as FlightBoardPayload;
    applyFlightBoardPayload(payload, input.date, input.preferredFlightId ?? null);
  }

  async function handleDeleteFlight() {
    if (!selectedFlight) return;

    const response = await fetch(`/api/flights/${selectedFlight.id}`, {
      method: "DELETE",
    });

    if (response.ok) {
      setData((current) =>
        current
          ? {
              ...current,
              pagination: {
                ...current.pagination,
                totalItems: Math.max(0, current.pagination.totalItems - 1),
              },
              flights: current.flights.filter((flight) => flight.id !== selectedFlight.id),
            }
          : current,
      );
      setSelectedFlightId(null);
      setEditDraft(createFlightDraft(null));
      setNoticeTone("info");
      setNotice(`Flight ${selectedFlight.flightNumber} berhasil dihapus dari database.`);
      void loadFlightBoard();
    } else {
      const errorMessage = await resolveErrorMessage(response, "Gagal menghapus flight.");
      setNoticeTone("warning");
      setNotice(errorMessage);
    }
  }

  const visibleFlights = useMemo(() => {
    if (!data) return [];
    return filterFlightsByDate(data.flights, date);
  }, [data, date]);

  const selectedFlight = visibleFlights.find((flight) => flight.id === selectedFlightId) ?? null;
  const activeFlights = visibleFlights.filter((flight) => flight.status !== "departed");
  const highlightedFlights = (activeFlights.length ? activeFlights : visibleFlights).slice(0, 3);
  const totalFlightPages = data?.pagination.totalPages ?? 1;
  const totalFlightItems = data?.pagination.totalItems ?? 0;
  const visibleFlightStart = totalFlightItems ? (page - 1) * 10 + 1 : 0;
  const visibleFlightEnd = Math.min((page - 1) * 10 + visibleFlights.length, totalFlightItems);
  const canGoPrevious = page > 1;
  const canGoNext = page < totalFlightPages;
  const flightExportQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (appliedQuery.trim()) params.set("query", appliedQuery.trim());
    if (date) params.set("date", date);
    return params.toString();
  }, [appliedQuery, date, status]);
  const createScheduleIssues = getFlightScheduleIssues(createForm, "create");
  const editScheduleIssues = getFlightScheduleIssues(editDraft, "edit");

  const handleManifestPageChange = useCallback(
    async (nextPage: number) => {
      const clampedPage = Math.min(Math.max(nextPage, 1), totalFlightPages);
      setPage(clampedPage);
      setSelectedFlightId(null);
      setEditDraft(createFlightDraft(null));
      replaceFlightBoardUrl({ page: clampedPage });

      const payload = await requestFlightBoard({ includeDate: true, page: clampedPage });
      if (!payload) return;
      applyFlightBoardPayload(payload, date, null);
    },
    [applyFlightBoardPayload, date, replaceFlightBoardUrl, requestFlightBoard, totalFlightPages],
  );

  return (
    <div className="page-workspace flightboard-viewport">
      <div className="flightboard-header-sticky">
        <PageHeader
          eyebrow="Pemantauan Keberangkatan"
          title="Papan Flight"
          subtitle="Tambah, cari, ubah, dan hapus flight."
          actions={
            <>
              {data?.permissions.canExport ? (
                <Link href={`/exports/flights?${flightExportQuery}`} className="btn btn-secondary">
                  <FileText size={16} />
                  Print Flight
                </Link>
              ) : null}
              {data?.permissions.canManageFlights ? (
                <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
                  <Plus size={16} />
                  Buat Flight
                </button>
              ) : null}
            </>
          }
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <StatCard label="Terjadwal" value={data?.summary.onTime ?? 0} note="Belum melewati waktu berangkat." icon={PlaneTakeoff} tone="success" />
        <StatCard label="Terlambat" value={data?.summary.delayed ?? 0} note="Ditandai butuh penyesuaian jadwal." icon={Clock3} tone="warning" />
        <StatCard label="Berangkat" value={data?.summary.departed ?? 0} note="Waktu berangkat sudah berjalan." icon={TowerControl} tone="info" />
      </div>

      <FilterBar className="flightboard-filter-bar">
        <div style={{ flex: 1, minWidth: 280 }}>
          <label className="label" htmlFor="flightboard-search">Cari</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--muted-2)]" size={15} />
            <input
              id="flightboard-search"
              className="input-field ledger-search-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari flight, rute, atau nomor flight..."
            />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="flightboard-status">Status</label>
          <select id="flightboard-status" className="select-field" value={status} onChange={(event) => handleStatusChange(event.target.value)}>
            <option value="all">Semua</option>
            <option value="on_time">Terjadwal</option>
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
        {highlightedFlights.length ? (
          highlightedFlights.map((flight) => (
            <button
              key={flight.id}
              type="button"
              className="ops-panel overflow-hidden text-left"
              onClick={() => handleSelectFlight(flight.id)}
            >
              <div className="border-b border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--muted-2)]">
                      {flight.airlineName} | {flight.aircraftType}
                    </p>
                    <p className="mt-2 font-[family:var(--font-heading)] text-2xl font-black tracking-[-0.05em] text-[color:var(--text-strong)]">{flight.flightNumber}</p>
                    <p className="mt-1 text-sm text-[color:var(--muted-fg)]">{flight.route}</p>
                  </div>
                  <StatusBadge value={flight.status} label={flight.statusLabel} />
                </div>
              </div>
              <div className="grid gap-3 px-4 py-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="label">Batas Terima Cargo</p>
                    <p className="font-semibold text-[color:var(--text-strong)]">{formatDateTime(flight.cargoCutoffTime)}</p>
                  </div>
                  <div>
                    <p className="label">Waktu Berangkat</p>
                    <p className="font-semibold text-[color:var(--text-strong)]">{formatDateTime(flight.departureTime)}</p>
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
              copy="Ubah kata kunci, status, atau tanggal untuk melihat flight yang tersedia."
              className="flightboard-empty-state"
            />
          </div>
        )}
      </div>

      <div className={cn("flightboard-main flightboard-editor-layout", selectedFlight ? "flightboard-editor-layout-active" : null)}>
        <OpsPanel
          className={cn(
            "page-pane flightboard-pane flightboard-manifest-panel flight-manifest-panel-space",
            selectedFlight ? "flightboard-editor-list-pane" : null,
          )}
        >
          <SectionHeader title="Manifest Flight" subtitle="Daftar flight yang sudah difilter dan siap dipilih untuk detail lebih lanjut." />
          <div className="flightboard-manifest-scroll flight-manifest-table-space internal-scrollbar table-shell">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Flight</th>
                  <th>Rute</th>
                  <th>Batas Cargo</th>
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
                      className={selectedFlight?.id === flight.id ? "flight-manifest-row-active cursor-pointer" : "flight-manifest-row cursor-pointer"}
                    >
                      <td>
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] text-xs font-black text-[color:var(--brand-primary)]">
                            {flight.airlineCode}
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
          <div className="flightboard-pagination-footer table-pagination-footer">
            <button
              type="button"
              className="topbar-button"
              onClick={() => void handleManifestPageChange(page - 1)}
              disabled={!canGoPrevious}
            >
              <ChevronLeft size={16} />
              Sebelumnya
            </button>
            <p>
              {visibleFlightStart}-{visibleFlightEnd} dari {totalFlightItems} • Halaman {page}/{totalFlightPages}
            </p>
            <button
              type="button"
              className="topbar-button"
              onClick={() => void handleManifestPageChange(page + 1)}
              disabled={!canGoNext}
            >
              Berikutnya
              <ChevronRight size={16} />
            </button>
          </div>
        </OpsPanel>

        {selectedFlight ? (
          <OpsPanel className="page-pane flightboard-pane flightboard-editor-detail-pane p-5">
            <div className="flightboard-editor-detail-scroll space-y-5">
              <div className="rounded-[26px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-4 flex items-center gap-3">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--panel-bg)] text-sm font-black text-[color:var(--brand-primary)]">
                        {selectedFlight.airlineCode}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-[color:var(--text-strong)]">{selectedFlight.airlineName}</p>
                        <p className="truncate text-xs text-[color:var(--muted-fg)]">{selectedFlight.airlineFullName}</p>
                      </div>
                    </div>
                    <p className="ops-eyebrow">Flight Terpilih</p>
                    <h2 className="mt-1 font-[family:var(--font-heading)] text-[2rem] font-black tracking-[-0.05em] text-[color:var(--text-strong)]">{selectedFlight.flightNumber}</h2>
                    <p className="mt-2 text-sm text-[color:var(--muted-fg)]">{selectedFlight.route}</p>
                  </div>
                  <StatusBadge value={selectedFlight.status} label={selectedFlight.statusLabel} className="shrink-0" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="ops-panel-muted p-4">
                  <p className="label">Batas Terima Cargo</p>
                  <p className="font-semibold text-[color:var(--text-strong)]">{formatDateTime(selectedFlight.cargoCutoffTime)}</p>
                </div>
                <div className="ops-panel-muted p-4">
                  <p className="label">Waktu Berangkat</p>
                  <p className="font-semibold text-[color:var(--text-strong)]">{formatDateTime(selectedFlight.departureTime)}</p>
                </div>
                <div className="ops-panel-muted p-4">
                  <p className="label">Estimasi Tiba</p>
                  <p className="font-semibold text-[color:var(--text-strong)]">{formatDateTime(selectedFlight.arrivalTime)}</p>
                </div>
                <div className="ops-panel-muted p-4">
                  <p className="label">Gate</p>
                  <p className="font-semibold text-[color:var(--text-strong)]">{selectedFlight.gate || "-"}</p>
                </div>
              </div>

              {data?.permissions.canManageFlights ? (
                <div className="flex flex-wrap gap-3 rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-4">
                  <button
                    type="button"
                    className="btn btn-primary flex-1"
                    onClick={() => {
                      setEditDraft(createFlightDraft(selectedFlight));
                      setEditOpen(true);
                    }}
                  >
                    <Pencil size={16} />
                    Edit Flight
                  </button>
                  <button type="button" className="btn btn-warning" onClick={handleDeleteFlight}>
                    <X size={16} />
                    Hapus
                  </button>
                </div>
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
          </OpsPanel>
        ) : null}
      </div>

      <OpsDrawer
        open={createOpen}
        eyebrow="Buat Flight"
        title="Tambah flight baru"
        description="Jadwal, aircraft, gate, cutoff, dan estimasi tiba disusun sebagai panel kerja kanan agar konteks flight board tetap terlihat."
        onClose={() => setCreateOpen(false)}
      >
            <form className="space-y-5" onSubmit={handleCreateFlight}>
              <div className="flight-time-note">
                <p className="font-semibold text-[color:var(--text-strong)]">Aturan master otomatis</p>
                <p className="mt-1 text-sm text-[color:var(--muted-fg)]">Cutoff H-70, estimasi tiba, gate, dan status dihitung sistem.</p>
              </div>
              {createScheduleIssues.length ? (
                <div className="rounded-[18px] border border-[color:var(--tone-warning-border)] bg-[color:var(--tone-warning-soft)] px-4 py-3 text-sm font-semibold text-[color:var(--tone-warning)]">
                  {createScheduleIssues.map((issue) => (
                    <p key={issue.message}>{issue.message}</p>
                  ))}
                </div>
              ) : null}
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label">Kode Maskapai</label>
                  <select
                    className="select-field"
                    value={createForm.airlineCode}
                    onChange={(event) =>
                      setCreateForm((current) =>
                        applyFlightMasterRules(current, {
                        airlineCode: event.target.value as SupportedAirlineCode,
                        }),
                      )
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
                  <select
                    className="select-field"
                    value={createForm.aircraftType}
                    onChange={(event) => setCreateForm((current) => ({ ...current, aircraftType: event.target.value }))}
                  >
                    {AIRCRAFT_TYPE_OPTIONS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                  <p className="form-help">Bisa dipilih karena satu maskapai punya beberapa tipe armada.</p>
                </div>
                <div>
                  <label className="label">Asal</label>
                  <select
                    className="select-field"
                    value={createForm.origin}
                    onChange={(event) => setCreateForm((current) => applyFlightMasterRules(current, { origin: event.target.value }))}
                  >
                    {STATION_OPTIONS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Tujuan</label>
                  <select
                    className="select-field"
                    value={createForm.destination}
                    onChange={(event) => setCreateForm((current) => applyFlightMasterRules(current, { destination: event.target.value }))}
                  >
                    {STATION_OPTIONS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Batas Terima Cargo Otomatis</label>
                  <input type="datetime-local" className="input-field input-readonly" value={createForm.cargoCutoffTime} readOnly />
                  <p className="form-help">H-70 menit dari waktu berangkat.</p>
                </div>
                <div>
                  <label className="label">Waktu Berangkat</label>
                  <input
                    type="datetime-local"
                    className="input-field"
                    value={createForm.departureTime}
                    onChange={(event) => setCreateForm((current) => applyFlightMasterRules(current, { departureTime: event.target.value }))}
                  />
                  <p className="form-help">Jam pesawat berangkat dari station asal.</p>
                </div>
                <div>
                  <label className="label">Estimasi Tiba Otomatis</label>
                  <input type="datetime-local" className="input-field input-readonly" value={createForm.arrivalTime} readOnly />
                  <p className="form-help">Dihitung dari durasi rute master.</p>
                </div>
                <div className="flight-auto-status-card">
                  <p className="label">Status Otomatis</p>
                  <p className="font-semibold text-[color:var(--text-strong)]">Dihitung sistem</p>
                  <p className="form-help">Terjadwal sebelum jam berangkat, lalu berangkat saat waktu berjalan. Terlambat dipakai saat jadwal perlu disesuaikan.</p>
                </div>
                <div>
                  <label className="label">Gate Otomatis</label>
                  <input className="input-field input-readonly" value={createForm.gate} readOnly />
                  <p className="form-help">Ditetapkan dari station tujuan.</p>
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
      </OpsDrawer>

      <OpsDrawer
        open={editOpen && Boolean(selectedFlight)}
        eyebrow="Edit Flight"
        title={selectedFlight ? `Perbarui ${selectedFlight.flightNumber}` : "Edit Flight"}
        description="Ubah flight dalam drawer supaya manifest dan detail aktif tidak hilang dari alur kerja."
        onClose={() => setEditOpen(false)}
      >
            {selectedFlight ? (
            <div className="space-y-5">
              <div className="flight-time-note">
                <p className="font-semibold text-[color:var(--text-strong)]">Aturan master otomatis</p>
                <p className="mt-1 text-sm text-[color:var(--muted-fg)]">Cutoff, estimasi tiba, gate, dan status dihitung sistem.</p>
              </div>
              {editScheduleIssues.length ? (
                <div className="rounded-[18px] border border-[color:var(--tone-warning-border)] bg-[color:var(--tone-warning-soft)] px-4 py-3 text-sm font-semibold text-[color:var(--tone-warning)]">
                  {editScheduleIssues.map((issue) => (
                    <p key={issue.message}>{issue.message}</p>
                  ))}
                </div>
              ) : null}
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label">Kode Maskapai</label>
                  <select
                    className="select-field"
                    value={editDraft.airlineCode}
                    onChange={(event) =>
                      setEditDraft((current) =>
                        applyFlightMasterRules(current, {
                        airlineCode: event.target.value as SupportedAirlineCode,
                        }),
                      )
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
                  <select
                    className="select-field"
                    value={editDraft.aircraftType}
                    onChange={(event) => setEditDraft((current) => ({ ...current, aircraftType: event.target.value }))}
                  >
                    {!AIRCRAFT_TYPE_OPTIONS.includes(editDraft.aircraftType as (typeof AIRCRAFT_TYPE_OPTIONS)[number]) ? (
                      <option value={editDraft.aircraftType}>{editDraft.aircraftType}</option>
                    ) : null}
                    {AIRCRAFT_TYPE_OPTIONS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                  <p className="form-help">Gambar flight mengikuti tipe pesawat yang dipilih.</p>
                </div>
                <div>
                  <label className="label">Asal</label>
                  <select
                    className="select-field"
                    value={editDraft.origin}
                    onChange={(event) => setEditDraft((current) => applyFlightMasterRules(current, { origin: event.target.value }))}
                  >
                    {STATION_OPTIONS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Tujuan</label>
                  <select
                    className="select-field"
                    value={editDraft.destination}
                    onChange={(event) => setEditDraft((current) => applyFlightMasterRules(current, { destination: event.target.value }))}
                  >
                    {STATION_OPTIONS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Batas Terima Cargo Otomatis</label>
                  <input type="datetime-local" className="input-field input-readonly" value={editDraft.cargoCutoffTime} readOnly />
                  <p className="form-help">H-70 menit dari waktu berangkat.</p>
                </div>
                <div>
                  <label className="label">Waktu Berangkat</label>
                  <input
                    type="datetime-local"
                    className="input-field"
                    value={editDraft.departureTime}
                    onChange={(event) => setEditDraft((current) => applyFlightMasterRules(current, { departureTime: event.target.value }))}
                  />
                  <p className="form-help">Jam pesawat berangkat dari station asal.</p>
                </div>
                <div>
                  <label className="label">Estimasi Tiba Otomatis</label>
                  <input type="datetime-local" className="input-field input-readonly" value={editDraft.arrivalTime} readOnly />
                  <p className="form-help">Dihitung dari durasi rute master.</p>
                </div>
                <div className="flight-auto-status-card">
                  <p className="label">Status Otomatis</p>
                  <p className="font-semibold text-[color:var(--text-strong)]">Dihitung sistem</p>
                  <p className="form-help">Terjadwal sebelum jam berangkat, lalu berangkat saat waktu berjalan. Terlambat dipakai saat jadwal perlu disesuaikan.</p>
                </div>
                <div>
                  <label className="label">Gate Otomatis</label>
                  <input className="input-field input-readonly" value={editDraft.gate} readOnly />
                  <p className="form-help">Ditetapkan dari station tujuan.</p>
                </div>
              </div>

              <div>
                <label className="label">Catatan</label>
                <textarea
                  className="textarea-field"
                  value={editDraft.remarks}
                  onChange={(event) => setEditDraft((current) => ({ ...current, remarks: event.target.value }))}
                />
              </div>

              <div className="flex justify-end gap-3">
                <button type="button" className="btn btn-secondary" onClick={() => setEditOpen(false)}>
                  Batal
                </button>
                <button type="button" className="btn btn-primary" onClick={handleSaveFlight} disabled={saving}>
                  <Save size={16} />
                  {saving ? "Menyimpan..." : "Simpan Edit"}
                </button>
              </div>
            </div>
            ) : null}
      </OpsDrawer>
    </div>
  );
}
