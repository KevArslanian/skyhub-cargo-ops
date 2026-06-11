"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  FileText,
  Pencil,
  PlaneTakeoff,
  Plus,
  Save,
  Search,
  X,
} from "lucide-react";
import { cn, formatDateTime } from "@/lib/format";
import { useOpsAlert } from "@/components/ops-alert-provider";
import { openAwbReceiptPrint } from "@/lib/awb-receipt";
import { networkErrorMessage, readApiError } from "@/lib/ops-feedback";
import { AIRCRAFT_CAPACITY_KG, AIRCRAFT_TYPE_OPTIONS, OPS_LIST_PAGE_SIZE, stationSelectOptions } from "@/lib/constants";
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

import {
  CrudPageScaffold,
  EmptyState,
  FilterBar,
  FilterFields,
  FilterSearch,
  OpsListErrorBanner,
  OpsPanel,
  PaginationBar,
  SectionHeader,
} from "@/components/ops-ui";
import { GlassDatePicker } from "@/components/glass-date-picker";
import { GlassSelect } from "@/components/glass-select";
import { OpsDrawer } from "@/components/ops-drawer";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  scrollToFirstFieldError,
  validateFlightFormDetailed,
  type FlightFormErrors,
} from "@/lib/client-validation";

function fieldClassName(base: string, error?: string) {
  return cn(base, error && "is-invalid");
}

function FormFieldError({ message }: { message?: string }) {
  return message ? <p className="form-field-error">{message}</p> : null;
}


type FlightBoardPayload = {
  permissions: {
    canManageFlights: boolean;
    canExport: boolean;
  };
  summary: {
    onTime: number;
    atRisk: number;
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
  at_risk: "Perlu konfirmasi",
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
  const { showAlert, showToast } = useOpsAlert();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState(() => searchParams.get("status") || "all");
  const [query, setQuery] = useState(() => searchParams.get("query") || "");
  const [appliedQuery, setAppliedQuery] = useState(() => searchParams.get("query") || "");
  const [dateFrom, setDateFrom] = useState(() => searchParams.get("dateFrom") || searchParams.get("date") || "");
  const [dateTo, setDateTo] = useState(() => searchParams.get("dateTo") || searchParams.get("date") || "");
  const [page, setPage] = useState(() => parsePageParam(searchParams.get("page")));
  const [data, setData] = useState<FlightBoardPayload | null>(null);
  const [initialLoadPending, setInitialLoadPending] = useState(true);
  const [initialLoadTimedOut, setInitialLoadTimedOut] = useState(false);
  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(() => searchParams.get("id"));
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [createForm, setCreateForm] = useState(() => createBlankFlightForm());
  const [editDraft, setEditDraft] = useState(() => createBlankFlightForm());
  const [confirmFlightDelete, setConfirmFlightDelete] = useState(false);
  const [createErrors, setCreateErrors] = useState<FlightFormErrors>({});
  const [editErrors, setEditErrors] = useState<FlightFormErrors>({});
  const [listError, setListError] = useState<string | null>(null);
  const initialDateResolvedRef = useRef(
    Boolean(searchParams.get("date") || searchParams.get("dateFrom") || searchParams.get("dateTo")),
  );
  const latestUrlParamsRef = useRef(searchParams.toString());

  const replaceFlightBoardUrl = useCallback(
    (next: { status?: string; query?: string; dateFrom?: string; dateTo?: string; page?: number; id?: string | null }) => {
      const params = readFlightBoardSearchParams();
      const nextStatus = next.status ?? status;
      const nextQuery = next.query ?? query;
      const nextDateFrom = next.dateFrom ?? dateFrom;
      const nextDateTo = next.dateTo ?? dateTo;
      const nextPage = next.page ?? page;
      const nextId = next.id === undefined ? params.get("id") : next.id;

      if (nextStatus && nextStatus !== "all") params.set("status", nextStatus);
      else params.delete("status");

      if (nextQuery.trim()) params.set("query", nextQuery.trim());
      else params.delete("query");

      if (nextDateFrom) params.set("dateFrom", nextDateFrom);
      else params.delete("dateFrom");

      if (nextDateTo) params.set("dateTo", nextDateTo);
      else params.delete("dateTo");

      params.delete("date");

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
    [dateFrom, dateTo, page, query, status],
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

  const handleSearchSubmit = useCallback(() => {
    setAppliedQuery(query.trim());
    setPage(1);
    replaceFlightBoardUrl({ query: query.trim(), page: 1 });
  }, [query, replaceFlightBoardUrl]);

  const applyFlightBoardPayload = useCallback(
    (payload: FlightBoardPayload, preferredFlightId = selectedFlightId) => {
      const nextSelectedFlight = preferredFlightId
        ? payload.flights.find((flight) => flight.id === preferredFlightId) ?? null
        : null;

      setData(payload);
      setPage(payload.pagination.page);
      setSelectedFlightId(nextSelectedFlight?.id ?? null);
      setEditDraft(createFlightDraft(nextSelectedFlight));
    },
    [selectedFlightId],
  );

  const requestFlightBoard = useCallback(async (options?: { includeDate?: boolean; page?: number }) => {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (appliedQuery.trim()) params.set("query", appliedQuery.trim());
    if (options?.includeDate ?? initialDateResolvedRef.current) {
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
    }
    params.set("page", String(options?.page ?? page));
    params.set("pageSize", String(OPS_LIST_PAGE_SIZE));
    try {
      const response = await fetch(`/api/flights?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) {
        setListError(await readApiError(response, "Data Manajemen Pesawat belum bisa dimuat."));
        return null;
      }

      setListError(null);
      return (await response.json()) as FlightBoardPayload;
    } catch {
      setListError(networkErrorMessage("memuat papan penerbangan"));
      return null;
    }
  }, [appliedQuery, dateFrom, dateTo, page, status]);

  const loadFlightBoard = useCallback(
    async (options?: { preferredFlightId?: string | null }) => {
      const payload = await requestFlightBoard({ includeDate: true });
      if (!payload) return;

      applyFlightBoardPayload(payload, options?.preferredFlightId ?? selectedFlightId);
    },
    [applyFlightBoardPayload, requestFlightBoard, selectedFlightId],
  );

  useEffect(() => {
    let cancelled = false;

    void requestFlightBoard({ includeDate: initialDateResolvedRef.current })
      .then((payload) => {
        if (!payload || cancelled) {
          return;
        }

        initialDateResolvedRef.current = true;
        replaceFlightBoardUrl({ dateFrom, dateTo, page: payload.pagination.page });
        applyFlightBoardPayload(payload);
      })
      .finally(() => {
        if (!cancelled) {
          setInitialLoadPending(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [applyFlightBoardPayload, dateFrom, dateTo, replaceFlightBoardUrl, requestFlightBoard]);

  useEffect(() => {
    if (!initialLoadPending) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setInitialLoadPending(false);
      setInitialLoadTimedOut(true);
    }, 10_000);

    return () => window.clearTimeout(timer);
  }, [initialLoadPending]);

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
      setDateFrom(params.get("dateFrom") || params.get("date") || "");
      setDateTo(params.get("dateTo") || params.get("date") || "");
      setPage(parsePageParam(params.get("page")));
      setSelectedFlightId(params.get("id"));
    }

    window.addEventListener("popstate", syncStateFromLocation);
    return () => window.removeEventListener("popstate", syncStateFromLocation);
  }, []);



  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible" || createOpen || editOpen || saving) return;
      void loadFlightBoard();
    }, 20000);

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

  const closeSelectedFlight = useCallback(() => {
    setSelectedFlightId(null);
    setEditDraft(createFlightDraft(null));
    replaceFlightBoardUrl({ id: null });
  }, [replaceFlightBoardUrl]);

  const handleDateRangeChange = useCallback(
    (next: { dateFrom?: string; dateTo?: string }) => {
      const nextDateFrom = next.dateFrom ?? dateFrom;
      const nextDateTo = next.dateTo ?? dateTo;
      setPage(1);
      setDateFrom(nextDateFrom);
      setDateTo(nextDateTo);
      const nextSelectedFlight = selectedFlightId
        ? (data?.flights ?? []).find((flight) => flight.id === selectedFlightId) ?? null
        : null;

      setSelectedFlightId(nextSelectedFlight?.id ?? null);
      setEditDraft(createFlightDraft(nextSelectedFlight));
      replaceFlightBoardUrl({ dateFrom: nextDateFrom, dateTo: nextDateTo, page: 1, id: nextSelectedFlight?.id ?? null });
    },
    [data?.flights, dateFrom, dateTo, replaceFlightBoardUrl, selectedFlightId],
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


  function composeFlightNumber(form: FlightFormState) {
    return buildFlightNumber(form.airlineCode, form.flightNumberSuffix);
  }

  function clearCreateFieldError(field: keyof FlightFormErrors) {
    setCreateErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function clearEditFieldError(field: keyof FlightFormErrors) {
    setEditErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function handleCreateFlight(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validation = validateFlightFormDetailed(createForm, createScheduleIssues);
    if (!validation.ok) {
      setCreateErrors(validation.errors);
      scrollToFirstFieldError(validation.errors);
      return;
    }
    setCreateErrors({});

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
        setCreateErrors({});
        setDateFrom(nextDate);
        setDateTo(nextDate);
        setQuery(nextQuery);
        setAppliedQuery(nextQuery);
        setPage(1);
        replaceFlightBoardUrl({ dateFrom: nextDate, dateTo: nextDate, query: nextQuery, page: 1 });
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
        showToast({ title: "Berhasil", description: "Penerbangan berhasil dibuat." });
        void loadFlightBoardWithParams({
          dateFrom: nextDate,
          dateTo: nextDate,
          query: nextQuery,
          preferredFlightId: payload.flight.id,
        });
      } else {
        const errorMessage = await readApiError(response, "Gagal membuat penerbangan.");
        showAlert({ title: "Peringatan", description: errorMessage, tone: "warning" });
      }
    } catch {
      showAlert({ title: "Peringatan", description: "Koneksi terputus saat membuat penerbangan.", tone: "warning" });
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveFlight() {
    if (!selectedFlight) return;

    const validation = validateFlightFormDetailed(editDraft, editScheduleIssues);
    if (!validation.ok) {
      setEditErrors(validation.errors);
      scrollToFirstFieldError(validation.errors);
      return;
    }
    setEditErrors({});

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
        setDateFrom(nextDate);
        setDateTo(nextDate);
        setPage(1);
        replaceFlightBoardUrl({ dateFrom: nextDate, dateTo: nextDate, page: 1 });
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
        setEditErrors({});
        showToast({ title: "Berhasil", description: "Perubahan penerbangan berhasil disimpan." });
        void loadFlightBoardWithParams({
          dateFrom: nextDate,
          dateTo: nextDate,
          query: appliedQuery,
          preferredFlightId: payload.flight.id,
        });
      } else {
        const errorMessage = await readApiError(response, "Gagal memperbarui penerbangan.");
        showAlert({ title: "Peringatan", description: errorMessage, tone: "warning" });
      }
    } catch {
      showAlert({ title: "Peringatan", description: "Koneksi terputus saat memperbarui penerbangan.", tone: "warning" });
    } finally {
      setSaving(false);
    }
  }

  async function loadFlightBoardWithParams(input: { dateFrom?: string; dateTo?: string; query?: string; preferredFlightId?: string | null }) {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (input.query?.trim()) params.set("query", input.query.trim());
    if (input.dateFrom) params.set("dateFrom", input.dateFrom);
    if (input.dateTo) params.set("dateTo", input.dateTo);
    params.set("page", "1");
    params.set("pageSize", String(OPS_LIST_PAGE_SIZE));

    try {
      const response = await fetch(`/api/flights?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) {
        setListError(await readApiError(response, "Data Manajemen Pesawat belum bisa dimuat."));
        return;
      }

      setListError(null);
      const payload = (await response.json()) as FlightBoardPayload;
      applyFlightBoardPayload(payload, input.preferredFlightId ?? null);
    } catch {
      setListError(networkErrorMessage("memuat papan penerbangan"));
    }
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
        showToast({
          title: "Berhasil",
          description: `Penerbangan ${selectedFlight.flightNumber} berhasil diarsipkan dari papan aktif.`,
        });
        void loadFlightBoard();
      } else {
        const errorMessage = await readApiError(response, "Gagal mengarsipkan penerbangan.");
        showAlert({ title: "Peringatan", description: errorMessage, tone: "warning" });
      }
    } catch {
      showAlert({ title: "Peringatan", description: "Koneksi terputus saat mengarsipkan penerbangan.", tone: "warning" });
    } finally {
      setSaving(false);
    }
  }

  const visibleFlights = useMemo(() => data?.flights ?? [], [data]);

  const selectedFlight = visibleFlights.find((flight) => flight.id === selectedFlightId) ?? null;
  const totalFlightPages = data?.pagination.totalPages ?? 1;
  const totalFlightItems = data?.pagination.totalItems ?? 0;
  const visibleFlightStart = totalFlightItems ? (page - 1) * 10 + 1 : 0;
  const visibleFlightEnd = Math.min((page - 1) * 10 + visibleFlights.length, totalFlightItems);
  const flightExportQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (appliedQuery.trim()) params.set("query", appliedQuery.trim());
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    return params.toString();
  }, [appliedQuery, dateFrom, dateTo, status]);
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
      applyFlightBoardPayload(payload, null);
    },
    [applyFlightBoardPayload, replaceFlightBoardUrl, requestFlightBoard, totalFlightPages],
  );

  const pageActions = useMemo(
    () => (
      <div className="flex flex-wrap gap-2">
        {data?.permissions.canExport ? (
          <Link href={`/exports/flights?${flightExportQuery}`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
            <FileText size={16} />
            Cetak Penerbangan
          </Link>
        ) : null}
        {data?.permissions.canManageFlights ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setCreateErrors({});
              setCreateOpen(true);
            }}
          >
            <Plus size={16} />
            Buat Penerbangan
          </button>
        ) : null}
      </div>
    ),
    [data?.permissions.canExport, data?.permissions.canManageFlights, flightExportQuery],
  );

  const filterControls = useMemo(
    () => (
      <FilterBar ariaLabel="Pencarian dan filter Manajemen Pesawat" stacked>
        <FilterSearch>
          <label className="label" htmlFor="flightboard-query">Cari Penerbangan</label>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[color:var(--muted-fg)]" />
              <input
                id="flightboard-query"
                className="input-field input-field-leading"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleSearchSubmit();
                  }
                }}
                placeholder="Cari penerbangan, rute, atau status"
              />
            </div>
            <button type="button" className="btn btn-primary h-[48px] shrink-0 px-5" onClick={handleSearchSubmit} aria-label="Cari penerbangan">
              <Search size={16} />
              Cari
            </button>
          </div>
        </FilterSearch>
      <FilterFields aria-label="Filter Manajemen Pesawat">
        <div className="shell-filter-field">
          <label className="label" htmlFor="flightboard-status">Status</label>
          <GlassSelect
            id="flightboard-status"
            aria-label="Filter status penerbangan"
            value={status}
            onChange={handleStatusChange}
            options={[
              { value: "all", label: "Semua" },
              { value: "on_time", label: "Terjadwal" },
              { value: "at_risk", label: "Perlu konfirmasi" },
              { value: "delayed", label: "Terlambat" },
              { value: "departed", label: "Berangkat" },
            ]}
          />
        </div>
        <div className="shell-filter-field shell-filter-field-wide">
          <label className="label" htmlFor="flightboard-date-from">Tanggal Awal</label>
          <GlassDatePicker
            id="flightboard-date-from"
            aria-label="Tanggal awal"
            value={dateFrom}
            onChange={(nextValue) => handleDateRangeChange({ dateFrom: nextValue })}
          />
        </div>
        <div className="shell-filter-field shell-filter-field-wide">
          <label className="label" htmlFor="flightboard-date-to">Tanggal Akhir</label>
          <GlassDatePicker
            id="flightboard-date-to"
            aria-label="Tanggal akhir"
            min={dateFrom || undefined}
            value={dateTo}
            onChange={(nextValue) => handleDateRangeChange({ dateTo: nextValue })}
          />
        </div>
      </FilterFields>
      </FilterBar>
    ),
    [dateFrom, dateTo, handleDateRangeChange, handleSearchSubmit, handleStatusChange, query, status],
  );

  return (
    <CrudPageScaffold
      className="flightboard-viewport"
      eyebrow="Manajemen Pesawat"
      title="Manajemen Pesawat"
      subtitle={`Kelola jadwal, assignment pesawat, kapasitas, dan arsip keberangkatan. Semua jam operasional memakai ${OPS_TIME_ZONE_LABEL}.`}
      actions={pageActions}
      filters={filterControls}
      footer={
        <PaginationBar
          page={page}
          totalPages={totalFlightPages}
          visibleStart={visibleFlightStart}
          visibleEnd={visibleFlightEnd}
          totalItems={totalFlightItems}
          onPageChange={(nextPage) => void handleManifestPageChange(nextPage)}
          label="Penerbangan"
        />
      }
      body={
      <>
      <div className="flightboard-main flightboard-editor-layout min-h-0 flex-1 overflow-hidden">
        <OpsPanel
          className="page-pane flightboard-pane flightboard-manifest-panel flight-manifest-panel-space flex min-h-0 flex-col overflow-hidden"
        >
          <div className="shrink-0 border-b border-[color:var(--border-soft)] p-4 sm:p-5">
            <SectionHeader title="Daftar Pesawat Aktif" subtitle="Klik baris untuk detail penerbangan." />
          </div>
          <OpsListErrorBanner
            message={listError}
            onRetry={() => void loadFlightBoard()}
            onDismiss={() => setListError(null)}
          />
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
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {initialLoadPending ? (
                  <tr>
                    <td colSpan={7}>
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
                      <td className="text-right">
                        <button
                          type="button"
                          className="btn btn-secondary h-9 min-h-9 px-3 text-xs"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleSelectFlight(flight.id);
                          }}
                        >
                          <ArrowUpRight size={14} />
                          Detail
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7}>
                      <EmptyState
                        icon={PlaneTakeoff}
                        title={initialLoadTimedOut && !data ? "Gagal memuat manifest" : "Tidak ada data manifest"}
                        copy={
                          initialLoadTimedOut && !data
                            ? "Data penerbangan belum tersedia setelah 10 detik. Periksa koneksi lalu muat ulang halaman atau ubah filter tanggal."
                            : "Belum ada penerbangan yang sesuai dengan tanggal dan filter yang dipilih."
                        }
                        className="m-4"
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </OpsPanel>

        {selectedFlight ? (
          <OpsDrawer
            open={Boolean(selectedFlight)}
            eyebrow="Penerbangan Terpilih"
            title={`Detail ${selectedFlight.flightNumber}`}
            description="Ringkasan jadwal, gate, status, dan pengiriman terkait ditampilkan sebagai jendela kerja agar manifest tetap lapang."
            onClose={closeSelectedFlight}
            className="flightboard-detail-modal"
          >
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
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {selectedFlight.shipments.length ? (
                  <div className="ops-panel-muted col-span-2 p-4">
                    <p className="label">Muatan Manifest</p>
                    <p className="mt-2 font-mono font-semibold text-[color:var(--text-strong)]">
                      {selectedFlight.shipments.reduce((sum, item) => sum + item.weightKg, 0).toLocaleString("id-ID")} kg
                      {AIRCRAFT_CAPACITY_KG[selectedFlight.aircraftType]
                        ? ` / ${AIRCRAFT_CAPACITY_KG[selectedFlight.aircraftType].toLocaleString("id-ID")} kg kapasitas`
                        : ""}
                    </p>
                  </div>
                ) : null}
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
                      setEditErrors({});
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
                          <div className="min-w-0">
                            <p className="font-mono text-sm font-semibold text-[color:var(--brand-primary)]">{shipment.awb}</p>
                            <p className="mt-1 font-semibold text-[color:var(--text-strong)]">{shipment.commodity}</p>
                            <p className="mt-1 text-xs text-[color:var(--muted-fg)]">{shipment.weightKg} kg</p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-2">
                            <StatusBadge value={shipment.status} label={shipment.statusLabel} />
                            <button
                              type="button"
                              className="topbar-button"
                              onClick={() => openAwbReceiptPrint(shipment.awb)}
                              aria-label={`Cetak resi AWB ${shipment.awb}`}
                            >
                              <FileText size={16} />
                              Cetak Resi
                            </button>
                          </div>
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
          </OpsDrawer>
        ) : null}
      </div>

      <OpsDrawer
        open={createOpen}
        eyebrow="Buat Penerbangan"
        title="Tambah penerbangan baru"
        description="Jadwal, pesawat, gate, batas terima kargo, dan estimasi tiba disusun dalam jendela kerja agar manifest tetap lapang."
        onClose={() => setCreateOpen(false)}
        footer={
          <div className="flex w-full justify-end gap-3">
            <button type="button" className="btn btn-secondary" onClick={() => setCreateOpen(false)}>
              Batal
            </button>
            <button type="submit" form="create-flight-form" className="btn btn-primary" disabled={saving}>
              {saving ? "Menyimpan..." : "Buat Penerbangan"}
            </button>
          </div>
        }
      >
            <form id="create-flight-form" className="space-y-5" noValidate onSubmit={handleCreateFlight}>
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
                  <GlassSelect
                    aria-label="Kode maskapai"
                    value={createForm.airlineCode}
                    onChange={(value) =>
                      setCreateForm((current) =>
                        applyFlightMasterRules(current, {
                          airlineCode: value as SupportedAirlineCode,
                        }),
                      )
                    }
                    options={AIRLINE_CODE_OPTIONS.map((item) => ({ value: item.code, label: item.label }))}
                  />
                </div>
                <div data-field="flightNumberSuffix">
                  <label className="label">Nomor Penerbangan (3-4 digit)</label>
                  <input
                    className={fieldClassName("input-field", createErrors.flightNumberSuffix)}
                    value={createForm.flightNumberSuffix}
                    onChange={(event) => {
                      clearCreateFieldError("flightNumberSuffix");
                      setCreateForm((current) => ({
                        ...current,
                        flightNumberSuffix: normalizeFlightNumberSuffix(event.target.value),
                      }));
                    }}
                    placeholder="714"
                  />
                  <FormFieldError message={createErrors.flightNumberSuffix} />
                </div>
                <div>
                  <label className="label">Jenis Pesawat</label>
                  <GlassSelect
                    aria-label="Jenis pesawat"
                    value={createForm.aircraftType}
                    onChange={(value) => setCreateForm((current) => ({ ...current, aircraftType: value }))}
                    options={AIRCRAFT_TYPE_OPTIONS.map((item) => ({ value: item, label: item }))}
                  />
                  <p className="form-help">
                    Bisa dipilih karena satu maskapai punya beberapa tipe armada.
                    {AIRCRAFT_CAPACITY_KG[createForm.aircraftType]
                      ? ` Kapasitas muatan referensi: ${AIRCRAFT_CAPACITY_KG[createForm.aircraftType].toLocaleString("id-ID")} kg.`
                      : ""}
                  </p>
                </div>
                <div className="flight-station-pair md:col-span-2">
                  <div data-field="origin">
                    <label className="label">Asal</label>
                    <GlassSelect
                      aria-label="Stasiun asal"
                      value={createForm.origin}
                      onChange={(value) => {
                        clearCreateFieldError("origin");
                        clearCreateFieldError("destination");
                        setCreateForm((current) => applyFlightMasterRules(current, { origin: value }));
                      }}
                      options={stationSelectOptions()}
                      className={fieldClassName("select-field", createErrors.origin)}
                    />
                    <FormFieldError message={createErrors.origin} />
                  </div>
                  <div data-field="destination">
                    <label className="label">Tujuan</label>
                    <GlassSelect
                      aria-label="Stasiun tujuan"
                      value={createForm.destination}
                      onChange={(value) => {
                        clearCreateFieldError("destination");
                        setCreateForm((current) => applyFlightMasterRules(current, { destination: value }));
                      }}
                      options={stationSelectOptions()}
                      className={fieldClassName("select-field", createErrors.destination)}
                    />
                    <FormFieldError message={createErrors.destination} />
                  </div>
                </div>
                <div>
                  <label className="label">Batas Kargo T-70 Otomatis ({OPS_TIME_ZONE_LABEL})</label>
                  <input type="datetime-local" className="input-field input-readonly" value={createForm.cargoCutoffTime} readOnly />
                  <p className="form-help">Tidak perlu diisi manual. Sistem memakai T-70 menit dari waktu berangkat.</p>
                </div>
                <div data-field="departureTime">
                  <label className="label">Waktu Berangkat ({OPS_TIME_ZONE_LABEL})</label>
                  <input
                    type="datetime-local"
                    className={fieldClassName("input-field", createErrors.departureTime)}
                    value={createForm.departureTime}
                    onChange={(event) => {
                      clearCreateFieldError("departureTime");
                      setCreateForm((current) => applyFlightMasterRules(current, { departureTime: event.target.value }));
                    }}
                  />
                  <FormFieldError message={createErrors.departureTime} />
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
            </form>
      </OpsDrawer>

      <OpsDrawer
        open={editOpen && Boolean(selectedFlight)}
        eyebrow="Ubah Penerbangan"
        title={selectedFlight ? `Perbarui ${selectedFlight.flightNumber}` : "Ubah Penerbangan"}
        description="Ubah penerbangan dalam jendela kerja supaya manifest dan detail aktif tidak hilang dari alur kerja."
        onClose={() => setEditOpen(false)}
        footer={
          selectedFlight ? (
            <div className="flex w-full justify-end gap-3">
              <button type="button" className="btn btn-secondary" onClick={() => setEditOpen(false)}>
                Batal
              </button>
              <button type="button" className="btn btn-primary" onClick={handleSaveFlight} disabled={saving}>
                <Save size={16} />
                {saving ? "Menyimpan..." : "Simpan Perubahan"}
              </button>
            </div>
          ) : null
        }
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
                  <GlassSelect
                    aria-label="Kode maskapai"
                    value={editDraft.airlineCode}
                    onChange={(value) =>
                      setEditDraft((current) =>
                        applyFlightMasterRules(current, {
                          airlineCode: value as SupportedAirlineCode,
                        }),
                      )
                    }
                    options={AIRLINE_CODE_OPTIONS.map((item) => ({ value: item.code, label: item.label }))}
                  />
                </div>
                <div data-field="flightNumberSuffix">
                  <label className="label">Nomor Penerbangan (3-4 digit)</label>
                  <input
                    className={fieldClassName("input-field", editErrors.flightNumberSuffix)}
                    value={editDraft.flightNumberSuffix}
                    onChange={(event) => {
                      clearEditFieldError("flightNumberSuffix");
                      setEditDraft((current) => ({
                        ...current,
                        flightNumberSuffix: normalizeFlightNumberSuffix(event.target.value),
                      }));
                    }}
                    placeholder="714"
                  />
                  <FormFieldError message={editErrors.flightNumberSuffix} />
                </div>
                <div>
                  <label className="label">Jenis Pesawat</label>
                  <GlassSelect
                    aria-label="Jenis pesawat"
                    value={editDraft.aircraftType}
                    onChange={(value) => setEditDraft((current) => ({ ...current, aircraftType: value }))}
                    options={[
                      ...(!AIRCRAFT_TYPE_OPTIONS.includes(editDraft.aircraftType as (typeof AIRCRAFT_TYPE_OPTIONS)[number])
                        ? [{ value: editDraft.aircraftType, label: editDraft.aircraftType }]
                        : []),
                      ...AIRCRAFT_TYPE_OPTIONS.map((item) => ({ value: item, label: item })),
                    ]}
                  />
                  <p className="form-help">Gambar penerbangan mengikuti tipe pesawat yang dipilih.</p>
                </div>
                <div className="flight-station-pair md:col-span-2">
                  <div data-field="origin">
                    <label className="label">Asal</label>
                    <GlassSelect
                      aria-label="Stasiun asal"
                      value={editDraft.origin}
                      onChange={(value) => {
                        clearEditFieldError("origin");
                        clearEditFieldError("destination");
                        setEditDraft((current) => applyFlightMasterRules(current, { origin: value }));
                      }}
                      options={stationSelectOptions()}
                      className={fieldClassName("select-field", editErrors.origin)}
                    />
                    <FormFieldError message={editErrors.origin} />
                  </div>
                  <div data-field="destination">
                    <label className="label">Tujuan</label>
                    <GlassSelect
                      aria-label="Stasiun tujuan"
                      value={editDraft.destination}
                      onChange={(value) => {
                        clearEditFieldError("destination");
                        setEditDraft((current) => applyFlightMasterRules(current, { destination: value }));
                      }}
                      options={stationSelectOptions()}
                      className={fieldClassName("select-field", editErrors.destination)}
                    />
                    <FormFieldError message={editErrors.destination} />
                  </div>
                </div>
                <div>
                  <label className="label">Batas Kargo T-70 Otomatis ({OPS_TIME_ZONE_LABEL})</label>
                  <input type="datetime-local" className="input-field input-readonly" value={editDraft.cargoCutoffTime} readOnly />
                  <p className="form-help">Tidak perlu diisi manual. Sistem memakai T-70 menit dari waktu berangkat.</p>
                </div>
                <div data-field="departureTime">
                  <label className="label">Waktu Berangkat ({OPS_TIME_ZONE_LABEL})</label>
                  <input
                    type="datetime-local"
                    className={fieldClassName("input-field", editErrors.departureTime)}
                    value={editDraft.departureTime}
                    onChange={(event) => {
                      clearEditFieldError("departureTime");
                      setEditDraft((current) => applyFlightMasterRules(current, { departureTime: event.target.value }));
                    }}
                  />
                  <FormFieldError message={editErrors.departureTime} />
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
      </>
      }
    />
  );
}
