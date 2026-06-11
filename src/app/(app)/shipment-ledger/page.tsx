"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { memo, startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUpDown,
  FileText,
  Inbox,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
} from "lucide-react";
import { cn, formatDateTime, formatWeight } from "@/lib/format";
import {
  AIR_CARGO_MODE,
  AIR_VEHICLE_TYPE,
  COMMODITY_CUSTOM_VALUE,
  computeShippingRate,
  defaultDestinationForOrigin,
  destinationSelectOptions,
  FLIGHT_AUTO_SELECT_LABEL,
  FLIGHT_AUTO_SELECT_SHORT_LABEL,
  formatCapacityKgLabel,
  formatFlightSelectLabels,
  formatStationLabel,
  GOODS_STATUS_OPTIONS,
  SERVICE_TYPE_OPTIONS,
  SHIPMENT_DOC_STATUS_FORM_OPTIONS,
  resolveShipmentDocStatusValue,
  type StationCode,
} from "@/lib/constants";
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
  SkeletonBlock,
} from "@/components/ops-ui";
import { GlassDatePicker } from "@/components/glass-date-picker";
import { GlassSelect, type GlassSelectOption } from "@/components/glass-select";
import { OpsDrawer } from "@/components/ops-drawer";
import { useOpsAlert } from "@/components/ops-alert-provider";
import {
  scrollToFirstFieldError,
  type ShipmentCreateFormErrors,
  type ShipmentUpdateFormErrors,
  validateFilterDateTo,
  validateShipmentCreateFormDetailed,
  validateShipmentUpdateFormDetailed,
} from "@/lib/client-validation";
import {
  clampIsoDateToToday,
  DATE_TO_MAX_TODAY_MESSAGE,
  getOpsTodayIso,
} from "@/lib/date-input";
import {
  parseDecimalValue,
  sanitizeCommodityText,
  sanitizeDecimalInput,
  sanitizePersonName,
  sanitizePhoneInput,
} from "@/lib/input-guards";
import { openAwbReceiptPrint } from "@/lib/awb-receipt";
import { networkErrorMessage, readApiError } from "@/lib/ops-feedback";
import { buildShipmentSubmitPayload, SHIPPING_RATE_TOOLTIP } from "@/lib/shipment-payload";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useVisibleTablePageSize } from "@/lib/use-visible-table-page-size";

type ShipmentActor = {
  id: string;
  name: string;
  role: string;
  roleLabel: string;
  phone: string;
  station: string;
} | null;

type ShiftPicCandidate = {
  id: string;
  name: string;
  role: string;
  roleLabel: string;
  phone: string;
  station: string;
  label: string;
};

type ShipmentRow = {
  id: string;
  awb: string;
  sentAt: string;
  commodity: string;
  cargoMode: string;
  senderPhone: string;
  origin: string;
  destination: string;
  pieces: number;
  weightKg: number;
  volumeM3: number | null;
  specialHandling: string | null;
  serviceType: string;
  shippingRate: number;
  vehicleName: string;
  vehicleType: string;
  vehicleCode: string;
  vehicleCapacityKg: number;
  vehicleStatus: string;
  goodsStatus: string;
  transactionStatus: string;
  docStatus: string;
  readiness: string;
  shipper: string;
  consignee: string;
  forwarder: string;
  ownerName: string;
  shiftOwnerPhone: string;
  createdBy: ShipmentActor;
  shiftOwner: ShipmentActor;
  notes: string;
  status: string;
  statusLabel: string;
  needsReview: boolean;
  receivedAt: string;
  updatedAt: string;
  flightId: string | null;
  flightNumber: string | null;
  customerAccountId: string | null;
  customerAccountName: string | null;
  documentSummary: {
    docStatus: string;
    count: number;
    latestUploadedAt: string | null;
  };
  trackingLogs: {
    id: string;
    label: string;
    status: string;
    message: string;
    location: string;
    actorName: string | null;
    createdAt: string;
  }[];
  documents: {
    id: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    storageUrl: string;
    createdAt: string;
    blobCleanupStatus: string | null;
    paymentProof: boolean;
    paymentVerifiedAt: string | null;
    paymentVerifiedByName: string | null;
  }[];
};

type FlightOption = {
  id: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departureTime: string;
  cargoCutoffTime: string;
  aircraftType: string;
  vehicleName: string;
  vehicleCode: string;
  vehicleStatus: string;
  vehicleCapacityKg: number;
  usedCapacityKg: number;
  availableCapacityKg: number;
};

type LedgerPayload = {
  viewer: {
    id: string;
    name: string;
    role: "admin" | "staff" | "customer";
    roleLabel: string;
    phone: string;
    station: string;
    readOnly: boolean;
    customerAccountName: string | null;
  };
  permissions: {
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
    canDocument: boolean;
    canExport: boolean;
  };
  shipments: ShipmentRow[];
  flights: FlightOption[];
  commodities: { id: string; code: string; name: string; category: string }[];
  customerAccounts: { id: string; name: string; code: string }[];
  summary: {
    total: number;
    inTransit: number;
    onHold: number;
    delivered: number;
  };
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};

const TRANSACTION_STATUS_FORM_OPTIONS = ["Belum Lunas", "Menunggu Verifikasi", "Lunas", "Tidak Ditagih", "Pending"] as const;
function formatDateInput(value?: string | null) {
  return value ? value.slice(0, 10) : new Date().toISOString().slice(0, 10);
}

function formatActorLabel(actor: { name: string; roleLabel: string }) {
  return `${actor.name} — ${actor.roleLabel}`;
}

function resolveShiftPicPhone(candidate: ShiftPicCandidate | undefined, override: string) {
  if (candidate?.phone?.trim()) {
    return candidate.phone.trim();
  }
  return override;
}

function createDrawerDraft(shipment: ShipmentRow | null) {
  return {
    status: shipment?.status ?? "received",
    shiftOwnerId: shipment?.shiftOwner?.id ?? "",
    shiftOwnerPhone: shipment?.shiftOwnerPhone ?? shipment?.shiftOwner?.phone ?? "",
    notes: shipment?.notes ?? "",
    sentAt: formatDateInput(shipment?.sentAt),
    cargoMode: shipment?.cargoMode ?? AIR_CARGO_MODE,
    senderPhone: shipment?.senderPhone ?? "",
    commodity: shipment?.commodity ?? "",
    origin: shipment?.origin ?? "",
    destination: shipment?.destination ?? "",
    pieces: shipment?.pieces ?? 1,
    weightKg: shipment?.weightKg ?? 1,
    serviceType: shipment?.serviceType ?? "Standard",
    shippingRate: shipment?.shippingRate ?? 0,
    goodsStatus: shipment?.goodsStatus ?? "Diproses",
    transactionStatus: shipment?.transactionStatus ?? "Belum Lunas",
    vehicleName: shipment?.vehicleName ?? "",
    vehicleType: shipment?.vehicleType ?? AIR_VEHICLE_TYPE,
    vehicleCode: shipment?.vehicleCode ?? "",
    vehicleCapacityKg: shipment?.vehicleCapacityKg ?? 1,
    vehicleStatus: shipment?.vehicleStatus ?? "Aktif",
    flightId: shipment?.flightId || "",
    customerAccountId: shipment?.customerAccountId || "",
    docStatus: resolveShipmentDocStatusValue(shipment?.docStatus) as "Partial" | "Complete",
  };
}

function fieldClassName(base: string, error?: string) {
  return cn(base, error && "is-invalid");
}

function FormFieldError({ message }: { message?: string }) {
  return message ? <p className="form-field-error">{message}</p> : null;
}



type CommodityRow = { id: string; code: string; name: string; category: string };

function resolveCommoditySelectValue(commodity: string, masterNames: string[]) {
  if (!commodity) return "";
  return masterNames.includes(commodity) ? commodity : COMMODITY_CUSTOM_VALUE;
}

function buildFlightSelectOptions(flights: FlightOption[]): GlassSelectOption[] {
  return [
    {
      value: "",
      label: FLIGHT_AUTO_SELECT_LABEL,
      shortLabel: FLIGHT_AUTO_SELECT_SHORT_LABEL,
    },
    ...flights.map((item) => {
      const labels = formatFlightSelectLabels(item);
      return { value: item.id, ...labels };
    }),
  ];
}

function CommodityField({
  label,
  commodities,
  value,
  error,
  onChange,
  placeholder,
}: {
  label: string;
  commodities: CommodityRow[];
  value: string;
  error?: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  const masterNames = useMemo(() => commodities.map((item) => item.name), [commodities]);
  const selectValue = resolveCommoditySelectValue(value, masterNames);
  const isCustom = selectValue === COMMODITY_CUSTOM_VALUE;
  const options = useMemo(
    () => [
      ...commodities.map((item) => ({ value: item.name, label: item.name })),
      { value: COMMODITY_CUSTOM_VALUE, label: "Lainnya (ketik manual)" },
    ],
    [commodities],
  );

  return (
    <div data-field="commodity">
      <label className="label">{label}</label>
      <GlassSelect
        aria-label={label}
        value={selectValue}
        onChange={(next) => {
          if (next === COMMODITY_CUSTOM_VALUE) {
            onChange(value && !masterNames.includes(value) ? value : "");
            return;
          }
          onChange(next);
        }}
        options={options}
        className={fieldClassName("select-field", error)}
        placeholder="Pilih komoditas"
      />
      {isCustom ? (
        <input
          className={cn(fieldClassName("input-field mt-2", error))}
          placeholder={placeholder ?? "Contoh: Dokumen penting"}
          value={value}
          onChange={(event) => onChange(sanitizeCommodityText(event.target.value))}
        />
      ) : null}
      <FormFieldError message={error} />
    </div>
  );
}
function computeDraftShippingRate(
  draft: { serviceType: string; weightKg: number; origin: string; destination: string },
  flight?: { aircraftType: string } | null,
) {
  return computeShippingRate({
    serviceType: draft.serviceType,
    weightKg: Number(draft.weightKg) || 0,
    origin: draft.origin,
    destination: draft.destination,
    aircraftType: flight?.aircraftType ?? null,
  });
}

function createBlankForm(station = "SOQ") {
  const origin = station.toUpperCase() as StationCode;
  const destination = defaultDestinationForOrigin(origin) as StationCode;
  const weightKg = 1;
  const serviceType = "Standard";
  return {
    awb: "",
    sentAt: formatDateInput(),
    commodity: "",
    cargoMode: AIR_CARGO_MODE,
    senderPhone: "",
    origin,
    destination,
    pieces: 1,
    weightKg,
    volumeM3: 0.5,
    specialHandling: "",
    serviceType,
    shippingRate: computeDraftShippingRate({ serviceType, weightKg, origin, destination }),
    vehicleName: "SkyHub 01",
    vehicleType: AIR_VEHICLE_TYPE,
    vehicleCode: "PK-SHA",
    vehicleCapacityKg: 1000,
    vehicleStatus: "Aktif",
    shipper: "",
    consignee: "",
    forwarder: "SkyHub",
    shiftOwnerId: "",
    shiftOwnerPhone: "",
    flightId: "",
    customerAccountId: "",
    notes: "",
    docStatus: "Partial" as "Partial" | "Complete",
  };
}

function getDraftTransactionStatus(shippingRate: number) {
  return shippingRate <= 0 ? "Tidak Ditagih" : "Belum Lunas";
}



function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs, value]);

  return debouncedValue;
}

function normalizeDigits(value: string) {
  return value.replace(/\D/g, "");
}

function matchesOperationalQuery(values: Array<string | number | null | undefined>, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  const joinedValue = values
    .filter((value) => value !== null && value !== undefined)
    .join(" ")
    .toLowerCase();

  if (joinedValue.includes(normalizedQuery)) {
    return true;
  }

  const numericQuery = normalizeDigits(normalizedQuery);
  if (!numericQuery) {
    return false;
  }

  return values.some((value) => normalizeDigits(String(value ?? "")).includes(numericQuery));
}

function selectRecommendedFlight(flights: FlightOption[], draft: {
  origin: string;
  destination: string;
  weightKg: number;
  flightId?: string;
}) {
  const normalizedOrigin = draft.origin.toUpperCase();
  const normalizedDestination = draft.destination.toUpperCase();
  const weightKg = Number(draft.weightKg) || 0;
  const now = Date.now();
  const currentSelected = flights.find((flight) => flight.id === draft.flightId) ?? null;

  const matchingFlights = flights
    .filter((flight) => {
      if (flight.origin !== normalizedOrigin || flight.destination !== normalizedDestination) {
        return false;
      }

      if (new Date(flight.cargoCutoffTime).getTime() <= now) {
        return false;
      }

      return flight.availableCapacityKg >= weightKg;
    })
    .sort((left, right) => {
      if (left.availableCapacityKg !== right.availableCapacityKg) {
        return left.availableCapacityKg - right.availableCapacityKg;
      }

      return new Date(left.departureTime).getTime() - new Date(right.departureTime).getTime();
    });

  return currentSelected && matchingFlights.some((flight) => flight.id === currentSelected.id)
    ? currentSelected
    : matchingFlights[0] ?? currentSelected;
}

function formatIsoSecond(value: string) {
  return new Date(value).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function getManifestStatus(shipment: ShipmentRow) {
  if (shipment.status === "arrived") return { value: "arrived", label: "Tiba" };
  if (shipment.status === "departed" || shipment.status === "loaded_to_aircraft") {
    return { value: "in_transit", label: "Berangkat" };
  }
  if (shipment.status === "hold") return { value: "on_hold", label: "Tertahan" };
  return { value: shipment.status, label: shipment.statusLabel };
}

function SortHeader({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = active ? ArrowDown : ArrowUpDown;

  return (
    <button type="button" className={cn("ledger-sort-header", active && "ledger-sort-header-active")} onClick={onClick}>
      <span>{label}</span>
      <Icon size={14} />
    </button>
  );
}

const LedgerManifestRow = memo(function LedgerManifestRow({
  shipment,
  selected,
  onSelect,
  onEdit,
  onDelete,
  canEdit,
  canDelete,
}: {
  shipment: ShipmentRow;
  selected: boolean;
  onSelect: (shipmentId: string) => void;
  onEdit: (shipmentId: string) => void;
  onDelete: (shipmentId: string) => void;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const status = getManifestStatus(shipment);

  return (
    <tr
      className={cn("ledger-manifest-table-row cursor-pointer", selected && "ledger-manifest-table-row-active")}
      onClick={() => onSelect(shipment.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(shipment.id);
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`Buka detail AWB ${shipment.awb}`}
    >
      <td>
        <span className="font-mono text-sm font-semibold text-[color:var(--brand-primary)]">{shipment.awb}</span>
      </td>
      <td>
        <StatusBadge value={status.value} label={status.label} />
      </td>
      <td className="text-right">
        <time
          className="text-xs font-mono font-semibold tracking-tight text-[color:var(--muted-fg)]"
          dateTime={formatIsoSecond(shipment.updatedAt)}
        >
          {formatDateTime(shipment.updatedAt)}
        </time>
      </td>
    </tr>
  );
});

export default function ShipmentLedgerPage() {
  const { showAlert, showToast } = useOpsAlert();
  const searchParams = useSearchParams();
  const [data, setData] = useState<LedgerPayload | null>(null);
  const [query, setQuery] = useState(searchParams.get("query") || "");
  const [status, setStatus] = useState(searchParams.get("status") || "all");
  const [flight, setFlight] = useState(searchParams.get("flight") || "all");
  const [sortBy, setSortBy] = useState(searchParams.get("sortBy") || "updated");
  const todayIso = useMemo(() => getOpsTodayIso(), []);
  const [dateFrom, setDateFrom] = useState(searchParams.get("dateFrom") || "");
  const [dateTo, setDateTo] = useState(() => clampIsoDateToToday(searchParams.get("dateTo") || ""));
  const [dateToError, setDateToError] = useState<string | undefined>();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const detailOpenRef = useRef(detailOpen);
  detailOpenRef.current = detailOpen;
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [pinnedShipment, setPinnedShipment] = useState<ShipmentRow | null>(null);
  const [confirmShipmentDelete, setConfirmShipmentDelete] = useState(false);

  const [form, setForm] = useState(() => createBlankForm());
  const [drawerDraft, setDrawerDraft] = useState(() => createDrawerDraft(null));
  const [createErrors, setCreateErrors] = useState<ShipmentCreateFormErrors>({});
  const [drawerErrors, setDrawerErrors] = useState<ShipmentUpdateFormErrors>({});
  const [shiftPicCandidates, setShiftPicCandidates] = useState<ShiftPicCandidate[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const hasLoadedRef = useRef(false);
  const splitPaneRef = useRef<HTMLDivElement | null>(null);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const tableRef = useRef<HTMLTableElement | null>(null);
  const pendingDetailQueryRef = useRef<string | null>(null);

  const debouncedQuery = useDebouncedValue(query, 300);

  useEffect(() => {
    function handleContextSearch(event: Event) {
      const detail = (event as CustomEvent<{ pathname?: string; query?: string; focusDetail?: boolean }>).detail;
      if (detail?.pathname !== "/shipment-ledger" || !detail.query) return;
      setQuery(detail.query);

      if (detail.focusDetail) {
        pendingDetailQueryRef.current = detail.query;
        window.setTimeout(() => {
          splitPaneRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 120);
      }
    }

    window.addEventListener("skyhub:context-search", handleContextSearch as EventListener);
    return () => window.removeEventListener("skyhub:context-search", handleContextSearch as EventListener);
  }, []);

  const applyShipmentPayload = useCallback((payload: LedgerPayload, preferredShipmentId?: string | null) => {
    const resolvedPreferredShipmentId = preferredShipmentId ?? null;
    const nextSelectedShipment = payload.shipments.find((shipment) => shipment.id === resolvedPreferredShipmentId) ?? null;

    startTransition(() => {
      setData(payload);
      setSelectedId(nextSelectedShipment?.id ?? null);
      setDrawerDraft(createDrawerDraft(nextSelectedShipment));
    });
  }, []);

  const ledgerPageSize = useVisibleTablePageSize(
    tableScrollRef,
    tableRef,
    Boolean(data?.shipments.length) && !loading,
    data?.shipments.length ?? 0,
    { fallback: 3, min: 1, max: 12 },
  );
  const ledgerPageRef = useRef(ledgerPage);
  ledgerPageRef.current = ledgerPage;
  const ledgerPageSizeRef = useRef(ledgerPageSize);
  ledgerPageSizeRef.current = ledgerPageSize;

  const requestShipments = useCallback(async (page = ledgerPageRef.current, pageSize = ledgerPageSizeRef.current) => {
    const params = new URLSearchParams();
    if (debouncedQuery.trim()) params.set("query", debouncedQuery.trim());
    if (status !== "all") params.set("status", status);
    if (flight !== "all") params.set("flight", flight);
    if (sortBy) params.set("sortBy", sortBy);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));

    try {
      const response = await fetch(`/api/shipments?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) {
        setListError(await readApiError(response, "Buku pengiriman belum bisa dimuat."));
        return null;
      }

      setListError(null);
      return (await response.json()) as LedgerPayload;
    } catch {
      setListError(networkErrorMessage("memuat buku pengiriman"));
      return null;
    }
  }, [dateFrom, dateTo, debouncedQuery, flight, sortBy, status]);

  const refreshPinnedShipment = useCallback(async (shipmentId: string) => {
    try {
      const response = await fetch(`/api/shipments/${shipmentId}`, { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as { shipment?: ShipmentRow };
      if (payload.shipment) {
        setPinnedShipment(payload.shipment);
      }
    } catch {
      // keep last pinned snapshot when background refresh fails
    }
  }, []);

  const loadShipments = useCallback(
    async (
      preferredShipmentId: string | null = selectedIdRef.current,
      mode: "initial" | "refresh" = "refresh",
      page = ledgerPage,
    ) => {
      if (mode === "initial") {
        setLoading(true);
      }

      const payload = await requestShipments(page);
      if (payload) {
        applyShipmentPayload(payload, preferredShipmentId);
        const matched = preferredShipmentId
          ? payload.shipments.find((shipment) => shipment.id === preferredShipmentId) ?? null
          : null;
        if (matched) {
          setPinnedShipment(matched);
        } else if (preferredShipmentId && detailOpenRef.current) {
          void refreshPinnedShipment(preferredShipmentId);
        }
      }

      setLoading(false);
    },
    [applyShipmentPayload, ledgerPage, refreshPinnedShipment, requestShipments],
  );

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    const mode = hasLoadedRef.current ? "refresh" : "initial";
    void loadShipments(selectedIdRef.current, mode, ledgerPage).finally(() => {
      hasLoadedRef.current = true;
    });
  }, [ledgerPage, loadShipments]);

  const resolvedLedgerPageSizeRef = useRef(ledgerPageSize);
  useEffect(() => {
    if (!hasLoadedRef.current || loading) return;
    if (resolvedLedgerPageSizeRef.current === ledgerPageSize) return;
    resolvedLedgerPageSizeRef.current = ledgerPageSize;
    setLedgerPage(1);
    void loadShipments(selectedIdRef.current, "refresh", 1);
  }, [ledgerPageSize, loadShipments, loading]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible" || createOpen || editOpen || detailOpen || saving) return;
      void loadShipments(selectedIdRef.current, "refresh", ledgerPage);
    }, 20000);

    return () => window.clearInterval(timer);
  }, [createOpen, detailOpen, editOpen, ledgerPage, loadShipments, saving]);

  const selectedShipment = useMemo(() => {
    if (!selectedId) return null;
    return data?.shipments.find((shipment) => shipment.id === selectedId) ?? pinnedShipment;
  }, [data, pinnedShipment, selectedId]);

  const handleSelectShipment = useCallback(
    (shipmentId: string) => {
      const nextShipment = (data?.shipments ?? []).find((shipment) => shipment.id === shipmentId) ?? null;
      setSelectedId(shipmentId);
      setPinnedShipment(nextShipment);
      setDrawerDraft(createDrawerDraft(nextShipment));
      setEditOpen(false);
      setDetailOpen(true);
    },
    [data?.shipments],
  );

  const closeDetailShipment = useCallback(() => {
    setDetailOpen(false);
    setSelectedId(null);
    setPinnedShipment(null);
  }, []);

  const exportParams = useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedQuery.trim()) params.set("query", debouncedQuery.trim());
    if (status !== "all") params.set("status", status);
    if (flight !== "all") params.set("flight", flight);
    if (sortBy) params.set("sortBy", sortBy);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    return params;
  }, [dateFrom, dateTo, debouncedQuery, flight, sortBy, status]);

  const isReadOnly = data?.viewer.readOnly ?? false;
  const viewer = data?.viewer;
  const viewerStation = (viewer?.station ?? "SOQ").toUpperCase();
  const viewerActorLabel = viewer ? formatActorLabel(viewer) : "";

  useEffect(() => {
    if (!createOpen && !editOpen) return;

    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/users/shift-pic", { cache: "no-store" });
        if (!response.ok || cancelled) return;
        const payload = (await response.json()) as { candidates?: ShiftPicCandidate[] };
        if (!cancelled) {
          setShiftPicCandidates(payload.candidates ?? []);
        }
      } catch {
        if (!cancelled) {
          setShiftPicCandidates([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [createOpen, editOpen]);

  const shiftPicOptions = useMemo(
    () => shiftPicCandidates.map((candidate) => ({ value: candidate.id, label: candidate.label })),
    [shiftPicCandidates],
  );

  const selectedCreateShiftPic = useMemo(
    () => shiftPicCandidates.find((candidate) => candidate.id === form.shiftOwnerId),
    [form.shiftOwnerId, shiftPicCandidates],
  );
  const selectedEditShiftPic = useMemo(
    () => shiftPicCandidates.find((candidate) => candidate.id === drawerDraft.shiftOwnerId),
    [drawerDraft.shiftOwnerId, shiftPicCandidates],
  );
  const createShiftPicHasProfilePhone = Boolean(selectedCreateShiftPic?.phone?.trim());
  const editShiftPicHasProfilePhone = Boolean(selectedEditShiftPic?.phone?.trim());

  useEffect(() => {
    if (!createOpen || !shiftPicCandidates.length || !form.shiftOwnerId) return;
    const candidate = shiftPicCandidates.find((item) => item.id === form.shiftOwnerId);
    if (!candidate) return;
    const profilePhone = resolveShiftPicPhone(candidate, "");
    if (profilePhone && profilePhone !== form.shiftOwnerPhone) {
      setForm((current) => ({ ...current, shiftOwnerPhone: profilePhone }));
    }
  }, [createOpen, form.shiftOwnerId, form.shiftOwnerPhone, shiftPicCandidates]);

  useEffect(() => {
    if (!editOpen || !shiftPicCandidates.length || !drawerDraft.shiftOwnerId) return;
    const candidate = shiftPicCandidates.find((item) => item.id === drawerDraft.shiftOwnerId);
    if (!candidate) return;
    const profilePhone = resolveShiftPicPhone(candidate, "");
    if (profilePhone && profilePhone !== drawerDraft.shiftOwnerPhone) {
      setDrawerDraft((current) => ({ ...current, shiftOwnerPhone: profilePhone }));
    }
  }, [drawerDraft.shiftOwnerId, drawerDraft.shiftOwnerPhone, editOpen, shiftPicCandidates]);
  const createDestinationOptions = useMemo(
    () => destinationSelectOptions(viewerStation),
    [viewerStation],
  );
  const editDestinationOptions = useMemo(
    () => destinationSelectOptions(drawerDraft.origin || viewerStation),
    [drawerDraft.origin, viewerStation],
  );

  const availableFlights = useMemo(() => data?.flights ?? [], [data?.flights]);
  const recommendedCreateFlight = useMemo(
    () => selectRecommendedFlight(availableFlights, form),
    [availableFlights, form],
  );
  const recommendedEditFlight = useMemo(
    () => selectRecommendedFlight(availableFlights, drawerDraft),
    [availableFlights, drawerDraft],
  );
  const activeCreateFlight = useMemo(
    () => availableFlights.find((item) => item.id === form.flightId) ?? recommendedCreateFlight,
    [availableFlights, form.flightId, recommendedCreateFlight],
  );
  const activeEditFlight = useMemo(
    () => availableFlights.find((item) => item.id === drawerDraft.flightId) ?? recommendedEditFlight,
    [availableFlights, drawerDraft.flightId, recommendedEditFlight],
  );

  useEffect(() => {
    if (!createOpen) return;
    setForm((current) => {
      const shippingRate = computeDraftShippingRate({ ...current, origin: viewerStation }, activeCreateFlight);
      if (current.origin === viewerStation && current.shippingRate === shippingRate) {
        return current;
      }
      return { ...current, origin: viewerStation as StationCode, shippingRate };
    });
  }, [activeCreateFlight, createOpen, viewerStation]);

  useEffect(() => {
    if (!editOpen) return;
    setDrawerDraft((current) => {
      const shippingRate = computeDraftShippingRate(current, activeEditFlight);
      if (current.shippingRate === shippingRate) {
        return current;
      }
      return { ...current, shippingRate };
    });
  }, [activeEditFlight, editOpen]);

  const hasFlightChoices = availableFlights.length > 0;
  const flightSelectOptions = useMemo(() => buildFlightSelectOptions(availableFlights), [availableFlights]);
  const commodityOptions = useMemo(() => data?.commodities ?? [], [data?.commodities]);
  const shipments = useMemo(() => data?.shipments ?? [], [data?.shipments]);
  const ledgerPagination = data?.pagination ?? {
    page: ledgerPage,
    pageSize: ledgerPageSize,
    totalItems: shipments.length,
    totalPages: 1,
  };
  const ledgerPageWindow = useMemo(() => {
    const start = (ledgerPagination.page - 1) * ledgerPagination.pageSize;
    const end = Math.min(start + shipments.length, ledgerPagination.totalItems);
    return {
      currentPage: ledgerPagination.page,
      totalPages: ledgerPagination.totalPages,
      visibleStart: ledgerPagination.totalItems ? start + 1 : 0,
      visibleEnd: end,
      items: shipments,
    };
  }, [ledgerPagination, shipments]);
  useEffect(() => {
    setLedgerPage(1);
  }, [debouncedQuery, status, flight, sortBy, dateFrom, dateTo]);

  useEffect(() => {
    const pendingQuery = pendingDetailQueryRef.current?.trim().toLowerCase();
    if (!pendingQuery || !shipments.length) return;

    const matchedShipment =
      shipments.find((shipment) => shipment.awb.toLowerCase() === pendingQuery) ??
      shipments.find((shipment) =>
        matchesOperationalQuery(
          [shipment.awb, shipment.commodity, shipment.shipper, shipment.consignee, shipment.customerAccountName, shipment.flightNumber],
          pendingQuery,
        ),
      );

    if (!matchedShipment) return;

    pendingDetailQueryRef.current = null;
    const matchedIndex = shipments.findIndex((shipment) => shipment.id === matchedShipment.id);
    if (matchedIndex >= 0) {
    }
    handleSelectShipment(matchedShipment.id);
  }, [handleSelectShipment, shipments]);


  function clearCreateFieldError(field: keyof ShipmentCreateFormErrors) {
    setCreateErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function clearDrawerFieldError(field: keyof ShipmentUpdateFormErrors) {
    setDrawerErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function submitCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validation = validateShipmentCreateFormDetailed(
      {
        ...form,
        awb: "",
        pieces: 1,
        cargoMode: AIR_CARGO_MODE,
        vehicleType: AIR_VEHICLE_TYPE,
      },
      {
        flights: availableFlights,
        activeFlight: activeCreateFlight,
      },
    );
    if (!validation.ok) {
      setCreateErrors(validation.errors);
      scrollToFirstFieldError(validation.errors);
      return;
    }
    setCreateErrors({});
    setSaving(true);
    try {
    const response = await fetch("/api/shipments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        buildShipmentSubmitPayload(form, {
          activeFlight: activeCreateFlight
            ? {
                vehicleName: activeCreateFlight.vehicleName,
                vehicleCode: activeCreateFlight.vehicleCode,
                vehicleCapacityKg: activeCreateFlight.vehicleCapacityKg,
                vehicleStatus: activeCreateFlight.vehicleStatus,
                aircraftType: activeCreateFlight.aircraftType,
              }
            : null,
        }),
      ),
    });

    if (response.ok) {
      const payload = (await response.json()) as { shipment?: ShipmentRow | null };
      setCreateOpen(false);
      setForm({
        ...createBlankForm(viewerStation),
        shiftOwnerId: viewer?.id ?? "",
        shiftOwnerPhone: viewer?.phone ?? "",
      });
      setCreateErrors({});
      if (payload.shipment) {
        setData((current) =>
          current
            ? {
                ...current,
                shipments: [payload.shipment!, ...current.shipments.filter((shipment) => shipment.id !== payload.shipment!.id)],
              }
            : current,
        );
        setSelectedId(payload.shipment.id);
        setDrawerDraft(createDrawerDraft(payload.shipment));
        setDetailOpen(true);
        openAwbReceiptPrint(payload.shipment.awb);
      }
      showToast({
        title: "Berhasil",
        description: payload.shipment
          ? `Pengiriman ${payload.shipment.awb} berhasil dibuat. Resi langsung dibuka untuk dicetak.`
          : "Pengiriman berhasil dibuat.",
      });
      void loadShipments(payload.shipment?.id ?? selectedId, "refresh");
    } else {
      
      showAlert({ title: "Gagal membuat pengiriman.", description: await readApiError(response, "Gagal membuat pengiriman."), tone: "error" });
    }
    } catch {
      showAlert({
        title: "Koneksi Terputus",
        description: networkErrorMessage("membuat pengiriman"),
        tone: "warning",
      });
    } finally {
      setSaving(false);
    }
  }

  async function saveShipmentChanges() {
    if (!selectedShipment) return;

    const validation = validateShipmentUpdateFormDetailed(
      {
        ...drawerDraft,
        pieces: 1,
        cargoMode: AIR_CARGO_MODE,
        vehicleType: AIR_VEHICLE_TYPE,
      },
      {
        flights: availableFlights,
        activeFlight: activeEditFlight,
      },
    );
    if (!validation.ok) {
      setDrawerErrors(validation.errors);
      scrollToFirstFieldError(validation.errors);
      return;
    }
    setDrawerErrors({});

    setSaving(true);
    try {
    const response = await fetch(`/api/shipments/${selectedShipment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        buildShipmentSubmitPayload(drawerDraft, {
          activeFlight: activeEditFlight
            ? {
                vehicleName: activeEditFlight.vehicleName,
                vehicleCode: activeEditFlight.vehicleCode,
                vehicleCapacityKg: activeEditFlight.vehicleCapacityKg,
                vehicleStatus: activeEditFlight.vehicleStatus,
                aircraftType: activeEditFlight.aircraftType,
              }
            : null,
        }),
      ),
    });

    if (response.ok) {
      const payload = (await response.json()) as { shipment?: ShipmentRow | null };
      const previousFlightId = selectedShipment.flightId ?? "";
      const nextFlightId = payload.shipment?.flightId ?? "";
      const flightAssignmentUpdated =
        Boolean(payload.shipment?.awb) && Boolean(nextFlightId) && previousFlightId !== nextFlightId;

      if (payload.shipment) {
        setData((current) =>
          current
            ? {
                ...current,
                shipments: current.shipments.map((shipment) =>
                  shipment.id === payload.shipment!.id ? payload.shipment! : shipment,
                ),
              }
            : current,
        );
        setDrawerDraft(createDrawerDraft(payload.shipment));
      }
      setEditOpen(false);
      if (flightAssignmentUpdated && payload.shipment?.awb) {
        openAwbReceiptPrint(payload.shipment.awb);
      }
      showToast({
        title: "Berhasil",
        description: flightAssignmentUpdated
          ? `AWB ${payload.shipment?.awb} ditugaskan ke penerbangan. Resi dibuka untuk dicetak ke pelanggan.`
          : "Perubahan pengiriman berhasil disimpan.",
      });
      void loadShipments(selectedShipment.id, "refresh");
    } else {
      
      showAlert({ title: "Gagal menyimpan pengiriman.", description: await readApiError(response, "Gagal menyimpan pengiriman."), tone: "error" });
    }
    } catch {
      showAlert({
        title: "Koneksi Terputus",
        description: networkErrorMessage("menyimpan pengiriman"),
        tone: "warning",
      });
    } finally {
      setSaving(false);
    }
  }



  async function handleDeleteShipment() {
    if (!selectedShipment) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/shipments/${selectedShipment.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setData((current) =>
          current
            ? {
                ...current,
                shipments: current.shipments.filter((shipment) => shipment.id !== selectedShipment.id),
              }
            : current,
        );
        setSelectedId(null);
        setDetailOpen(false);
        setEditOpen(false);
        setConfirmShipmentDelete(false);
        showToast({ title: "Berhasil", description: `Pengiriman ${selectedShipment.awb} berhasil dihapus dari basis data.` });
        void loadShipments(null, "refresh");
      } else {
        showAlert({ title: "Gagal menghapus pengiriman.", description: await readApiError(response, "Gagal menghapus pengiriman."), tone: "error" });
      }
    } catch {
      showAlert({
        title: "Koneksi Terputus",
        description: networkErrorMessage("menghapus pengiriman"),
        tone: "warning",
      });
    } finally {
      setSaving(false);
    }
  }

  const handleEditShipment = useCallback(
    (shipmentId: string) => {
      const shipment = shipments.find((item) => item.id === shipmentId);
      if (!shipment) return;
      setSelectedId(shipmentId);
      setDrawerDraft(createDrawerDraft(shipment));
      setDrawerErrors({});
      setDetailOpen(false);
      setEditOpen(true);
    },
    [shipments],
  );

  const handleDeleteFromRow = useCallback((shipmentId: string) => {
    setSelectedId(shipmentId);
    setConfirmShipmentDelete(true);
  }, []);

  const handleDateFromChange = useCallback(
    (nextDateFrom: string) => {
      setDateFrom(nextDateFrom);
      if (dateTo) {
        const validation = validateFilterDateTo(dateTo, { dateFrom: nextDateFrom, todayIso });
        setDateToError(validation.ok ? undefined : validation.message);
      } else {
        setDateToError(undefined);
      }
    },
    [dateTo, todayIso],
  );

  const handleDateToChange = useCallback(
    (nextDateTo: string) => {
      const validation = validateFilterDateTo(nextDateTo, { dateFrom, todayIso });
      if (!validation.ok) {
        setDateToError(validation.message);
        return;
      }
      setDateToError(undefined);
      setDateTo(nextDateTo);
    },
    [dateFrom, todayIso],
  );

  const hasActiveFilters =
    Boolean(query.trim()) ||
    status !== "all" ||
    flight !== "all" ||
    sortBy !== "updated" ||
    Boolean(dateFrom) ||
    Boolean(dateTo);

  const pageActions = useMemo(() => {
    const canExport = !isReadOnly && data?.permissions.canExport;
    const canCreate = !isReadOnly && (loading || data?.permissions.canCreate);
    if (!canExport && !canCreate) {
      return null;
    }

    return (
      <div className="flex flex-wrap gap-2">
        {canExport ? (
          <Link
            href={`/exports/shipments?${exportParams.toString()}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
          >
            <FileText size={16} />
            Cetak Pengiriman
          </Link>
        ) : null}
        {canCreate ? (
          <button
            type="button"
            className="btn btn-primary"
            disabled={loading}
            title={loading ? "Memuat izin akses..." : "Buat pengiriman baru"}
            aria-label={loading ? "Memuat izin akses" : "Buat pengiriman baru"}
            onClick={() => {
              setCreateErrors({});
              setForm({
                ...createBlankForm(viewerStation),
                shiftOwnerId: viewer?.id ?? "",
                shiftOwnerPhone: viewer?.phone ?? "",
              });
              setCreateOpen(true);
            }}
          >
            <Plus size={16} />
            Buat Pengiriman
          </button>
        ) : null}
      </div>
    );
  }, [data?.permissions.canCreate, data?.permissions.canExport, exportParams, isReadOnly, loading]);

  const filterControls = useMemo(
    () => (
      <FilterBar ariaLabel="Pencarian dan filter Buku Pengiriman" stacked>
        <FilterSearch>
          <label className="label" htmlFor="ledger-query">
            Cari AWB
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[color:var(--muted-fg)]" />
            <input
              id="ledger-query"
              className="input-field input-field-leading"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nomor AWB, pengirim, penerima, atau komoditas"
            />
          </div>
        </FilterSearch>
        <FilterFields aria-label="Filter Buku Pengiriman">
          <div className="shell-filter-field">
            <label className="label" htmlFor="ledger-status">
              Status
            </label>
            <GlassSelect
              id="ledger-status"
              aria-label="Filter status pengiriman"
              value={status}
              onChange={setStatus}
              options={[
                { value: "all", label: "Semua Status" },
                { value: "hold", label: "Tertahan" },
                { value: "review", label: "Butuh Tinjauan" },
                { value: "received", label: "Diterima" },
                { value: "departed", label: "Berangkat" },
                { value: "arrived", label: "Tiba" },
              ]}
            />
          </div>
          <div className="shell-filter-field">
            <label className="label" htmlFor="ledger-flight">
              Penerbangan
            </label>
            <GlassSelect
              id="ledger-flight"
              aria-label="Filter penerbangan"
              value={flight}
              onChange={setFlight}
              options={[
                { value: "all", label: "Semua" },
                ...(data?.flights ?? []).map((item) => ({ value: item.flightNumber, label: item.flightNumber })),
              ]}
            />
          </div>
          <div className="shell-filter-field">
            <label className="label" htmlFor="ledger-sort">
              Urutkan
            </label>
            <GlassSelect
              id="ledger-sort"
              aria-label="Urutkan daftar pengiriman"
              value={sortBy}
              onChange={setSortBy}
              options={[
                { value: "updated", label: "Update Terbaru" },
                { value: "received", label: "Penerimaan Terbaru" },
                { value: "priority", label: "Prioritas Tinjauan" },
              ]}
            />
          </div>
          <div className="shell-filter-field shell-filter-field-wide">
            <label className="label" htmlFor="ledger-date-from">
              Tanggal Awal
            </label>
            <GlassDatePicker
              id="ledger-date-from"
              aria-label="Tanggal awal"
              value={dateFrom}
              onChange={handleDateFromChange}
            />
          </div>
          <div className="shell-filter-field shell-filter-field-wide">
            <label className="label" htmlFor="ledger-date-to">
              Tanggal Akhir
            </label>
            <GlassDatePicker
              id="ledger-date-to"
              aria-label="Tanggal akhir"
              min={dateFrom || undefined}
              max={todayIso}
              invalid={Boolean(dateToError)}
              value={dateTo}
              onRangeReject={() => setDateToError(DATE_TO_MAX_TODAY_MESSAGE)}
              onChange={handleDateToChange}
            />
            <FormFieldError message={dateToError} />
          </div>
          {hasActiveFilters ? (
            <div className="shell-filter-field ledger-filter-action-cell">
              <span className="label" aria-hidden="true">
                &nbsp;
              </span>
              <button
                type="button"
                className="btn btn-secondary h-[42px] w-full px-3 text-xs"
                onClick={() => {
                  setQuery("");
                  setStatus("all");
                  setFlight("all");
                  setSortBy("updated");
                  setDateFrom("");
                  setDateTo("");
                  setDateToError(undefined);
                }}
              >
                Reset filter
              </button>
            </div>
          ) : null}
        </FilterFields>
      </FilterBar>
    ),
    [
      data?.flights,
      dateFrom,
      dateTo,
      dateToError,
      flight,
      handleDateFromChange,
      handleDateToChange,
      hasActiveFilters,
      query,
      sortBy,
      status,
      todayIso,
    ],
  );

  return (
    <CrudPageScaffold
      as="main"
      className="ledger-viewport gap-[10px]"
      aria-labelledby="shipment-ledger-title"
      eyebrow={isReadOnly ? "Portal Pelanggan" : "Manifest Kargo"}
      title={isReadOnly ? "Pengiriman Saya" : "Buku Pengiriman"}
      filters={filterControls}
      body={
      <>
      <div ref={splitPaneRef} className="min-h-0 flex-1 overflow-hidden">
        <OpsPanel className="page-pane flex min-h-0 flex-col overflow-hidden p-0">
          <div className="border-b border-[color:var(--border-soft)] p-5">
            <SectionHeader
              title={`Daftar AWB${ledgerPagination.totalItems ? ` (${ledgerPagination.totalItems})` : ""}`}
              action={pageActions}
              className="panel-section-header shrink-0 border-b-0 pb-0"
            />
          </div>

          <OpsListErrorBanner
            message={listError}
            onRetry={() => void loadShipments(selectedIdRef.current, "refresh")}
            onDismiss={() => setListError(null)}
          />
          <div className="ledger-manifest-body">
          {loading ? (
            <div className="min-h-0 flex-1 space-y-3 p-4">
              <SkeletonBlock className="h-6 w-48" />
              {Array.from({ length: 6 }).map((_, index) => (
                <SkeletonBlock key={index} className="h-10 w-full rounded-[12px]" />
              ))}
            </div>
          ) : shipments.length ? (
            <>
              <div ref={tableScrollRef} className="ledger-manifest-scroll internal-scrollbar table-shell" role="region" aria-label="Daftar manifest pengiriman" tabIndex={0}>
                <div className="ledger-manifest-table-wrap">
                  <table ref={tableRef} className="ledger-manifest-table">
                    <thead>
                      <tr>
                        <th scope="col">AWB</th>
                        <th scope="col">Status</th>
                        <th scope="col">
                          <SortHeader label="Diperbarui" active={sortBy === "updated"} onClick={() => setSortBy("updated")} />
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledgerPageWindow.items.map((shipment) => (
                        <LedgerManifestRow
                          key={shipment.id}
                          shipment={shipment}
                          selected={detailOpen && selectedShipment?.id === shipment.id}
                          onSelect={handleSelectShipment}
                          onEdit={handleEditShipment}
                          onDelete={handleDeleteFromRow}
                          canEdit={Boolean(data?.permissions.canEdit)}
                          canDelete={Boolean(data?.permissions.canDelete)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="ledger-manifest-pagination">
                <PaginationBar
                  page={ledgerPageWindow.currentPage}
                  totalPages={ledgerPageWindow.totalPages}
                  visibleStart={ledgerPageWindow.visibleStart}
                  visibleEnd={ledgerPageWindow.visibleEnd}
                  totalItems={ledgerPagination.totalItems}
                  onPageChange={(nextPage) => setLedgerPage(nextPage)}
                  label="Manifest"
                />
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-4">
              <EmptyState
                icon={Inbox}
                variant="filtered"
                title="Tidak ada pengiriman ditemukan"
              />
            </div>
          )}
          </div>
        </OpsPanel>

        {selectedShipment ? (
          <OpsDrawer
            open={detailOpen}
            eyebrow="Pengiriman Terpilih"
            title={`Detail ${selectedShipment.awb}`}
            onClose={closeDetailShipment}
            className="ledger-detail-modal"
            footer={
              <div className="flex w-full flex-wrap items-center justify-between gap-3">
                <button type="button" className="btn btn-secondary" onClick={closeDetailShipment}>
                  Tutup
                </button>
                <div className="flex flex-wrap justify-end gap-3">
                  {!isReadOnly && selectedShipment.awb ? (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => openAwbReceiptPrint(selectedShipment.awb)}
                    >
                      <FileText size={16} />
                      Cetak Resi AWB
                    </button>
                  ) : null}
                  {data?.permissions.canEdit ? (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => {
                        setDrawerDraft(createDrawerDraft(selectedShipment));
                        setDrawerErrors({});
                        setEditOpen(true);
                      }}
                    >
                      <Pencil size={16} />
                      Ubah
                    </button>
                  ) : null}
                  {data?.permissions.canDelete ? (
                    <button type="button" className="btn btn-danger" onClick={() => setConfirmShipmentDelete(true)}>
                      <Trash2 size={16} />
                      Hapus
                    </button>
                  ) : null}
                </div>
              </div>
            }
          >
            <div className="ledger-detail-scroll space-y-5">
              <div className="rounded-[26px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-[family:var(--font-heading)] text-[2rem] font-black tracking-[-0.05em] text-[color:var(--brand-primary)]">{selectedShipment.awb}</h2>
                    <p className="mt-2 text-sm text-[color:var(--muted-fg)]">
                      {selectedShipment.commodity} • {selectedShipment.origin} → {selectedShipment.destination}
                    </p>
                  </div>
                  <StatusBadge value={selectedShipment.status} label={selectedShipment.statusLabel} className="shrink-0" />
                </div>
              </div>

              <div className="ledger-detail-summary">
                <div>
                  <span>Penerbangan</span>
                  <strong>{selectedShipment.flightNumber || "Belum ditugaskan"}</strong>
                  <small>{formatDateTime(selectedShipment.sentAt)}</small>
                </div>
                <div>
                  <span>Pengirim</span>
                  <strong>{selectedShipment.customerAccountName || selectedShipment.shipper}</strong>
                  <small>{selectedShipment.senderPhone}</small>
                </div>
                <div>
                  <span>Penerima</span>
                  <strong>{selectedShipment.consignee}</strong>
                  <small>{selectedShipment.destination}</small>
                </div>
                <div>
                  <span>Dokumen</span>
                  <strong>{selectedShipment.docStatus}</strong>
                </div>
                <div>
                  <span>Muatan</span>
                  <strong>{formatWeight(selectedShipment.weightKg)}</strong>
                  <small>{selectedShipment.pieces} koli • {selectedShipment.serviceType}</small>
                </div>
                <div>
                  <span>Kesiapan</span>
                  <strong>{selectedShipment.readiness}</strong>
                  <small>{selectedShipment.goodsStatus} • {selectedShipment.transactionStatus}</small>
                </div>
              </div>

              <dl className="ledger-detail-lines rounded-[20px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-4">
                <div>
                  <dt>Dibuat oleh</dt>
                  <dd>
                    {selectedShipment.createdBy
                      ? formatActorLabel(selectedShipment.createdBy)
                      : "-"}
                  </dd>
                </div>
                <div>
                  <dt>Penanggung jawab shift</dt>
                  <dd>
                    {selectedShipment.shiftOwner
                      ? formatActorLabel(selectedShipment.shiftOwner)
                      : selectedShipment.ownerName || "-"}
                  </dd>
                </div>
                <div>
                  <dt>No telepon PIC</dt>
                  <dd>{selectedShipment.shiftOwnerPhone || selectedShipment.shiftOwner?.phone || "-"}</dd>
                </div>
                <div><dt>Tarif</dt><dd>Rp {selectedShipment.shippingRate.toLocaleString("id-ID")}</dd></div>
                <div><dt>Kendaraan</dt><dd>{selectedShipment.vehicleName || selectedShipment.vehicleType}</dd></div>
                {selectedShipment.notes ? (
                  <div><dt>Catatan</dt><dd>{selectedShipment.notes}</dd></div>
                ) : null}
              </dl>
            </div>
          </OpsDrawer>
        ) : null}
      </div>

      <OpsDrawer
        open={editOpen && Boolean(selectedShipment)}
        eyebrow="Ubah Pengiriman"
        title={selectedShipment ? `Perbarui ${selectedShipment.awb}` : "Ubah Pengiriman"}
        onClose={() => setEditOpen(false)}
        footer={
          selectedShipment ? (
            <div className="flex w-full justify-end gap-3">
              <button type="button" className="btn btn-secondary" onClick={() => setEditOpen(false)}>
                Batal
              </button>
              <button type="button" className="btn btn-primary" onClick={saveShipmentChanges} disabled={saving}>
                <Save size={16} />
                {saving ? "Menyimpan..." : "Simpan Perubahan"}
              </button>
            </div>
          ) : null
        }
      >
        {selectedShipment ? (
                            <div className="space-y-5">
                              <div className="ledger-form-grid">
                                <div>
                                  <label className="label">AWB</label>
                                  <input className="input-field input-readonly" value={selectedShipment.awb} readOnly disabled />
                                </div>
                        <div>
                          <label className="label">Status</label>
                          <GlassSelect
                            aria-label="Status pengiriman"
                            value={drawerDraft.status}
                            onChange={(value) =>
                              setDrawerDraft((current) => ({ ...current, status: value }))
                            }
                            options={[
                              { value: "received", label: "Diterima" },
                              { value: "sortation", label: "Sortasi" },
                              { value: "loaded_to_aircraft", label: "Muat ke Pesawat" },
                              { value: "departed", label: "Berangkat" },
                              { value: "arrived", label: "Tiba" },
                              { value: "hold", label: "Tertahan" },
                            ]}
                            className="select-field"
                          />
                        </div>
                        <div>
                          <label className="label">Dibuat Oleh</label>
                          <input
                            className="input-field input-readonly"
                            value={
                              selectedShipment.createdBy
                                ? formatActorLabel(selectedShipment.createdBy)
                                : "-"
                            }
                            readOnly
                            disabled
                          />
                        </div>
                        <div data-field="shiftOwnerId">
                          <label className="label">Penanggung Jawab Shift</label>
                          <GlassSelect
                            aria-label="Penanggung jawab shift"
                            value={drawerDraft.shiftOwnerId}
                            onChange={(value) => {
                              clearDrawerFieldError("shiftOwnerId");
                              const nextCandidate = shiftPicCandidates.find((candidate) => candidate.id === value);
                              setDrawerDraft((current) => ({
                                ...current,
                                shiftOwnerId: value,
                                shiftOwnerPhone: resolveShiftPicPhone(nextCandidate, ""),
                              }));
                            }}
                            options={shiftPicOptions}
                            className={fieldClassName("select-field", drawerErrors.shiftOwnerId)}
                            placeholder="Pilih penanggung jawab shift"
                          />
                          <FormFieldError message={drawerErrors.shiftOwnerId} />
                        </div>
                        <div data-field="shiftOwnerPhone">
                          <label className="label">No Telepon PIC</label>
                          <input
                            className={cn(
                              fieldClassName("input-field", drawerErrors.shiftOwnerPhone),
                              editShiftPicHasProfilePhone && "input-readonly",
                            )}
                            type="tel"
                            inputMode="tel"
                            autoComplete="tel"
                            placeholder="Contoh: 08123456789"
                            value={drawerDraft.shiftOwnerPhone}
                            readOnly={editShiftPicHasProfilePhone}
                            disabled={editShiftPicHasProfilePhone}
                            onChange={(event) => {
                              if (editShiftPicHasProfilePhone) return;
                              clearDrawerFieldError("shiftOwnerPhone");
                              setDrawerDraft((current) => ({
                                ...current,
                                shiftOwnerPhone: sanitizePhoneInput(event.target.value),
                              }));
                            }}
                          />
                          {!editShiftPicHasProfilePhone ? (
                            <p className="mt-1 text-xs text-[color:var(--muted-fg)]">
                              Nomor belum ada di profil PIC. Isi manual untuk kebutuhan koordinasi shift.
                            </p>
                          ) : null}
                          <FormFieldError message={drawerErrors.shiftOwnerPhone} />
                        </div>
                        <div data-field="sentAt">
                          <label className="label">Tanggal Kirim</label>
                          <GlassDatePicker
                            className={fieldClassName("input-field", drawerErrors.sentAt)}
                            aria-label="Tanggal kirim"
                            value={drawerDraft.sentAt}
                            onChange={(nextValue) => {
                              clearDrawerFieldError("sentAt");
                              setDrawerDraft((current) => ({ ...current, sentAt: nextValue }));
                            }}
                          />
                          <FormFieldError message={drawerErrors.sentAt} />
                        </div>
                        <div data-field="cargoMode">
                          <label className="label">Mode Cargo</label>
                          <input className="input-field input-readonly" value="Kargo Udara" readOnly disabled />
                        </div>
                        <div data-field="senderPhone">
                          <label className="label">No Telepon Pengirim</label>
                          <input
                            className={fieldClassName("input-field", drawerErrors.senderPhone)}
                            type="tel"
                            inputMode="tel"
                            autoComplete="tel"
                            placeholder="Contoh: 08123456789"
                            value={drawerDraft.senderPhone}
                            onChange={(event) => {
                              clearDrawerFieldError("senderPhone");
                              setDrawerDraft((current) => ({
                                ...current,
                                senderPhone: sanitizePhoneInput(event.target.value),
                              }));
                            }}
                          />
                          <FormFieldError message={drawerErrors.senderPhone} />
                        </div>
                        <CommodityField
                          label="Komoditas"
                          commodities={commodityOptions}
                          value={drawerDraft.commodity}
                          error={drawerErrors.commodity}
                          onChange={(next) => {
                            clearDrawerFieldError("commodity");
                            setDrawerDraft((current) => ({ ...current, commodity: next }));
                          }}
                        />
                        <div data-field="origin">
                          <label className="label">Bandara Asal</label>
                          <input
                            className="input-field input-readonly"
                            value={formatStationLabel(drawerDraft.origin)}
                            readOnly
                            aria-label="Bandara asal"
                          />
                          <FormFieldError message={drawerErrors.origin} />
                        </div>
                        <div data-field="destination">
                          <label className="label">Bandara Tujuan</label>
                          <GlassSelect
                            aria-label="Bandara tujuan"
                            value={drawerDraft.destination}
                            onChange={(value) => {
                              clearDrawerFieldError("destination");
                              clearDrawerFieldError("flightId");
                              setDrawerDraft((current) => ({
                                ...current,
                                destination: value as StationCode,
                                shippingRate: computeDraftShippingRate(
                                  { ...current, destination: value },
                                  activeEditFlight,
                                ),
                              }));
                            }}
                            options={editDestinationOptions}
                            className={fieldClassName("select-field", drawerErrors.destination)}
                          />
                          <FormFieldError message={drawerErrors.destination} />
                        </div>
                        <div data-field="weightKg">
                          <label className="label">Berat Muatan (kg)</label>
                          <input
                            className={fieldClassName("input-field", drawerErrors.weightKg)}
                            inputMode="decimal"
                            value={drawerDraft.weightKg}
                            onChange={(event) => {
                              clearDrawerFieldError("weightKg");
                              const raw = sanitizeDecimalInput(event.target.value);
                              const weightKg = parseDecimalValue(raw) ?? 0;
                              setDrawerDraft((current) => ({
                                ...current,
                                weightKg,
                                shippingRate: computeDraftShippingRate(
                                  { ...current, weightKg },
                                  activeEditFlight,
                                ),
                              }));
                            }}
                          />
                          <FormFieldError message={drawerErrors.weightKg} />
                        </div>
                        
                        <div>
                          <label className="label">Jenis Pengiriman</label>
                          <GlassSelect
                            aria-label="Jenis pengiriman"
                            value={drawerDraft.serviceType}
                            onChange={(serviceType) => {
                              setDrawerDraft((current) => ({
                                ...current,
                                serviceType,
                                shippingRate: computeDraftShippingRate(
                                  { ...current, serviceType },
                                  activeEditFlight,
                                ),
                              }));
                            }}
                            options={SERVICE_TYPE_OPTIONS.map((item) => ({ value: item, label: item }))}
                            className="select-field"
                          />
                        </div>
                        <div>
                          <label className="label" title={SHIPPING_RATE_TOOLTIP}>
                            Tarif Pengiriman
                          </label>
                          <input
                            className="input-field input-readonly"
                            value={drawerDraft.shippingRate}
                            readOnly
                            title={SHIPPING_RATE_TOOLTIP}
                          />
                        </div>
                        <div>
                          <label className="label">Nama Pesawat</label>
                          <input
                            className="input-field input-readonly"
                            value={activeEditFlight?.vehicleName ?? drawerDraft.vehicleName}
                            readOnly
                          />
                        </div>
                        
                        <div>
                          <label className="label">Kode Pesawat</label>
                          <input
                            className="input-field input-readonly"
                            value={activeEditFlight?.vehicleCode ?? drawerDraft.vehicleCode}
                            readOnly
                          />
                        </div>
                        <div>
                          <label className="label">Kapasitas Kargo (kg)</label>
                          <input
                            className="input-field input-readonly"
                            type="number"
                            value={activeEditFlight?.vehicleCapacityKg ?? drawerDraft.vehicleCapacityKg}
                            readOnly
                          />
                        </div>
                        <div>
                          <label className="label">Status Pesawat</label>
                          <input className="input-field input-readonly" value={activeEditFlight?.vehicleStatus ?? drawerDraft.vehicleStatus} readOnly />
                        </div>
                        <div>
                          <label className="label">Status Barang</label>
                          <GlassSelect
                            aria-label="Status barang"
                            value={drawerDraft.goodsStatus}
                            onChange={(value) =>
                              setDrawerDraft((current) => ({ ...current, goodsStatus: value }))
                            }
                            options={GOODS_STATUS_OPTIONS.map((item) => ({ value: item, label: item }))}
                            className="select-field"
                          />
                        </div>
                        <div>
                          <label className="label">Status Transaksi</label>
                          <GlassSelect
                            aria-label="Status transaksi"
                            value={drawerDraft.transactionStatus}
                            onChange={(value) =>
                              setDrawerDraft((current) => ({ ...current, transactionStatus: value }))
                            }
                            options={TRANSACTION_STATUS_FORM_OPTIONS.map((item) => ({ value: item, label: item }))}
                            className="select-field"
                          />
                        </div>
                        <div data-field="flightId">
                          <label className="label">Penerbangan</label>
                          <GlassSelect
                            aria-label="Penerbangan"
                            value={drawerDraft.flightId}
                            onChange={(value) => {
                              clearDrawerFieldError("flightId");
                              const nextFlight = availableFlights.find((item) => item.id === value) ?? null;
                              setDrawerDraft((current) => ({
                                ...current,
                                flightId: value,
                                shippingRate: computeDraftShippingRate(current, nextFlight),
                              }));
                            }}
                            options={flightSelectOptions}
                            className={fieldClassName("select-field", drawerErrors.flightId)}
                          />
                          <FormFieldError message={drawerErrors.flightId} />
                          {!isReadOnly && selectedShipment.awb && drawerDraft.flightId ? (
                            <button
                              type="button"
                              className="btn btn-secondary mt-3 w-full"
                              onClick={() => openAwbReceiptPrint(selectedShipment.awb)}
                            >
                              <FileText size={16} />
                              Cetak Resi AWB (pratinjau)
                            </button>
                          ) : null}
                        </div>
                        <div data-field="docStatus">
                          <label className="label">Status Dokumen</label>
                          <GlassSelect
                            aria-label="Status Dokumen"
                            value={drawerDraft.docStatus}
                            onChange={(value) => {
                              clearDrawerFieldError("docStatus");
                              setDrawerDraft((current) => ({ ...current, docStatus: value as "Partial" | "Complete" }));
                            }}
                            options={SHIPMENT_DOC_STATUS_FORM_OPTIONS.map((option) => ({
                              value: option.value,
                              label: option.label,
                            }))}
                            className={fieldClassName("select-field", drawerErrors.docStatus)}
                          />
                          <FormFieldError message={drawerErrors.docStatus} />
                        </div>
                        <div>
                          <label className="label">Kesiapan</label>
                          <input className="input-field input-readonly" value={selectedShipment.readiness} readOnly />
                        </div>
                        <div className="md:col-span-2">
                          <label className="label">Catatan Tinjauan</label>
                          <textarea
                            className="textarea-field ops-textarea-elevated"
                            value={drawerDraft.notes}
                            onChange={(event) =>
                              setDrawerDraft((current) => ({ ...current, notes: event.target.value }))
                            }
                            placeholder="Tambahkan catatan manifest, exception, atau keputusan review."
                          />
                        </div>
                      </div>


            </div>
        ) : null}
      </OpsDrawer>

      <OpsDrawer
        open={createOpen}
        eyebrow="Buat Pengiriman"
        title="Tambah manifest baru"
        onClose={() => setCreateOpen(false)}
        footer={
          <div className="flex w-full flex-wrap justify-end gap-3">
            <button type="button" className="btn btn-secondary" onClick={() => setCreateOpen(false)}>
              Batal
            </button>
            <button type="submit" form="create-manifest-form" className="btn btn-primary" disabled={saving}>
              {saving ? "Menyimpan..." : "Buat Pengiriman"}
            </button>
          </div>
        }
      >
            <form id="create-manifest-form" className="space-y-6" noValidate onSubmit={submitCreate}>
              <div className="rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-5">
                <SectionHeader title="Identitas Pengiriman" />
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="label">AWB</label>
                    <input className="input-field input-readonly" value="Dibuat otomatis oleh sistem" readOnly disabled />
                  </div>
                  <div data-field="sentAt">
                    <label className="label">Tanggal Kirim</label>
                    <GlassDatePicker
                      className={fieldClassName("input-field", createErrors.sentAt)}
                      aria-label="Tanggal kirim"
                      value={form.sentAt}
                      onChange={(nextValue) => {
                        clearCreateFieldError("sentAt");
                        setForm((current) => ({ ...current, sentAt: nextValue }));
                      }}
                    />
                    <FormFieldError message={createErrors.sentAt} />
                  </div>
                  <CommodityField
                    label="Komoditas"
                    commodities={commodityOptions}
                    value={form.commodity}
                    error={createErrors.commodity}
                    placeholder="Contoh: Dokumen penting"
                    onChange={(next) => {
                      clearCreateFieldError("commodity");
                      setForm((current) => ({ ...current, commodity: next }));
                    }}
                  />
                  <div data-field="cargoMode">
                    <label className="label">Mode Cargo</label>
                    <input className="input-field input-readonly" value="Kargo Udara" readOnly disabled />
                  </div>
                  <div>
                    <label className="label">Dibuat Oleh</label>
                    <input
                      className="input-field input-readonly"
                      value={viewerActorLabel || "-"}
                      readOnly
                      disabled
                    />
                  </div>
                  <div data-field="shiftOwnerId">
                    <label className="label">Penanggung Jawab Shift</label>
                    <GlassSelect
                      aria-label="Penanggung jawab shift"
                      value={form.shiftOwnerId}
                      onChange={(value) => {
                        clearCreateFieldError("shiftOwnerId");
                        const nextCandidate = shiftPicCandidates.find((candidate) => candidate.id === value);
                        setForm((current) => ({
                          ...current,
                          shiftOwnerId: value,
                          shiftOwnerPhone: resolveShiftPicPhone(nextCandidate, ""),
                        }));
                      }}
                      options={shiftPicOptions}
                      className={fieldClassName("select-field", createErrors.shiftOwnerId)}
                      placeholder="Pilih penanggung jawab shift"
                    />
                    <FormFieldError message={createErrors.shiftOwnerId} />
                  </div>
                  <div data-field="shiftOwnerPhone">
                    <label className="label">No Telepon PIC</label>
                    <input
                      className={cn(
                        fieldClassName("input-field", createErrors.shiftOwnerPhone),
                        createShiftPicHasProfilePhone && "input-readonly",
                      )}
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="Contoh: 08123456789"
                      value={form.shiftOwnerPhone}
                      readOnly={createShiftPicHasProfilePhone}
                      disabled={createShiftPicHasProfilePhone}
                      onChange={(event) => {
                        if (createShiftPicHasProfilePhone) return;
                        clearCreateFieldError("shiftOwnerPhone");
                        setForm((current) => ({
                          ...current,
                          shiftOwnerPhone: sanitizePhoneInput(event.target.value),
                        }));
                      }}
                    />
                    {!createShiftPicHasProfilePhone ? (
                      <p className="mt-1 text-xs text-[color:var(--muted-fg)]">
                        Nomor belum ada di profil PIC. Isi manual untuk kebutuhan koordinasi shift.
                      </p>
                    ) : null}
                    <FormFieldError message={createErrors.shiftOwnerPhone} />
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-5">
                <SectionHeader title="Routing & Kargo" />
                <div className="mt-5 grid gap-4 md:grid-cols-4">
                  <div data-field="origin">
                    <label className="label">Bandara Asal</label>
                    <input
                      className="input-field input-readonly"
                      value={formatStationLabel(form.origin)}
                      readOnly
                      aria-label="Bandara asal"
                    />
                    <FormFieldError message={createErrors.origin} />
                  </div>
                  <div data-field="destination">
                    <label className="label">Bandara Tujuan</label>
                    <GlassSelect
                      aria-label="Bandara tujuan"
                      value={form.destination}
                      onChange={(value) => {
                        clearCreateFieldError("destination");
                        clearCreateFieldError("flightId");
                        setForm((current) => ({
                          ...current,
                          destination: value as StationCode,
                          shippingRate: computeDraftShippingRate(
                            { ...current, destination: value },
                            activeCreateFlight,
                          ),
                        }));
                      }}
                      options={createDestinationOptions}
                      className={fieldClassName("select-field", createErrors.destination)}
                    />
                    <FormFieldError message={createErrors.destination} />
                  </div>
                  
                  <div data-field="weightKg">
                    <label className="label">Berat Muatan (kg)</label>
                    <input
                      className={fieldClassName("input-field", createErrors.weightKg)}
                      inputMode="decimal"
                      value={form.weightKg}
                      onChange={(event) => {
                        clearCreateFieldError("weightKg");
                        const raw = sanitizeDecimalInput(event.target.value);
                        const weightKg = parseDecimalValue(raw) ?? 0;
                        setForm((current) => ({
                          ...current,
                          weightKg,
                          shippingRate: computeDraftShippingRate(
                            { ...current, weightKg },
                            activeCreateFlight,
                          ),
                        }));
                      }}
                    />
                    <FormFieldError message={createErrors.weightKg} />
                  </div>
                  <div data-field="volumeM3">
                    <label className="label">Volume (m³)</label>
                    <input
                      className={fieldClassName("input-field", createErrors.volumeM3)}
                      inputMode="decimal"
                      value={form.volumeM3 ?? ""}
                      onChange={(event) => {
                        clearCreateFieldError("volumeM3");
                        const raw = sanitizeDecimalInput(event.target.value);
                        setForm((current) => ({ ...current, volumeM3: parseDecimalValue(raw) ?? 0 }));
                      }}
                    />
                    <FormFieldError message={createErrors.volumeM3} />
                  </div>
                  <div>
                    <label className="label">Jenis Pengiriman</label>
                    <GlassSelect
                      aria-label="Jenis pengiriman"
                      value={form.serviceType}
                      onChange={(serviceType) => {
                        setForm((current) => ({
                          ...current,
                          serviceType,
                          shippingRate: computeDraftShippingRate(
                            { ...current, serviceType },
                            activeCreateFlight,
                          ),
                        }));
                      }}
                      options={SERVICE_TYPE_OPTIONS.map((item) => ({ value: item, label: item }))}
                      className="select-field"
                    />
                  </div>
                  <div>
                    <label className="label" title={SHIPPING_RATE_TOOLTIP}>
                      Tarif Pengiriman
                    </label>
                    <input
                      className="input-field input-readonly"
                      value={form.shippingRate}
                      readOnly
                      title={SHIPPING_RATE_TOOLTIP}
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="label">Penanganan Khusus</label>
                    <input
                      className="input-field"
                      placeholder="Instruksi khusus"
                      value={form.specialHandling}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, specialHandling: event.target.value }))
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-5">
                <SectionHeader title="Pesawat & Status" />
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="label">Nama Pesawat</label>
                    <input
                      className="input-field input-readonly"
                      value={activeCreateFlight?.vehicleName ?? form.vehicleName}
                      readOnly
                    />
                  </div>

                  <div>
                    <label className="label">Kode Pesawat</label>
                    <input
                      className="input-field input-readonly"
                      value={activeCreateFlight?.vehicleCode ?? form.vehicleCode}
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="label">Kapasitas Kargo (kg)</label>
                    <input
                      className="input-field input-readonly"
                      type="number"
                      value={activeCreateFlight?.vehicleCapacityKg ?? form.vehicleCapacityKg}
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="label">Status Pesawat</label>
                    <input className="input-field input-readonly" value={activeCreateFlight?.vehicleStatus ?? form.vehicleStatus} readOnly />
                  </div>
                  <div>
                    <label className="label">Status Barang</label>
                    <input className="input-field input-readonly" value="Diproses" readOnly />
                  </div>
                  <div>
                    <label className="label">Status Transaksi</label>
                    <input className="input-field input-readonly" value={getDraftTransactionStatus(form.shippingRate)} readOnly />
                  </div>
                  <div data-field="docStatus">
                    <label className="label">Status Dokumen</label>
                    <GlassSelect
                      aria-label="Status Dokumen"
                      value={form.docStatus}
                      onChange={(value) => {
                        clearCreateFieldError("docStatus");
                        setForm((current) => ({ ...current, docStatus: value as "Partial" | "Complete" }));
                      }}
                      options={SHIPMENT_DOC_STATUS_FORM_OPTIONS.map((option) => ({
                        value: option.value,
                        label: option.label,
                      }))}
                      className={fieldClassName("select-field", createErrors.docStatus)}
                    />
                    <FormFieldError message={createErrors.docStatus} />
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-5">
                <SectionHeader title="Pihak & Akun" />
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <div data-field="shipper">
                    <label className="label">Pengirim</label>
                    <input
                      className={fieldClassName("input-field", createErrors.shipper)}
                      placeholder="Nama pengirim"
                      value={form.shipper}
                      onChange={(event) => {
                        clearCreateFieldError("shipper");
                        setForm((current) => ({ ...current, shipper: sanitizePersonName(event.target.value) }));
                      }}
                    />
                    <FormFieldError message={createErrors.shipper} />
                  </div>
                  <div data-field="consignee">
                    <label className="label">Penerima</label>
                    <input
                      className={fieldClassName("input-field", createErrors.consignee)}
                      placeholder="Nama penerima"
                      value={form.consignee}
                      onChange={(event) => {
                        clearCreateFieldError("consignee");
                        setForm((current) => ({ ...current, consignee: sanitizePersonName(event.target.value) }));
                      }}
                    />
                    <FormFieldError message={createErrors.consignee} />
                  </div>
                  <div data-field="forwarder">
                    <label className="label">Ekspeditor</label>
                    <input
                      className={fieldClassName("input-field", createErrors.forwarder)}
                      placeholder="Nama ekspeditor"
                      value={form.forwarder}
                      onChange={(event) => {
                        clearCreateFieldError("forwarder");
                        setForm((current) => ({ ...current, forwarder: sanitizePersonName(event.target.value) }));
                      }}
                    />
                    <FormFieldError message={createErrors.forwarder} />
                  </div>
                  <div data-field="senderPhone">
                    <label className="label">No Telepon Pengirim</label>
                    <input
                      className={fieldClassName("input-field", createErrors.senderPhone)}
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="Contoh: 08123456789"
                      value={form.senderPhone}
                      onChange={(event) => {
                        clearCreateFieldError("senderPhone");
                        setForm((current) => ({ ...current, senderPhone: sanitizePhoneInput(event.target.value) }));
                      }}
                    />
                    <FormFieldError message={createErrors.senderPhone} />
                  </div>
                  <div data-field="flightId">
                    <label className="label">Penerbangan</label>
                    <GlassSelect
                      aria-label="Penerbangan"
                      value={form.flightId}
                      onChange={(value) => {
                        clearCreateFieldError("flightId");
                        const nextFlight = availableFlights.find((item) => item.id === value) ?? null;
                        setForm((current) => ({
                          ...current,
                          flightId: value,
                          shippingRate: computeDraftShippingRate(current, nextFlight),
                        }));
                      }}
                      options={flightSelectOptions}
                      className={fieldClassName("select-field", createErrors.flightId)}
                    />
                    <FormFieldError message={createErrors.flightId} />
                  </div>
                  <div className="md:col-span-3">
                    <label className="label">Catatan Operator</label>
                    <textarea
                      className="textarea-field ops-textarea-elevated"
                      placeholder="Catatan staf"
                      value={form.notes}
                      onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                    />
                  </div>
                </div>
              </div>

            </form>
      </OpsDrawer>

      <ConfirmDialog
        open={confirmShipmentDelete}
        title="Hapus pengiriman ini?"
        description={
          selectedShipment
            ? `Pengiriman ${selectedShipment.awb} akan dihapus dari basis data dan hilang dari manifest. Tindakan ini tidak bisa dibatalkan.`
            : "Pengiriman akan dihapus permanen dari basis data."
        }
        confirmLabel="Ya, hapus pengiriman"
        tone="danger"
        loading={saving}
        onConfirm={() => void handleDeleteShipment()}
        onCancel={() => setConfirmShipmentDelete(false)}
      />


      </>
      }
    />
  );
}
