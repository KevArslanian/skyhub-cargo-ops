"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { memo, startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  Filter,
  Inbox,
  LoaderCircle,
  Pencil,
  Plus,
  Save,
  Search,
  ShieldAlert,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { cn, formatDateTime, formatRelativeShort, formatWeight } from "@/lib/format";
import {
  CARGO_MODE_OPTIONS,
  GOODS_STATUS_OPTIONS,
  SERVICE_TYPE_OPTIONS,
  STATION_OPTIONS,
  VEHICLE_STATUS_OPTIONS,
  VEHICLE_TYPE_OPTIONS,
} from "@/lib/constants";
import { StatusBadge } from "@/components/status-badge";
import {
  DataCard,
  EmptyState,
  OpsPanel,
  SectionHeader,
  SkeletonBlock,
} from "@/components/ops-ui";
import { OpsDrawer } from "@/components/ops-drawer";
import { ConfirmDialog } from "@/components/confirm-dialog";

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

type LedgerPayload = {
  viewer: {
    role: "admin" | "staff" | "customer";
    readOnly: boolean;
    customerAccountName: string | null;
  };
  permissions: {
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
    canDocument: boolean;
    canVerifyPayment: boolean;
    canExport: boolean;
  };
  shipments: ShipmentRow[];
  flights: { id: string; flightNumber: string }[];
  customerAccounts: { id: string; name: string; code: string }[];
};

const TRANSACTION_STATUS_FORM_OPTIONS = ["Belum Lunas", "Menunggu Verifikasi", "Lunas", "Tidak Ditagih", "Pending"] as const;
const DOCUMENT_UPLOAD_ACCEPT =
  ".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.csv,.doc,.docx,.xls,.xlsx,application/pdf,image/png,image/jpeg,image/webp,image/gif,text/plain,text/csv,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const DOCUMENT_UPLOAD_FORMAT_COPY = "PDF, gambar, TXT, CSV, DOC, DOCX, XLS, atau XLSX.";

function formatDateInput(value?: string | null) {
  return value ? value.slice(0, 10) : new Date().toISOString().slice(0, 10);
}

function createDrawerDraft(shipment: ShipmentRow | null) {
  return {
    status: shipment?.status ?? "received",
    ownerName: shipment?.ownerName ?? "",
    notes: shipment?.notes ?? "",
    sentAt: formatDateInput(shipment?.sentAt),
    cargoMode: shipment?.cargoMode ?? "Udara",
    senderPhone: shipment?.senderPhone ?? "",
    commodity: shipment?.commodity ?? "",
    origin: shipment?.origin ?? "",
    destination: shipment?.destination ?? "",
    pieces: shipment?.pieces ?? 1,
    weightKg: shipment?.weightKg ?? 1,
    serviceType: shipment?.serviceType ?? "Biasa",
    shippingRate: shipment?.shippingRate ?? 0,
    goodsStatus: shipment?.goodsStatus ?? "Diproses",
    transactionStatus: shipment?.transactionStatus ?? "Belum Lunas",
    vehicleName: shipment?.vehicleName ?? "",
    vehicleType: shipment?.vehicleType ?? "Pesawat",
    vehicleCode: shipment?.vehicleCode ?? "",
    vehicleCapacityKg: shipment?.vehicleCapacityKg ?? 1,
    vehicleStatus: shipment?.vehicleStatus ?? "Aktif",
    flightId: shipment?.flightId || "",
    customerAccountId: shipment?.customerAccountId || "",
  };
}

function createBlankForm() {
  return {
    awb: "",
    sentAt: formatDateInput(),
    commodity: "",
    cargoMode: "Udara",
    senderPhone: "",
    origin: "SOQ",
    destination: "CGK",
    pieces: 1,
    weightKg: 1,
    volumeM3: 0.5,
    specialHandling: "",
    serviceType: "Biasa",
    shippingRate: 0,
    vehicleName: "SkyHub 01",
    vehicleType: "Pesawat",
    vehicleCode: "PK-SHA",
    vehicleCapacityKg: 1000,
    vehicleStatus: "Aktif",
    shipper: "",
    consignee: "",
    forwarder: "SkyHub",
    ownerName: "Operator Shift",
    flightId: "",
    customerAccountId: "",
    notes: "",
  };
}

function getDraftTransactionStatus(shippingRate: number) {
  return shippingRate <= 0 ? "Tidak Ditagih" : "Belum Lunas";
}

function getUrgencyState(shipment: ShipmentRow | null) {
  if (!shipment) {
    return {
      tone: "info" as const,
      badgeValue: "info",
      label: "Belum ada pengiriman",
      copy: "Pilih baris manifest untuk membuka detail operasional dan review state.",
    };
  }

  if (shipment.status === "hold") {
    return {
      tone: "danger" as const,
      badgeValue: "error",
      label: "Perlu eskalasi",
      copy: "Pengiriman sedang tertahan dan harus ditinjau sebelum proses diteruskan.",
    };
  }

  if (shipment.docStatus.toLowerCase() !== "complete") {
    return {
      tone: "warning" as const,
      badgeValue: "review",
      label: "Dokumen belum bersih",
      copy: `Status dokumen saat ini ${shipment.docStatus}. Pastikan berkas lengkap sebelum penugasan final.`,
    };
  }

  if (shipment.readiness.toLowerCase() !== "ready") {
    return {
      tone: "warning" as const,
      badgeValue: "review",
      label: "Kesiapan perlu dicek",
      copy: `Kesiapan tercatat ${shipment.readiness}. Operator perlu verifikasi lapangan.`,
    };
  }

  return {
    tone: "success" as const,
    badgeValue: "success",
    label: "Siap diproses",
    copy: "Status, dokumen, dan kesiapan saat ini tidak menunjukkan exception aktif.",
  };
}

function getConfidenceState(shipment: ShipmentRow | null) {
  if (!shipment) {
    return {
      badgeValue: "info",
      label: "Menunggu data",
      copy: "Keyakinan data akan dihitung setelah pengiriman dipilih.",
    };
  }

  if (shipment.status === "hold") {
    return {
      badgeValue: "warning",
      label: "Rendah",
      copy: "Ada hold aktif yang menurunkan kepercayaan eksekusi.",
    };
  }

  if (shipment.trackingLogs.length >= 4 && shipment.docStatus.toLowerCase() === "complete") {
    return {
      badgeValue: "success",
      label: "Tinggi",
      copy: "Status, dokumen, dan kronologi log cukup lengkap untuk diproses cepat.",
    };
  }

  return {
    badgeValue: "info",
    label: "Menengah",
    copy: "Data utama tersedia, tetapi review akhir masih perlu dilakukan.",
  };
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs, value]);

  return debouncedValue;
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
}: {
  shipment: ShipmentRow;
  selected: boolean;
  onSelect: (shipmentId: string) => void;
}) {
  const status = getManifestStatus(shipment);
  const needsReview = shipment.needsReview || shipment.status === "hold" || shipment.docStatus === "Review";

  return (
    <tr className={cn("ledger-manifest-table-row", selected && "ledger-manifest-table-row-active")}>
      <td>
        <button type="button" className="ledger-row-button" onClick={() => onSelect(shipment.id)}>
          <span className="font-mono text-sm font-semibold text-[color:var(--brand-primary)]" title={shipment.awb}>
            {shipment.awb}
          </span>
          <span className="mt-1 block truncate text-xs text-[color:var(--muted-fg)]" title={shipment.customerAccountName || shipment.shipper}>
            {shipment.customerAccountName || shipment.shipper}
          </span>
        </button>
      </td>
      <td>
        <button type="button" className="ledger-row-button" onClick={() => onSelect(shipment.id)}>
          <span className="block truncate font-semibold text-[color:var(--text-strong)]" title={shipment.commodity}>
            {shipment.commodity}
          </span>
          <span className="mt-1 block text-xs text-[color:var(--muted-fg)]">
            {formatWeight(shipment.weightKg)} • {shipment.pieces} koli
          </span>
        </button>
      </td>
      <td>
        <span className="block truncate text-xs font-medium text-[color:var(--text-strong)]" title={`${shipment.origin} → ${shipment.destination}`}>
          {shipment.origin} → {shipment.destination}
        </span>
      </td>
      <td>
        <span className="block truncate text-xs text-[color:var(--muted-fg)]" title={shipment.flightNumber || "Belum ditugaskan"}>
          {shipment.flightNumber || "-"}
        </span>
      </td>
      <td>
        <div className="flex flex-wrap gap-2">
          <StatusBadge value={status.value} label={status.label} />
          {needsReview ? <StatusBadge value="review" label="Butuh Tinjauan" /> : null}
        </div>
      </td>
      <td>
        <time dateTime={formatIsoSecond(shipment.updatedAt)} title={formatIsoSecond(shipment.updatedAt)}>
          {formatRelativeShort(shipment.updatedAt)}
        </time>
      </td>
      <td className="text-right">
        {needsReview ? (
          <button type="button" className="topbar-button min-h-[34px] px-3 border-[color:var(--tone-warning-border)] bg-[color:var(--tone-warning-soft)] text-[color:var(--tone-warning)] hover:bg-[color:var(--tone-warning)] hover:text-white" onClick={() => onSelect(shipment.id)}>
            Tinjau
          </button>
        ) : (
          <button type="button" className="topbar-button min-h-[34px] px-3" onClick={() => onSelect(shipment.id)}>
            Detail
          </button>
        )}
      </td>
    </tr>
  );
});

export default function ShipmentLedgerPage() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<LedgerPayload | null>(null);
  const [query, setQuery] = useState(searchParams.get("query") || "");
  const [status, setStatus] = useState(searchParams.get("status") || "all");
  const [flight, setFlight] = useState(searchParams.get("flight") || "all");
  const [sortBy, setSortBy] = useState(searchParams.get("sortBy") || "updated");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionNotice, setActionNotice] = useState<string>("");
  const [actionNoticeTone, setActionNoticeTone] = useState<"info" | "warning">("info");
  const [confirmShipmentDelete, setConfirmShipmentDelete] = useState(false);
  const [confirmDocumentDelete, setConfirmDocumentDelete] = useState<string | null>(null);
  const [form, setForm] = useState(() => createBlankForm());
  const [drawerDraft, setDrawerDraft] = useState(() => createDrawerDraft(null));
  const [listPage, setListPage] = useState(1);
  const selectedIdRef = useRef<string | null>(null);
  const hasLoadedRef = useRef(false);
  const splitPaneRef = useRef<HTMLDivElement | null>(null);
  const pendingDetailQueryRef = useRef<string | null>(null);

  const debouncedQuery = useDebouncedValue(query, 300);

  useEffect(() => {
    function handleContextSearch(event: Event) {
      const detail = (event as CustomEvent<{ pathname?: string; query?: string; focusDetail?: boolean }>).detail;
      if (detail?.pathname !== "/shipment-ledger" || !detail.query) return;
      setQuery(detail.query);
      setListPage(1);

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

  const requestShipments = useCallback(async () => {
    const params = new URLSearchParams();
    if (debouncedQuery.trim()) params.set("query", debouncedQuery.trim());
    if (status !== "all") params.set("status", status);
    if (flight !== "all") params.set("flight", flight);
    if (sortBy) params.set("sortBy", sortBy);

    const response = await fetch(`/api/shipments?${params.toString()}`, { cache: "no-store" });
    if (!response.ok) return null;

    return (await response.json()) as LedgerPayload;
  }, [debouncedQuery, flight, sortBy, status]);

  const loadShipments = useCallback(
    async (preferredShipmentId: string | null = selectedIdRef.current, mode: "initial" | "refresh" = "refresh") => {
      if (mode === "initial") {
        setLoading(true);
      }

      const payload = await requestShipments();
      if (payload) {
        applyShipmentPayload(payload, preferredShipmentId);
      }

      setLoading(false);
    },
    [applyShipmentPayload, requestShipments],
  );

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    const mode = hasLoadedRef.current ? "refresh" : "initial";
    void loadShipments(selectedIdRef.current, mode).finally(() => {
      hasLoadedRef.current = true;
    });
  }, [loadShipments]);

  useEffect(() => {
    if (!actionNotice) return;
    const timer = window.setTimeout(() => setActionNotice(""), 2600);
    return () => window.clearTimeout(timer);
  }, [actionNotice]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible" || createOpen || editOpen || saving) return;
      void loadShipments(selectedIdRef.current, "refresh");
    }, 10000);

    return () => window.clearInterval(timer);
  }, [createOpen, editOpen, loadShipments, saving]);

  const selectedShipment = useMemo(
    () => data?.shipments.find((shipment) => shipment.id === selectedId) ?? null,
    [data, selectedId],
  );

  const handleSelectShipment = useCallback(
    (shipmentId: string) => {
      const nextShipment = (data?.shipments ?? []).find((shipment) => shipment.id === shipmentId) ?? null;
      setSelectedId(shipmentId);
      setDrawerDraft(createDrawerDraft(nextShipment));
      setEditOpen(false);
    },
    [data?.shipments],
  );

  const activeFilterCount = [Boolean(query.trim()), status !== "all", flight !== "all", sortBy !== "updated"].filter(
    Boolean,
  ).length;

  const exportParams = new URLSearchParams();
  if (debouncedQuery.trim()) exportParams.set("query", debouncedQuery.trim());
  if (status !== "all") exportParams.set("status", status);
  if (flight !== "all") exportParams.set("flight", flight);
  if (sortBy) exportParams.set("sortBy", sortBy);

  const isReadOnly = data?.viewer.readOnly ?? false;
  const urgencyState = getUrgencyState(selectedShipment);
  const confidenceState = getConfidenceState(selectedShipment);
  const listPageSize = 6;
  const shipments = useMemo(() => data?.shipments ?? [], [data?.shipments]);
  const totalPages = Math.max(1, Math.ceil(shipments.length / listPageSize));
  const pageStart = (listPage - 1) * listPageSize;
  const pagedShipments = shipments.slice(pageStart, pageStart + listPageSize);
  const pageEnd = Math.min(pageStart + pagedShipments.length, shipments.length);
  const splitPaneClassName = cn("split-pane-shell", selectedShipment ? "split-pane-shell-open" : "split-pane-shell-closed");

  useEffect(() => {
    setListPage(1);
  }, [debouncedQuery, flight, sortBy, status]);

  useEffect(() => {
    if (listPage <= totalPages) return;
    setListPage(totalPages);
  }, [listPage, totalPages]);

  useEffect(() => {
    const pendingQuery = pendingDetailQueryRef.current?.trim().toLowerCase();
    if (!pendingQuery || !shipments.length) return;

    const matchedShipment =
      shipments.find((shipment) => shipment.awb.toLowerCase() === pendingQuery) ??
      shipments.find((shipment) =>
        [shipment.awb, shipment.commodity, shipment.shipper, shipment.consignee, shipment.customerAccountName, shipment.flightNumber]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(pendingQuery),
      );

    if (!matchedShipment) return;

    pendingDetailQueryRef.current = null;
    const matchedIndex = shipments.findIndex((shipment) => shipment.id === matchedShipment.id);
    if (matchedIndex >= 0) {
      setListPage(Math.floor(matchedIndex / listPageSize) + 1);
    }
    handleSelectShipment(matchedShipment.id);
  }, [handleSelectShipment, shipments, listPageSize]);

  async function resolveErrorMessage(response: Response, fallback: string) {
    try {
      const payload = (await response.json()) as { error?: string };
      return payload.error || fallback;
    } catch {
      return fallback;
    }
  }

  async function submitCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    const response = await fetch("/api/shipments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        flightId: form.flightId || null,
        customerAccountId: form.customerAccountId || null,
      }),
    });

    if (response.ok) {
      const payload = (await response.json()) as { shipment?: ShipmentRow | null };
      setCreateOpen(false);
      setForm(createBlankForm());
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
      }
      setActionNoticeTone("info");
      setActionNotice("Pengiriman berhasil dibuat.");
      void loadShipments(payload.shipment?.id ?? selectedId, "refresh");
    } else {
      setActionNoticeTone("warning");
      setActionNotice(await resolveErrorMessage(response, "Gagal membuat pengiriman."));
    }

    setSaving(false);
  }

  async function saveShipmentChanges() {
    if (!selectedShipment) return;

    setSaving(true);
    const response = await fetch(`/api/shipments/${selectedShipment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...drawerDraft,
        flightId: drawerDraft.flightId || null,
        customerAccountId: drawerDraft.customerAccountId || null,
      }),
    });

    if (response.ok) {
      const payload = (await response.json()) as { shipment?: ShipmentRow | null };
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
      setActionNoticeTone("info");
      setActionNotice("Perubahan pengiriman berhasil disimpan.");
      void loadShipments(selectedShipment.id, "refresh");
    } else {
      setActionNoticeTone("warning");
      setActionNotice(await resolveErrorMessage(response, "Gagal menyimpan pengiriman."));
    }

    setSaving(false);
  }

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    if (!selectedShipment || !event.target.files?.[0]) return;
    const file = event.target.files[0];
    const formData = new FormData();
    formData.append("file", file);

    setSaving(true);
    try {
      const response = await fetch(`/api/shipments/${selectedShipment.id}/documents`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        setActionNoticeTone("info");
        setActionNotice("Dokumen berhasil diunggah dan tersimpan di basis data.");
        await loadShipments(selectedShipment.id, "refresh");
      } else {
        setActionNoticeTone("warning");
        setActionNotice(await resolveErrorMessage(response, `Gagal mengunggah dokumen. Gunakan ${DOCUMENT_UPLOAD_FORMAT_COPY}`));
      }
    } catch {
      setActionNoticeTone("warning");
      setActionNotice("Koneksi terputus saat mengunggah dokumen.");
    } finally {
      setSaving(false);
      event.target.value = "";
    }
  }

  async function handleDeleteDocument(documentId: string) {
    if (!selectedShipment) return;

    const response = await fetch(`/api/shipments/${selectedShipment.id}/documents/${documentId}`, {
      method: "DELETE",
    });

    const payload = (await response.json().catch(() => ({}))) as { warning?: string | null };
    if (response.ok) {
      setActionNoticeTone(payload.warning ? "warning" : "info");
      setActionNotice(payload.warning || "Dokumen berhasil dihapus dari tampilan kerja.");
      await loadShipments(selectedShipment.id, "refresh");
    } else {
      setActionNoticeTone("warning");
      setActionNotice(await resolveErrorMessage(response, "Gagal menghapus dokumen."));
    }
  }

  async function handleVerifyPaymentDocument(documentId: string) {
    if (!selectedShipment) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/shipments/${selectedShipment.id}/documents/${documentId}`, {
        method: "PATCH",
      });

      if (response.ok) {
        const payload = (await response.json()) as { shipment?: ShipmentRow | null };
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
        setActionNoticeTone("info");
        setActionNotice("Pembayaran berhasil diverifikasi admin.");
      } else {
        setActionNoticeTone("warning");
        setActionNotice(await resolveErrorMessage(response, "Gagal verifikasi pembayaran."));
      }
    } catch {
      setActionNoticeTone("warning");
      setActionNotice("Koneksi terputus saat verifikasi pembayaran.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteShipment() {
    if (!selectedShipment) return;

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
      setEditOpen(false);
      setConfirmShipmentDelete(false);
      setActionNoticeTone("info");
      setActionNotice(`Pengiriman ${selectedShipment.awb} berhasil dihapus dari basis data.`);
      void loadShipments(null, "refresh");
    } else {
      setActionNoticeTone("warning");
      setActionNotice(await resolveErrorMessage(response, "Gagal menghapus pengiriman."));
    }
  }

  function handlePageChange(nextPage: number) {
    const clamped = Math.min(Math.max(nextPage, 1), totalPages);
    setListPage(clamped);
    setSelectedId(null);
  }

  const filterControls = useMemo(
    () => (
      <section className="ops-filter-strip" aria-label="Pencarian dan filter Buku Pengiriman">
        <div className="ops-filter-search">
          <label className="label" htmlFor="ledger-query">Cari Pengiriman</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[color:var(--muted-fg)]" />
            <input
              id="ledger-query"
              className="input-field input-field-leading"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari AWB, komoditas, pemilik, atau penerbangan"
            />
          </div>
        </div>
      <div className="shell-inline-filters" aria-label="Filter Buku Pengiriman">
        <div className="shell-filter-field">
          <label className="label" htmlFor="ledger-status">Status</label>
          <select id="ledger-status" className="select-field" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">Semua Status</option>
            <option value="departed">Berangkat</option>
            <option value="arrived">Tiba</option>
            <option value="hold">Tertahan</option>
            <option value="delayed">Ditunda</option>
            <option value="review">Butuh Tinjauan</option>
            <option value="received">Diterima</option>
            <option value="sortation">Sortasi</option>
            <option value="loaded_to_aircraft">Muat ke Pesawat</option>
          </select>
        </div>
        <div className="shell-filter-field">
          <label className="label" htmlFor="ledger-flight">Penerbangan</label>
          <select id="ledger-flight" className="select-field" value={flight} onChange={(event) => setFlight(event.target.value)}>
            <option value="all">Semua</option>
            {(data?.flights ?? []).map((item) => (
              <option key={item.id} value={item.flightNumber}>
                {item.flightNumber}
              </option>
            ))}
          </select>
        </div>
        <div className="shell-filter-field">
          <label className="label" htmlFor="ledger-sort">Urutkan</label>
          <select id="ledger-sort" className="select-field" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
            <option value="updated">Update Terbaru</option>
            <option value="received">Penerimaan Terbaru</option>
            <option value="priority">Prioritas Tinjauan</option>
          </select>
        </div>
        {activeFilterCount > 0 ? (
          <span className="shell-filter-count" aria-label={`${activeFilterCount} filter aktif`}>
            <Filter size={14} />
            {activeFilterCount}
          </span>
        ) : null}
      </div>
      </section>
    ),
    [activeFilterCount, data?.flights, flight, query, sortBy, status],
  );

  return (
    <main className="page-workspace" aria-labelledby="shipment-ledger-title">
      <h1 id="shipment-ledger-title" className="sr-only">{isReadOnly ? "Pengiriman Saya" : "Buku Pengiriman"}</h1>

      {filterControls}

      <div role="status" aria-live="polite">
        {actionNotice ? (
          <div
            className={
              actionNoticeTone === "warning"
                ? "rounded-[18px] border border-[color:var(--tone-warning-border)] bg-[color:var(--tone-warning-soft)] px-4 py-3 text-sm font-medium text-[color:var(--tone-warning)]"
                : "rounded-[18px] border border-[color:var(--tone-info-border)] bg-[color:var(--tone-info-soft)] px-4 py-3 text-sm font-medium text-[color:var(--tone-info)]"
            }
          >
            {actionNotice}
          </div>
        ) : null}
      </div>

      <div ref={splitPaneRef} className={splitPaneClassName}>
        <OpsPanel className="page-pane split-pane-left internal-scrollbar flex min-h-0 flex-col overflow-hidden p-0">
          <div className="border-b border-[color:var(--border-soft)] p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="mt-1 font-[family:var(--font-heading)] text-[1.25rem] font-extrabold tracking-[-0.03em] text-[color:var(--text-strong)]">
                  Manifest aktif
                </h2>
                <p className="mt-1 text-xs font-semibold text-[color:var(--muted-fg)]">
                  {shipments.length ? `${pageStart + 1}-${pageEnd} dari ${shipments.length} pengiriman` : "Belum ada pengiriman"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {!isReadOnly && data?.permissions.canExport ? (
                  <Link
                    href={`/exports/shipments?${exportParams.toString()}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary"
                  >
                    <FileText size={16} />
                    Cetak
                  </Link>
                ) : null}
                {!isReadOnly && data?.permissions.canCreate ? (
                  <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
                    <Plus size={16} />
                    Buat Pengiriman
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="min-h-0 flex-1 space-y-3 p-5">
              <SkeletonBlock className="h-6 w-48" />
              {Array.from({ length: 6 }).map((_, index) => (
                <SkeletonBlock key={index} className="h-[84px] w-full rounded-[22px]" />
              ))}
            </div>
          ) : (
            <div className="min-h-0 flex-1 p-4">
              {shipments.length ? (
                <div className="space-y-2.5">
                  <div className="ledger-manifest-table-wrap" role="region" aria-label="Daftar manifest pengiriman" tabIndex={0}>
                    <table className="ledger-manifest-table">
                      <thead>
                        <tr>
                          <th scope="col">AWB</th>
                          <th scope="col">Pengiriman</th>
                          <th scope="col">Rute</th>
                          <th scope="col">Penerbangan</th>
                          <th scope="col">Status</th>
                          <th scope="col">
                            <SortHeader label="Update" active={sortBy === "updated"} onClick={() => setSortBy("updated")} />
                          </th>
                          <th scope="col" className="text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedShipments.map((shipment) => (
                          <LedgerManifestRow
                            key={shipment.id}
                            shipment={shipment}
                            selected={selectedShipment?.id === shipment.id}
                            onSelect={handleSelectShipment}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-3 py-3">
                    <button
                      type="button"
                      className="topbar-button"
                      onClick={() => handlePageChange(listPage - 1)}
                      disabled={listPage <= 1}
                    >
                      <ChevronLeft size={16} />
                      Sebelumnya
                    </button>
                    <p className="text-xs font-semibold text-[color:var(--muted-fg)]">
                      {shipments.length ? `${pageStart + 1}-${pageEnd}` : "0-0"} dari {shipments.length} • Halaman {listPage}/{totalPages}
                    </p>
                    <button
                      type="button"
                      className="topbar-button"
                      onClick={() => handlePageChange(listPage + 1)}
                      disabled={listPage >= totalPages}
                    >
                      Berikutnya
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={Inbox}
                  variant="filtered"
                  title="Tidak ada pengiriman ditemukan"
                  copy="Coba ubah filter status atau penerbangan, atau tunggu hingga manifest baru masuk."

                />
              )}
            </div>
          )}
        </OpsPanel>

        {selectedShipment ? (
          <OpsPanel key={selectedShipment.id} className="page-pane split-pane-right ledger-detail-panel flex min-h-0 flex-col overflow-hidden p-0">
            <>
              <div className="border-b border-[color:var(--border-soft)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="ops-eyebrow">Detail Pengiriman</p>
                    <div className="mt-1 flex flex-wrap items-end gap-3">
                      <h2 className="font-[family:var(--font-heading)] text-[1.55rem] font-black tracking-[-0.04em] text-[color:var(--brand-primary)]">
                        {selectedShipment.awb}
                      </h2>
                      <StatusBadge value={selectedShipment.status} label={selectedShipment.statusLabel} />
                    </div>
                    <p className="mt-1 text-sm leading-6 text-[color:var(--muted-fg)]">
                      {selectedShipment.commodity} • {selectedShipment.origin} &rarr; {selectedShipment.destination}
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <StatusBadge value={urgencyState.badgeValue} label={urgencyState.label} />
                    <button type="button" className="topbar-button min-h-[34px] px-3" onClick={() => setSelectedId(null)} aria-label="Tutup detail">
                      <X size={15} />
                    </button>
                  </div>
                </div>

                <div
                  className={cn(
                    "mt-4 rounded-[18px] border px-3 py-3 text-sm leading-6",
                    urgencyState.tone === "danger"
                      ? "border-[color:var(--tone-danger-border)] bg-[color:var(--tone-danger-soft)] text-[color:var(--tone-danger)]"
                      : urgencyState.tone === "warning"
                        ? "border-[color:var(--tone-warning-border)] bg-[color:var(--tone-warning-soft)] text-[color:var(--tone-warning)]"
                        : "border-[color:var(--tone-success-border)] bg-[color:var(--tone-success-soft)] text-[color:var(--tone-success)]",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <ShieldAlert size={18} className="mt-1 shrink-0" />
                    <div>
                      <p className="font-semibold text-[color:var(--text-strong)]">{urgencyState.label}</p>
	                      <p className="mt-1">{urgencyState.copy}</p>
	                    </div>
	                  </div>
	                </div>
              </div>

              <div className="page-scroll ledger-detail-scroll internal-scrollbar flex-1">
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
                      <small>{selectedShipment.documentSummary.count} berkas aktif</small>
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

	                <div className="section-stack-gap mt-4">
	                  {!isReadOnly ? (
	                    <>
	                      <div className="ledger-section-card rounded-[20px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)]">
	                        <SectionHeader
	                          title="Tinjauan Operasional"
	                          subtitle={`${selectedShipment.origin} -> ${selectedShipment.destination} • ${selectedShipment.vehicleCode || selectedShipment.vehicleType}`}
	                        />
                          <dl className="ledger-detail-lines mt-4">
                            <div><dt>Penanggung jawab</dt><dd>{selectedShipment.ownerName || "-"}</dd></div>
                            <div><dt>Tarif</dt><dd>Rp {selectedShipment.shippingRate.toLocaleString("id-ID")}</dd></div>
                            <div><dt>Kendaraan</dt><dd>{selectedShipment.vehicleName || selectedShipment.vehicleType}</dd></div>
                            <div><dt>Keyakinan data</dt><dd>{confidenceState.label}</dd></div>
                          </dl>
	                        {selectedShipment.notes ? (
	                          <div className="mt-4 rounded-[16px] border border-[color:var(--border-soft)] bg-[color:var(--panel-bg)] px-3 py-3 text-sm leading-6 text-[color:var(--muted-fg)]">
	                            {selectedShipment.notes}
	                          </div>
	                        ) : null}
	                        <div className="mt-4 flex flex-wrap gap-2 rounded-[18px] border border-[color:var(--border-soft)] bg-[color:var(--panel-bg)] p-3">
                          {data?.permissions.canEdit ? (
                            <button
                              type="button"
	                              className="btn btn-primary flex-1"
                              onClick={() => {
                                setDrawerDraft(createDrawerDraft(selectedShipment));
                                setEditOpen(true);
                              }}
                            >
                              <Pencil size={16} />
                              Ubah Pengiriman
                            </button>
                          ) : null}
                          {data?.permissions.canDocument ? (
                            <label className={cn("btn btn-secondary flex-1", saving ? "pointer-events-none opacity-60" : "cursor-pointer")}>
                              {saving ? <LoaderCircle size={16} className="animate-spin" /> : <Upload size={16} />}
                              {saving ? "Memproses..." : "Unggah Dokumen"}
                              <input type="file" className="hidden" accept={DOCUMENT_UPLOAD_ACCEPT} onChange={handleUpload} disabled={saving} />
                            </label>
                          ) : null}
                          {data?.permissions.canDelete ? (
                            <button type="button" className="btn btn-danger" onClick={() => setConfirmShipmentDelete(true)}>
                              <Trash2 size={16} />
                              Hapus
                            </button>
                          ) : null}
                        </div>
                      </div>

                      <OpsDrawer
                        open={editOpen}
                        eyebrow="Ubah Pengiriman"
                        title={`Perbarui ${selectedShipment.awb}`}
                        description="Form pengiriman dipisahkan ke drawer agar detail manifest tetap berada di halaman utama."
                        onClose={() => setEditOpen(false)}
                      >
                            <div className="space-y-5">
                              <SectionHeader
                                title="Tinjauan Operasional"
                                subtitle="Metadata dikelompokkan agar status aksi, penugasan, dan kepemilikan mudah direvisi."
                              />
                              <div className="ledger-form-grid pt-2">
                        <div>
                          <label className="label">Status</label>
                          <select
                            className="select-field"
                            value={drawerDraft.status}
                            onChange={(event) =>
                              setDrawerDraft((current) => ({ ...current, status: event.target.value }))
                            }
                          >
                            <option value="received">Diterima</option>
                            <option value="sortation">Sortasi</option>
                            <option value="loaded_to_aircraft">Muat ke Pesawat</option>
                            <option value="departed">Berangkat</option>
                            <option value="arrived">Tiba</option>
                            <option value="hold">Tertahan</option>
                          </select>
                        </div>
                        <div>
                          <label className="label">Penanggung Jawab</label>
                          <input
                            className="input-field"
                            value={drawerDraft.ownerName}
                            onChange={(event) =>
                              setDrawerDraft((current) => ({ ...current, ownerName: event.target.value }))
                            }
                          />
                        </div>
                        <div>
                          <label className="label">Tanggal Kirim</label>
                          <input
                            className="input-field"
                            type="date"
                            value={drawerDraft.sentAt}
                            onChange={(event) =>
                              setDrawerDraft((current) => ({ ...current, sentAt: event.target.value }))
                            }
                          />
                        </div>
                        <div>
                          <label className="label">Mode Cargo</label>
                          <select
                            className="select-field"
                            value={drawerDraft.cargoMode}
                            onChange={(event) =>
                              setDrawerDraft((current) => ({ ...current, cargoMode: event.target.value }))
                            }
                          >
                            {CARGO_MODE_OPTIONS.map((item) => (
                              <option key={item} value={item}>
                                {item}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="label">No Telepon</label>
                          <input
                            className="input-field"
                            type="tel"
                            inputMode="tel"
                            autoComplete="tel"
                            placeholder="Contoh: 08123456789"
                            value={drawerDraft.senderPhone}
                            onChange={(event) =>
                              setDrawerDraft((current) => ({ ...current, senderPhone: event.target.value }))
                            }
                          />
                          <p className="form-help">Format Indonesia, minimal 8 digit (08xx / +62xx).</p>
                        </div>
                        <div>
                          <label className="label">Nama Barang</label>
                          <input
                            className="input-field"
                            value={drawerDraft.commodity}
                            onChange={(event) =>
                              setDrawerDraft((current) => ({ ...current, commodity: event.target.value }))
                            }
                          />
                        </div>
                        <div>
                          <label className="label">Kota Asal</label>
                          <select
                            className="select-field"
                            value={drawerDraft.origin}
                            onChange={(event) =>
                              setDrawerDraft((current) => ({ ...current, origin: event.target.value }))
                            }
                          >
                            {STATION_OPTIONS.map((item) => (
                              <option key={item} value={item}>
                                {item}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="label">Kota Tujuan</label>
                          <select
                            className="select-field"
                            value={drawerDraft.destination}
                            onChange={(event) =>
                              setDrawerDraft((current) => ({
                                ...current,
                                destination: event.target.value,
                              }))
                            }
                          >
                            {STATION_OPTIONS.map((item) => (
                              <option key={item} value={item}>
                                {item}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="label">Berat Barang</label>
                          <input
                            className="input-field"
                            type="number"
                            step="0.1"
                            value={drawerDraft.weightKg}
                            onChange={(event) =>
                              setDrawerDraft((current) => ({ ...current, weightKg: Number(event.target.value) }))
                            }
                          />
                        </div>
                        <div>
                          <label className="label">Pieces</label>
                          <input
                            className="input-field"
                            type="number"
                            value={drawerDraft.pieces}
                            onChange={(event) =>
                              setDrawerDraft((current) => ({ ...current, pieces: Number(event.target.value) }))
                            }
                          />
                        </div>
                        <div>
                          <label className="label">Jenis Pengiriman</label>
                          <select
                            className="select-field"
                            value={drawerDraft.serviceType}
                            onChange={(event) =>
                              setDrawerDraft((current) => ({ ...current, serviceType: event.target.value }))
                            }
                          >
                            {SERVICE_TYPE_OPTIONS.map((item) => (
                              <option key={item} value={item}>
                                {item}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="label">Tarif Pengiriman</label>
                          <input
                            className="input-field"
                            type="number"
                            value={drawerDraft.shippingRate}
                            onChange={(event) =>
                              setDrawerDraft((current) => ({ ...current, shippingRate: Number(event.target.value) }))
                            }
                          />
                        </div>
                        <div>
                          <label className="label">Nama Kendaraan</label>
                          <input
                            className="input-field"
                            value={drawerDraft.vehicleName}
                            onChange={(event) =>
                              setDrawerDraft((current) => ({ ...current, vehicleName: event.target.value }))
                            }
                          />
                        </div>
                        <div>
                          <label className="label">Jenis Kendaraan</label>
                          <select
                            className="select-field"
                            value={drawerDraft.vehicleType}
                            onChange={(event) =>
                              setDrawerDraft((current) => ({ ...current, vehicleType: event.target.value }))
                            }
                          >
                            {VEHICLE_TYPE_OPTIONS.map((item) => (
                              <option key={item} value={item}>
                                {item}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="label">Kode Kendaraan</label>
                          <input
                            className="input-field"
                            value={drawerDraft.vehicleCode}
                            onChange={(event) =>
                              setDrawerDraft((current) => ({
                                ...current,
                                vehicleCode: event.target.value.toUpperCase(),
                              }))
                            }
                          />
                        </div>
                        <div>
                          <label className="label">Kapasitas Muatan</label>
                          <input
                            className="input-field"
                            type="number"
                            value={drawerDraft.vehicleCapacityKg}
                            onChange={(event) =>
                              setDrawerDraft((current) => ({
                                ...current,
                                vehicleCapacityKg: Number(event.target.value),
                              }))
                            }
                          />
                        </div>
                        <div>
                          <label className="label">Status Kendaraan</label>
                          <select
                            className="select-field"
                            value={drawerDraft.vehicleStatus}
                            onChange={(event) =>
                              setDrawerDraft((current) => ({ ...current, vehicleStatus: event.target.value }))
                            }
                          >
                            {VEHICLE_STATUS_OPTIONS.map((item) => (
                              <option key={item} value={item}>
                                {item}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="label">Status Barang</label>
                          <select
                            className="select-field"
                            value={drawerDraft.goodsStatus}
                            onChange={(event) =>
                              setDrawerDraft((current) => ({ ...current, goodsStatus: event.target.value }))
                            }
                          >
                            {GOODS_STATUS_OPTIONS.map((item) => (
                              <option key={item} value={item}>
                                {item}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="label">Status Transaksi</label>
                          <select
                            className="select-field"
                            value={drawerDraft.transactionStatus}
                            onChange={(event) =>
                              setDrawerDraft((current) => ({ ...current, transactionStatus: event.target.value }))
                            }
                          >
                            {TRANSACTION_STATUS_FORM_OPTIONS.map((item) => (
                              <option key={item} value={item}>
                                {item}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="label">Penerbangan</label>
                          <select
                            className="select-field"
                            value={drawerDraft.flightId}
                            onChange={(event) =>
                              setDrawerDraft((current) => ({ ...current, flightId: event.target.value }))
                            }
                          >
                            <option value="">Tanpa penerbangan</option>
                            {(data?.flights ?? []).map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.flightNumber}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="label">Akun Pelanggan</label>
                          <select
                            className="select-field"
                            value={drawerDraft.customerAccountId}
                            onChange={(event) =>
                              setDrawerDraft((current) => ({
                                ...current,
                                customerAccountId: event.target.value,
                              }))
                            }
                          >
                            <option value="">Tanpa akun pelanggan</option>
                            {(data?.customerAccounts ?? []).map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="label">Status Dokumen</label>
                          <input className="input-field input-readonly" value={selectedShipment.docStatus} readOnly />
                          <p className="form-help">Otomatis dari dokumen aktif dan bukti bayar.</p>
                        </div>
                        <div>
                          <label className="label">Kesiapan</label>
                          <input className="input-field input-readonly" value={selectedShipment.readiness} readOnly />
                          <p className="form-help">Siap jika dokumen lengkap, pembayaran aman, dan tidak hold.</p>
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

                              <div className="ops-sticky-footer mt-6 flex flex-wrap gap-3 rounded-[22px] border border-[color:var(--border-soft)] bg-[color:var(--panel-bg)] p-5 shadow-[0_-8px_24px_rgba(11,30,52,0.04)]">
                        <button type="button" className="btn btn-primary flex-1" onClick={saveShipmentChanges} disabled={saving}>
                          <Save size={16} />
                          {saving ? "Menyimpan..." : "Simpan Perubahan"}
                        </button>
                        <button type="button" className="btn btn-secondary" onClick={() => setEditOpen(false)}>
                          Batal
                        </button>
                        <button type="button" className="btn btn-danger" onClick={() => setConfirmShipmentDelete(true)}>
                          <Trash2 size={16} />
                          Hapus
                        </button>
                      </div>
                            </div>
                      </OpsDrawer>
                    </>
                  ) : (
	                      <div className="ledger-section-card rounded-[20px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)]">
                      <SectionHeader
                        title="Ringkasan Pelanggan"
                        subtitle="Portal pelanggan menampilkan status, ringkasan dokumen, dan kronologi tanpa aksi edit."
                      />
                      <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        <DataCard
                          label="Dokumen Aktif"
                          value={`${selectedShipment.documentSummary.count} berkas`}
                          note={
                            selectedShipment.documentSummary.latestUploadedAt
                              ? `Unggah terakhir ${formatDateTime(selectedShipment.documentSummary.latestUploadedAt)}`
                              : "Belum ada waktu unggah"
                          }
                        />
                        <DataCard
                          label="Kesiapan"
                          value={selectedShipment.readiness}
                          note="Status kesiapan yang dibagikan ke akun pelanggan"
                        />
                      </div>
                    </div>
                  )}

                  {!isReadOnly ? (
	                    <div className="ledger-section-card rounded-[20px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)]">
                      <SectionHeader
                        title="Dokumen Aktif"
                        subtitle="Unggah dan penghapusan berkas tetap dekat dengan detail pengiriman yang sedang dipilih."
                      />
	                      <div className="mt-4 space-y-3">
                        {selectedShipment.documents.length ? (
                          selectedShipment.documents.map((document) => (
                            <div
                              key={document.id}
                              className="rounded-[22px] border border-[color:var(--border-soft)] bg-[color:var(--panel-bg)] px-4 py-4"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="break-words font-semibold text-[color:var(--text-strong)]">{document.fileName}</p>
                                  <p className="mt-1 text-xs text-[color:var(--muted-fg)]">
                                    {formatDateTime(document.createdAt)}
                                  </p>
                                  {document.paymentVerifiedAt ? (
                                    <p className="mt-2 text-xs font-semibold text-[color:var(--tone-info)]">
                                      Bukti bayar terverifikasi {formatDateTime(document.paymentVerifiedAt)}
                                    </p>
                                  ) : null}
                                </div>
                                <div className="flex flex-wrap justify-end gap-2">
                                  <a
                                    href={document.storageUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="topbar-button"
                                  >
                                    <ExternalLink size={16} />
                                    Buka Dokumen
                                  </a>
                                  {!document.paymentVerifiedAt && selectedShipment.shippingRate > 0 && data?.permissions.canVerifyPayment ? (
                                    <button
                                      type="button"
                                      className="topbar-button"
                                      onClick={() => void handleVerifyPaymentDocument(document.id)}
                                      disabled={saving}
                                    >
                                      <Save size={16} />
                                      Verifikasi Bayar
                                    </button>
                                  ) : null}
                                  {data?.permissions.canDocument ? (
                                    <button
                                      type="button"
                                      className="topbar-button"
                                      onClick={() => setConfirmDocumentDelete(document.id)}
                                      aria-label="Hapus dokumen"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-[color:var(--muted-fg)]">Belum ada dokumen aktif.</p>
                        )}
                      </div>
                    </div>
                  ) : null}

	                  <div className="ledger-section-card rounded-[20px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)]">
                    <SectionHeader
                      title="Linimasa Pelacakan"
                      subtitle="Hubungan visual antara manifest board dan panel detail dijaga lewat event log yang tetap kronologis."
                    />
	                    <div className="mt-4 space-y-3">
	                      {selectedShipment.trackingLogs.slice(0, 4).map((log) => (
                        <div
                          key={log.id}
                          className="rounded-[22px] border border-[color:var(--border-soft)] bg-[color:var(--panel-bg)] px-4 py-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-[color:var(--text-strong)]">{log.label}</p>
                              <p className="mt-2 text-sm leading-6 text-[color:var(--muted-fg)]">{log.message}</p>
                            </div>
                            <StatusBadge value={log.status} label={log.label} />
                          </div>
                          <div className="mt-3 flex flex-wrap gap-3 text-xs text-[color:var(--muted-2)]">
                            <span>{formatDateTime(log.createdAt)}</span>
                            <span>•</span>
                            <span>{log.location}</span>
                            <span>•</span>
                            <span>{log.actorName || "Sistem"}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
	            </>
	        </OpsPanel>
        ) : null}
      </div>

      <OpsDrawer
        open={createOpen}
        eyebrow="Buat Pengiriman"
        title="Tambah manifest baru"
        description="AWB dapat diisi manual atau dibuat otomatis. Form dipecah berdasarkan identitas kiriman, rute, kargo, penugasan, dan catatan."
        onClose={() => setCreateOpen(false)}
      >
            <form className="space-y-6" onSubmit={submitCreate}>
              <div className="rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-5">
                <SectionHeader title="Identitas Pengiriman" subtitle="Identifier utama dan kepemilikan operasional." />
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="label">AWB</label>
                    <input
                      className="input-field"
                      placeholder="Kosongkan untuk generate otomatis"
                      pattern="\d{3}-\d{8}"
                      title="Format AWB: 3 digit - 8 digit (contoh 123-45678901), atau kosongkan."
                      value={form.awb}
                      onChange={(event) => setForm((current) => ({ ...current, awb: event.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="label">Tanggal Kirim</label>
                    <input
                      className="input-field"
                      type="date"
                      value={form.sentAt}
                      onChange={(event) => setForm((current) => ({ ...current, sentAt: event.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="label">Komoditas</label>
                    <input
                      className="input-field"
                      placeholder="Komoditas"
                      required
                      minLength={2}
                      value={form.commodity}
                      onChange={(event) => setForm((current) => ({ ...current, commodity: event.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="label">Mode Cargo</label>
                    <select
                      className="select-field"
                      value={form.cargoMode}
                      onChange={(event) => setForm((current) => ({ ...current, cargoMode: event.target.value }))}
                    >
                      {CARGO_MODE_OPTIONS.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Penanggung Jawab</label>
                    <input
                      className="input-field"
                      placeholder="Penanggung jawab"
                      required
                      minLength={2}
                      value={form.ownerName}
                      onChange={(event) => setForm((current) => ({ ...current, ownerName: event.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="label">No Telepon</label>
                    <input
                      className="input-field"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      required
                      pattern="(\+62|62|0)8[1-9][0-9]{6,11}"
                      title="No telepon Indonesia, contoh 08123456789."
                      placeholder="Contoh: 08123456789"
                      value={form.senderPhone}
                      onChange={(event) => setForm((current) => ({ ...current, senderPhone: event.target.value }))}
                    />
                    <p className="form-help">Format Indonesia, minimal 8 digit (08xx / +62xx).</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-5">
                <SectionHeader title="Routing & Kargo" subtitle="Asal-tujuan, pieces, berat, dan penanganan khusus." />
                <div className="mt-5 grid gap-4 md:grid-cols-4">
                  <div>
                    <label className="label">Asal</label>
                    <select
                      className="select-field"
                      value={form.origin}
                      onChange={(event) => setForm((current) => ({ ...current, origin: event.target.value }))}
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
                      value={form.destination}
                      onChange={(event) => setForm((current) => ({ ...current, destination: event.target.value }))}
                    >
                      {STATION_OPTIONS.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Pieces</label>
                    <input
                      className="input-field"
                      type="number"
                      min={1}
                      step={1}
                      required
                      value={form.pieces}
                      onChange={(event) => setForm((current) => ({ ...current, pieces: Number(event.target.value) }))}
                    />
                  </div>
                  <div>
                    <label className="label">Berat</label>
                    <input
                      className="input-field"
                      type="number"
                      min={0.1}
                      step={0.1}
                      required
                      value={form.weightKg}
                      onChange={(event) => setForm((current) => ({ ...current, weightKg: Number(event.target.value) }))}
                    />
                  </div>
                  <div>
                    <label className="label">Volume</label>
                    <input
                      className="input-field"
                      type="number"
                      step="0.1"
                      value={form.volumeM3}
                      onChange={(event) => setForm((current) => ({ ...current, volumeM3: Number(event.target.value) }))}
                    />
                  </div>
                  <div>
                    <label className="label">Jenis Pengiriman</label>
                    <select
                      className="select-field"
                      value={form.serviceType}
                      onChange={(event) => setForm((current) => ({ ...current, serviceType: event.target.value }))}
                    >
                      {SERVICE_TYPE_OPTIONS.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Tarif Pengiriman</label>
                    <input
                      className="input-field"
                      type="number"
                      min={0}
                      step={1000}
                      value={form.shippingRate}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, shippingRate: Number(event.target.value) }))
                      }
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
                <SectionHeader title="Kendaraan & Status" subtitle="Data kendaraan, status barang, dan transaksi." />
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="label">Nama Kendaraan</label>
                    <input
                      className="input-field"
                      value={form.vehicleName}
                      onChange={(event) => setForm((current) => ({ ...current, vehicleName: event.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="label">Jenis Kendaraan</label>
                    <select
                      className="select-field"
                      value={form.vehicleType}
                      onChange={(event) => setForm((current) => ({ ...current, vehicleType: event.target.value }))}
                    >
                      {VEHICLE_TYPE_OPTIONS.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Kode Kendaraan</label>
                    <input
                      className="input-field"
                      value={form.vehicleCode}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, vehicleCode: event.target.value.toUpperCase() }))
                      }
                    />
                  </div>
                  <div>
                    <label className="label">Kapasitas Muatan</label>
                    <input
                      className="input-field"
                      type="number"
                      min={1}
                      step={1}
                      value={form.vehicleCapacityKg}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, vehicleCapacityKg: Number(event.target.value) }))
                      }
                    />
                  </div>
                  <div>
                    <label className="label">Status Kendaraan</label>
                    <select
                      className="select-field"
                      value={form.vehicleStatus}
                      onChange={(event) => setForm((current) => ({ ...current, vehicleStatus: event.target.value }))}
                    >
                      {VEHICLE_STATUS_OPTIONS.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Status Barang</label>
                    <input className="input-field input-readonly" value="Diproses" readOnly />
                    <p className="form-help">Otomatis dari alur kerja pengiriman.</p>
                  </div>
                  <div>
                    <label className="label">Status Transaksi</label>
                    <input className="input-field input-readonly" value={getDraftTransactionStatus(form.shippingRate)} readOnly />
                    <p className="form-help">Tidak dapat dipilih manual.</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-5">
                <SectionHeader title="Kontak & Relasi" subtitle="Pengirim, penerima, ekspeditor, penerbangan, dan akun pelanggan." />
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="label">Pengirim</label>
                    <input
                      className="input-field"
                      placeholder="Nama pengirim"
                      required
                      minLength={2}
                      value={form.shipper}
                      onChange={(event) => setForm((current) => ({ ...current, shipper: event.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="label">Penerima</label>
                    <input
                      className="input-field"
                      placeholder="Nama penerima"
                      required
                      minLength={2}
                      value={form.consignee}
                      onChange={(event) => setForm((current) => ({ ...current, consignee: event.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="label">Ekspeditor</label>
                    <input
                      className="input-field"
                      placeholder="Nama ekspeditor"
                      required
                      minLength={2}
                      value={form.forwarder}
                      onChange={(event) => setForm((current) => ({ ...current, forwarder: event.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="label">Penerbangan</label>
                    <select
                      className="select-field"
                      value={form.flightId}
                      onChange={(event) => setForm((current) => ({ ...current, flightId: event.target.value }))}
                    >
                      <option value="">Tanpa penerbangan</option>
                      {(data?.flights ?? []).map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.flightNumber}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Akun Pelanggan</label>
                    <select
                      className="select-field"
                      value={form.customerAccountId}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, customerAccountId: event.target.value }))
                      }
                    >
                      <option value="">Tanpa akun pelanggan</option>
                      {(data?.customerAccounts ?? []).map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
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

              <div className="flex flex-wrap justify-end gap-3">
                <button type="button" className="btn btn-secondary" onClick={() => setCreateOpen(false)}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Menyimpan..." : "Buat Pengiriman"}
                </button>
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

      <ConfirmDialog
        open={confirmDocumentDelete !== null}
        title="Hapus dokumen ini?"
        description="Dokumen akan dihapus dari pengiriman dan tidak lagi tampil di tampilan kerja. Tindakan ini tidak bisa dibatalkan."
        confirmLabel="Ya, hapus dokumen"
        tone="danger"
        onConfirm={() => {
          const documentId = confirmDocumentDelete;
          setConfirmDocumentDelete(null);
          if (documentId) void handleDeleteDocument(documentId);
        }}
        onCancel={() => setConfirmDocumentDelete(null)}
      />
    </main>
  );
}
