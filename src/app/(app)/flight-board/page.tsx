"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
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
import { EmptyState, OpsPanel, PageHeader, SectionHeader } from "@/components/ops-ui";
import { OpsDrawer } from "@/components/ops-drawer";
import { ConfirmDialog } from "@/components/confirm-dialog";

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

const OPS_TIME_ZONE_OFFSET = "+08:00";
const OPS_TIME_ZONE = "Asia/Makassar";
const OPS_TIME_ZONE_LABEL = "WITA";

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
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: OPS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));

  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  return `${year}-${month}-${day}`;
}

function toDateTimeInputValue(value: string | Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: OPS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).formatToParts(new Date(value));

  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";

  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function fromOpsDateTimeInput(value: string) {
  return new Date(`${value}:00${OPS_TIME_ZONE_OFFSET}`);
}

function applyFlightMasterRules(form: FlightFormState, next: Partial<FlightFormState>) {
  const draft = { ...form, ...next };
  const departureTime = fromOpsDateTimeInput(draft.departureTime);

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
  const departureTime = fromOpsDateTimeInput(form.departureTime);
  const arrivalTime = fromOpsDateTimeInput(form.arrivalTime);
  const cargoCutoffTime = fromOpsDateTimeInput(form.cargoCutoffTime);
  const issues: { tone: "error" | "warning"; message: string }[] = [];

  if ([departureTime, arrivalTime, cargoCutoffTime].some((date) => Number.isNaN(date.getTime()))) {
    return [{ tone: "error" as const, message: "Jadwal belum valid." }];
  }

  if (arrivalTime <= departureTime) {
    issues.push({ tone: "error", message: "Estimasi tiba harus setelah waktu berangkat." });
  }

  if (cargoCutoffTime >= departureTime) {
    issues.push({ tone: "error", message: "Batas terima cargo harus sebelum waktu berangkat." });
  }

  if (mode === "create" && departureTime <= now) {
    issues.push({ tone: "error", message: "Penerbangan baru tidak boleh berangkat di masa lalu." });
  }

  if (mode === "create" && cargoCutoffTime <= now) {
    issues.push({ tone: "error", message: "Batas terima cargo sudah lewat. Pilih berangkat minimal 70 menit dari sekarang." });
  } else if (cargoCutoffTime.getTime() - now.getTime() < 30 * 60 * 1000) {
    issues.push({ tone: "warning", message: "Batas terima cargo kurang dari 30 menit. Pastikan manifest sudah siap." });
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
    departureTime: toDateTimeInputValue(flight.departureTime),
    arrivalTime: toDateTimeInputValue(flight.arrivalTime),
    cargoCutoffTime: toDateTimeInputValue(flight.cargoCutoffTime),
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

function readFlightBoardSearchParams() {
  if (typeof window === "undefined") {
    return new URLSearchParams();
  }

  return new URLSearchParams(window.location.search);
}

export default function FlightBoardPage() {
  const [status, setStatus] = useState(() => readFlightBoardSearchParams().get("status") || "all");
  const [query, setQuery] = useState(() => readFlightBoardSearchParams().get("query") || "");
  const [appliedQuery, setAppliedQuery] = useState(() => readFlightBoardSearchParams().get("query") || "");
  const [date, setDate] = useState(() => readFlightBoardSearchParams().get("date") || "");
  const [page, setPage] = useState(() => parsePageParam(readFlightBoardSearchParams().get("page")));
  const [data, setData] = useState<FlightBoardPayload | null>(null);
  const [initialLoadPending, setInitialLoadPending] = useState(true);
  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(() => readFlightBoardSearchParams().get("id"));
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [createForm, setCreateForm] = useState(() => createBlankFlightForm());
  const [editDraft, setEditDraft] = useState(() => createBlankFlightForm());
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<"info" | "warning">("info");
  const [confirmFlightDelete, setConfirmFlightDelete] = useState(false);
  const initialDateResolvedRef = useRef(false);
  const latestUrlParamsRef = useRef(readFlightBoardSearchParams().toString());

  const replaceFlightBoardUrl = useCallback(
    (next: { status?: string; query?: string; date?: string; page?: number; id?: string | null }) => {
      const params = readFlightBoardSearchParams();
      const nextStatus = next.status ?? status;
      const nextQuery = next.query ?? query;
      const nextDate = next.date ?? date;
      const nextPage = next.page ?? page;
      const nextId = next.id === undefined ? params.get("id") : next.id;

      if (nextStatus && nextStatus !== "all") params.set("status", nextStatus);
      else params.delete("status");

      if (nextQuery.trim()) params.set("query", nextQuery.trim());
      else params.delete("query");

      if (nextDate) params.set("date", nextDate);
      else params.delete("date");

      if (nextPage > 1) params.set("page", String(nextPage));
      else params.delete("page");

      if (nextId) params.set("id", nextId);
      else params.delete("id");

      const nextQueryString = params.toString();
      if (nextQueryString !== latestUrlParamsRef.current) {
        latestUrlParamsRef.current = nextQueryString;
        const nextUrl = nextQueryString ? `${window.location.pathname}?${nextQueryString}` : window.location.pathname;
        window.history.replaceState(null, "", nextUrl);
      }
    },
    [date, page, query, status],
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

    void requestFlightBoard({ includeDate: initialDateResolvedRef.current })
      .then((payload) => {
        if (!payload || cancelled) {
          return;
        }

        initialDateResolvedRef.current = true;
        replaceFlightBoardUrl({ date, page: payload.pagination.page });
        applyFlightBoardPayload(payload, date);
      })
      .finally(() => {
        if (!cancelled) {
          setInitialLoadPending(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [applyFlightBoardPayload, date, replaceFlightBoardUrl, requestFlightBoard]);

  useEffect(() => {
    function syncStateFromLocation() {
      const params = readFlightBoardSearchParams();
      const nextParams = params.toString();
      if (nextParams === latestUrlParamsRef.current) {
        return;
      }

      latestUrlParamsRef.current = nextParams;
      setStatus(params.get("status") || "all");
      setQuery(params.get("query") || "");
      setAppliedQuery(params.get("query") || "");
      setDate(params.get("date") || "");
      setPage(parsePageParam(params.get("page")));
      setSelectedFlightId(params.get("id"));
    }

    window.addEventListener("popstate", syncStateFromLocation);
    return () => window.removeEventListener("popstate", syncStateFromLocation);
  }, []);

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
      replaceFlightBoardUrl({ id: flightId });
    },
    [data?.flights, replaceFlightBoardUrl],
  );

  const handleDateChange = useCallback(
    (nextDate: string) => {
      setDate(nextDate);
      setPage(1);
      const visibleFlights = data?.flights ?? [];
      const nextSelectedFlight = selectedFlightId
        ? visibleFlights.find((flight) => flight.id === selectedFlightId) ?? null
        : null;

      setSelectedFlightId(nextSelectedFlight?.id ?? null);
      setEditDraft(createFlightDraft(nextSelectedFlight));
      replaceFlightBoardUrl({ date: nextDate, page: 1, id: nextSelectedFlight?.id ?? null });
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
    return fromOpsDateTimeInput(value).toISOString();
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
      setNotice("Nomor penerbangan harus terdiri dari 3-4 digit.");
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
        setNotice("Penerbangan berhasil dibuat.");
        void loadFlightBoardWithParams({
          date: nextDate,
          query: nextQuery,
          preferredFlightId: payload.flight.id,
        });
      } else {
        const errorMessage = await resolveErrorMessage(response, "Gagal membuat penerbangan.");
        setNoticeTone("warning");
        setNotice(errorMessage);
      }
    } catch {
      setNoticeTone("warning");
      setNotice("Koneksi terputus saat membuat penerbangan.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveFlight() {
    if (!selectedFlight) return;

    if (!isFlightNumberSuffixValid(editDraft.flightNumberSuffix)) {
      setNoticeTone("warning");
      setNotice("Nomor penerbangan harus terdiri dari 3-4 digit.");
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
        setNotice("Perubahan penerbangan berhasil disimpan.");
        void loadFlightBoardWithParams({
          date: nextDate,
          query: appliedQuery,
          preferredFlightId: payload.flight.id,
        });
      } else {
        const errorMessage = await resolveErrorMessage(response, "Gagal memperbarui penerbangan.");
        setNoticeTone("warning");
        setNotice(errorMessage);
      }
    } catch {
      setNoticeTone("warning");
      setNotice("Koneksi terputus saat memperbarui penerbangan.");
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

    setSaving(true);

    try {
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
        setConfirmFlightDelete(false);
        setNoticeTone("info");
        setNotice(`Penerbangan ${selectedFlight.flightNumber} berhasil diarsipkan dari papan aktif.`);
        void loadFlightBoard();
      } else {
        const errorMessage = await resolveErrorMessage(response, "Gagal mengarsipkan penerbangan.");
        setNoticeTone("warning");
        setNotice(errorMessage);
      }
    } catch {
      setNoticeTone("warning");
      setNotice("Koneksi terputus saat mengarsipkan penerbangan.");
    } finally {
      setSaving(false);
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
      replaceFlightBoardUrl({ page: clampedPage, id: null });

      const payload = await requestFlightBoard({ includeDate: true, page: clampedPage });
      if (!payload) return;
      applyFlightBoardPayload(payload, date, null);
    },
    [applyFlightBoardPayload, date, replaceFlightBoardUrl, requestFlightBoard, totalFlightPages],
  );

  const filterControls = useMemo(
    () => (
      <section className="ops-filter-strip" aria-label="Pencarian dan filter Papan Penerbangan">
        <div className="ops-filter-search">
          <label className="label" htmlFor="flightboard-query">Cari Penerbangan</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[color:var(--muted-fg)]" />
            <input
              id="flightboard-query"
              className="input-field input-field-leading"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari nomor penerbangan, rute, atau stasiun"
            />
          </div>
        </div>
      <div className="shell-inline-filters" aria-label="Filter Papan Penerbangan">
        <div className="shell-filter-field">
          <label className="label" htmlFor="flightboard-status">Status</label>
          <select id="flightboard-status" className="select-field" value={status} onChange={(event) => handleStatusChange(event.target.value)}>
            <option value="all">Semua</option>
            <option value="on_time">Terjadwal</option>
            <option value="delayed">Terlambat</option>
            <option value="departed">Berangkat</option>
          </select>
        </div>
        <div className="shell-filter-field shell-filter-field-wide">
          <label className="label" htmlFor="flightboard-date">Tanggal</label>
          <input
            id="flightboard-date"
            type="date"
            className="input-field"
            value={date}
            onChange={(event) => handleDateChange(event.target.value)}
          />
        </div>
      </div>
      </section>
    ),
    [date, handleDateChange, handleStatusChange, query, status],
  );

  return (
    <div className="page-workspace flightboard-viewport">
      <PageHeader
        eyebrow="Pemantauan Keberangkatan"
        title="Papan Penerbangan"
        subtitle={`Tambah, cari, ubah, dan arsipkan penerbangan. Semua jam operasional memakai ${OPS_TIME_ZONE_LABEL}.`}
      />

      {filterControls}

      {notice ? (
        <div
          role="status"
          aria-live="polite"
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
              className={cn(
                "ops-panel overflow-hidden text-left transition duration-150 hover:-translate-y-[1px]",
                selectedFlight?.id === flight.id ? "flight-card-active" : null,
              )}
              aria-pressed={selectedFlight?.id === flight.id}
              aria-label={`Pilih penerbangan ${flight.flightNumber}`}
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
                    <p className="label">Batas Kargo T-70 ({OPS_TIME_ZONE_LABEL})</p>
                    <p className="font-semibold text-[color:var(--text-strong)]">{formatDateTime(flight.cargoCutoffTime)}</p>
                  </div>
                  <div>
                    <p className="label">Berangkat ({OPS_TIME_ZONE_LABEL})</p>
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
              title={initialLoadPending ? "Memuat data penerbangan" : "Tidak ada penerbangan pada filter ini"}
              copy={
                initialLoadPending
                  ? "Manifest penerbangan sedang diambil dari basis data."
                  : "Ubah kata kunci, status, atau tanggal untuk melihat penerbangan yang tersedia."
              }
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
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[color:var(--border-soft)] p-5">
            <SectionHeader title="Manifest Penerbangan" subtitle="Daftar penerbangan yang sudah difilter dan siap dipilih untuk detail lebih lanjut." />
            <div className="flex flex-wrap gap-2">
              {data?.permissions.canExport ? (
                <Link
                  href={`/exports/flights?${flightExportQuery}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary"
                >
                  <FileText size={16} />
                  Cetak Penerbangan
                </Link>
              ) : null}
              {data?.permissions.canManageFlights ? (
                <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
                  <Plus size={16} />
                  Buat Penerbangan
                </button>
              ) : null}
            </div>
          </div>
          <div className="flightboard-manifest-scroll flight-manifest-table-space internal-scrollbar table-shell">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Penerbangan</th>
                  <th>Rute</th>
                  <th>Batas Kargo T-70</th>
                  <th>Berangkat ({OPS_TIME_ZONE_LABEL})</th>
                  <th>Status</th>
                  <th>Pengiriman</th>
                </tr>
              </thead>
              <tbody>
                {initialLoadPending ? (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState icon={PlaneTakeoff} title="Memuat manifest penerbangan" copy="Data penerbangan sedang disiapkan dari basis data." className="m-4" />
                    </td>
                  </tr>
                ) : visibleFlights.length ? (
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
                      <EmptyState icon={PlaneTakeoff} title="Tidak ada data manifest" copy="Belum ada penerbangan yang sesuai dengan tanggal dan filter yang dipilih." className="m-4" />
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
              disabled={initialLoadPending || !canGoPrevious}
            >
              <ChevronLeft size={16} />
              Sebelumnya
            </button>
            <p>{initialLoadPending ? "Memuat data penerbangan" : `${visibleFlightStart}-${visibleFlightEnd} dari ${totalFlightItems} • Halaman ${page}/${totalFlightPages}`}</p>
            <button
              type="button"
              className="topbar-button"
              onClick={() => void handleManifestPageChange(page + 1)}
              disabled={initialLoadPending || !canGoNext}
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
                    <p className="ops-eyebrow">Penerbangan Terpilih</p>
                    <h2 className="mt-1 font-[family:var(--font-heading)] text-[2rem] font-black tracking-[-0.05em] text-[color:var(--text-strong)]">{selectedFlight.flightNumber}</h2>
                    <p className="mt-2 text-sm text-[color:var(--muted-fg)]">{selectedFlight.route}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge value={selectedFlight.status} label={selectedFlight.statusLabel} className="shrink-0" />
                    <button
                      type="button"
                      className="topbar-button flightboard-detail-close"
                      onClick={() => {
                        setSelectedFlightId(null);
                        setEditDraft(createFlightDraft(null));
                      }}
                      aria-label="Tutup detail penerbangan"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="ops-panel-muted p-4">
                  <p className="label">Batas Kargo T-70 ({OPS_TIME_ZONE_LABEL})</p>
                  <p className="font-semibold text-[color:var(--text-strong)]">{formatDateTime(selectedFlight.cargoCutoffTime)}</p>
                </div>
                <div className="ops-panel-muted p-4">
                  <p className="label">Berangkat ({OPS_TIME_ZONE_LABEL})</p>
                  <p className="font-semibold text-[color:var(--text-strong)]">{formatDateTime(selectedFlight.departureTime)}</p>
                </div>
                <div className="ops-panel-muted p-4">
                  <p className="label">Estimasi Tiba ({OPS_TIME_ZONE_LABEL})</p>
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
                    Ubah Penerbangan
                  </button>
                  <button type="button" className="btn btn-danger" onClick={() => setConfirmFlightDelete(true)}>
                    <X size={16} />
                    Arsipkan
                  </button>
                </div>
              ) : null}

              <div>
                <p className="label">Pengiriman Terkait</p>
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
                    <p className="text-sm text-[color:var(--muted-fg)]">Belum ada pengiriman yang terhubung ke penerbangan ini.</p>
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
        eyebrow="Buat Penerbangan"
        title="Tambah penerbangan baru"
        description="Jadwal, pesawat, gate, batas terima kargo, dan estimasi tiba disusun sebagai panel kerja kanan agar konteks papan penerbangan tetap terlihat."
        onClose={() => setCreateOpen(false)}
      >
            <form className="space-y-5" onSubmit={handleCreateFlight}>
              <div className="flight-time-note">
                <p className="font-semibold text-[color:var(--text-strong)]">Aturan master otomatis</p>
                <p className="mt-1 text-sm text-[color:var(--muted-fg)]">Semua jam memakai {OPS_TIME_ZONE_LABEL}. Batas kargo otomatis T-70 menit sebelum berangkat; estimasi tiba dan gate dihitung dari master rute.</p>
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
                  <label className="label">Nomor Penerbangan (3-4 digit)</label>
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
                  <label className="label">Batas Kargo T-70 Otomatis ({OPS_TIME_ZONE_LABEL})</label>
                  <input type="datetime-local" className="input-field input-readonly" value={createForm.cargoCutoffTime} readOnly />
                  <p className="form-help">Tidak perlu diisi manual. Sistem memakai T-70 menit dari waktu berangkat.</p>
                </div>
                <div>
                  <label className="label">Waktu Berangkat ({OPS_TIME_ZONE_LABEL})</label>
                  <input
                    type="datetime-local"
                    className="input-field"
                    value={createForm.departureTime}
                    onChange={(event) => setCreateForm((current) => applyFlightMasterRules(current, { departureTime: event.target.value }))}
                  />
                  <p className="form-help">Jam lokal operasional bandara, bukan UTC.</p>
                </div>
                <div>
                  <label className="label">Estimasi Tiba Otomatis ({OPS_TIME_ZONE_LABEL})</label>
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
                  <p className="form-help">Ditetapkan dari stasiun tujuan.</p>
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
                  {saving ? "Menyimpan..." : "Buat Penerbangan"}
                </button>
              </div>
            </form>
      </OpsDrawer>

      <OpsDrawer
        open={editOpen && Boolean(selectedFlight)}
        eyebrow="Ubah Penerbangan"
        title={selectedFlight ? `Perbarui ${selectedFlight.flightNumber}` : "Ubah Penerbangan"}
        description="Ubah penerbangan dalam panel supaya manifest dan detail aktif tidak hilang dari alur kerja."
        onClose={() => setEditOpen(false)}
      >
            {selectedFlight ? (
            <div className="space-y-5">
              <div className="flight-time-note">
                <p className="font-semibold text-[color:var(--text-strong)]">Aturan master otomatis</p>
                <p className="mt-1 text-sm text-[color:var(--muted-fg)]">Semua jam memakai {OPS_TIME_ZONE_LABEL}. Batas kargo T-70, estimasi tiba, dan gate mengikuti waktu berangkat serta rute penerbangan.</p>
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
                  <label className="label">Nomor Penerbangan (3-4 digit)</label>
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
                  <p className="form-help">Gambar penerbangan mengikuti tipe pesawat yang dipilih.</p>
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
                  <label className="label">Batas Kargo T-70 Otomatis ({OPS_TIME_ZONE_LABEL})</label>
                  <input type="datetime-local" className="input-field input-readonly" value={editDraft.cargoCutoffTime} readOnly />
                  <p className="form-help">Tidak perlu diisi manual. Sistem memakai T-70 menit dari waktu berangkat.</p>
                </div>
                <div>
                  <label className="label">Waktu Berangkat ({OPS_TIME_ZONE_LABEL})</label>
                  <input
                    type="datetime-local"
                    className="input-field"
                    value={editDraft.departureTime}
                    onChange={(event) => setEditDraft((current) => applyFlightMasterRules(current, { departureTime: event.target.value }))}
                  />
                  <p className="form-help">Jam lokal operasional bandara, bukan UTC.</p>
                </div>
                <div>
                  <label className="label">Estimasi Tiba Otomatis ({OPS_TIME_ZONE_LABEL})</label>
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
                  <p className="form-help">Ditetapkan dari stasiun tujuan.</p>
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
                  {saving ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </div>
            ) : null}
      </OpsDrawer>

      <ConfirmDialog
        open={confirmFlightDelete}
        title="Arsipkan penerbangan ini?"
        description={
          selectedFlight
            ? `Penerbangan ${selectedFlight.flightNumber} (${selectedFlight.route}) akan keluar dari papan aktif, tetapi jejak audit dan data historis tetap tersimpan.`
            : "Penerbangan akan keluar dari papan aktif, tetapi data historis tetap tersimpan."
        }
        confirmLabel="Ya, arsipkan penerbangan"
        tone="danger"
        loading={saving}
        onConfirm={() => void handleDeleteFlight()}
        onCancel={() => setConfirmFlightDelete(false)}
      />
    </div>
  );
}
