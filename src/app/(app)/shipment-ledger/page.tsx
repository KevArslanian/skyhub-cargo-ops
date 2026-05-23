"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { startTransition, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  Boxes,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  FileText,
  FolderOpen,
  PackageSearch,
  Pencil,
  PlaneTakeoff,
  Plus,
  RefreshCw,
  Save,
  ShieldAlert,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { cn, formatDateTime, formatRelativeShort, formatWeight } from "@/lib/format";
import {
  CARGO_MODE_OPTIONS,
  SERVICE_TYPE_OPTIONS,
  STATION_OPTIONS,
  VEHICLE_STATUS_OPTIONS,
  VEHICLE_TYPE_OPTIONS,
} from "@/lib/constants";
import { StatusBadge } from "@/components/status-badge";
import {
  DataCard,
  EmptyState,
  FilterBar,
  OpsPanel,
  PageHeader,
  SectionHeader,
  SkeletonBlock,
} from "@/components/ops-ui";

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
      label: "Belum ada shipment",
      copy: "Pilih baris manifest untuk membuka detail operasional dan review state.",
    };
  }

  if (shipment.status === "hold") {
    return {
      tone: "danger" as const,
      badgeValue: "error",
      label: "Perlu eskalasi",
      copy: "Shipment sedang tertahan dan harus ditinjau sebelum proses diteruskan.",
    };
  }

  if (shipment.docStatus.toLowerCase() !== "complete") {
    return {
      tone: "warning" as const,
      badgeValue: "review",
      label: "Dokumen belum bersih",
      copy: `Status dokumen saat ini ${shipment.docStatus}. Pastikan file lengkap sebelum assignment final.`,
    };
  }

  if (shipment.readiness.toLowerCase() !== "ready") {
    return {
      tone: "warning" as const,
      badgeValue: "review",
      label: "Kesiapan perlu dicek",
      copy: `Readiness tercatat ${shipment.readiness}. Operator perlu verifikasi lapangan.`,
    };
  }

  return {
    tone: "success" as const,
    badgeValue: "success",
    label: "Siap diproses",
    copy: "Status, dokumen, dan readiness saat ini tidak menunjukkan exception aktif.",
  };
}

function getConfidenceState(shipment: ShipmentRow | null) {
  if (!shipment) {
    return {
      badgeValue: "info",
      label: "Menunggu data",
      copy: "Confidence akan dihitung setelah shipment dipilih.",
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
  const [refreshing, setRefreshing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string>("");
  const [form, setForm] = useState(() => createBlankForm());
  const [drawerDraft, setDrawerDraft] = useState(() => createDrawerDraft(null));
  const [listPage, setListPage] = useState(1);
  const selectedIdRef = useRef<string | null>(null);
  const hasLoadedRef = useRef(false);

  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    function handleContextSearch(event: Event) {
      const detail = (event as CustomEvent<{ pathname?: string; query?: string }>).detail;
      if (detail?.pathname !== "/shipment-ledger" || !detail.query) return;
      setQuery(detail.query);
      setListPage(1);
    }

    window.addEventListener("skyhub:context-search", handleContextSearch as EventListener);
    return () => window.removeEventListener("skyhub:context-search", handleContextSearch as EventListener);
  }, []);

  const applyShipmentPayload = useCallback((payload: LedgerPayload, preferredShipmentId?: string | null) => {
    const resolvedPreferredShipmentId = preferredShipmentId ?? null;
      const nextSelectedShipment =
        payload.shipments.find((shipment) => shipment.id === resolvedPreferredShipmentId) ?? payload.shipments[0] ?? null;

      startTransition(() => {
        setData(payload);
        setSelectedId(nextSelectedShipment?.id ?? null);
        setDrawerDraft(createDrawerDraft(nextSelectedShipment));
      });
    }, []);

  const requestShipments = useCallback(async () => {
    const params = new URLSearchParams();
    if (deferredQuery.trim()) params.set("query", deferredQuery.trim());
    if (status !== "all") params.set("status", status);
    if (flight !== "all") params.set("flight", flight);
    if (sortBy) params.set("sortBy", sortBy);

    const response = await fetch(`/api/shipments?${params.toString()}`, { cache: "no-store" });
    if (!response.ok) return null;

    return (await response.json()) as LedgerPayload;
  }, [deferredQuery, flight, sortBy, status]);

  const loadShipments = useCallback(
    async (preferredShipmentId: string | null = selectedIdRef.current, mode: "initial" | "refresh" = "refresh") => {
      if (mode === "initial") {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      const payload = await requestShipments();
      if (payload) {
        applyShipmentPayload(payload, preferredShipmentId);
        setLastSyncedAt(new Date().toISOString());
      }

      setLoading(false);
      setRefreshing(false);
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

  const totalWeight = useMemo(
    () => (data?.shipments ?? []).reduce((sum, shipment) => sum + shipment.weightKg, 0),
    [data?.shipments],
  );

  const holdCount = (data?.shipments ?? []).filter((shipment) => shipment.status === "hold").length;
  const assignedFlightCount = (data?.shipments ?? []).filter((shipment) => shipment.flightNumber).length;
  const pendingDocsCount = (data?.shipments ?? []).filter(
    (shipment) => shipment.docStatus.toLowerCase() !== "complete",
  ).length;
  const readinessIssuesCount = (data?.shipments ?? []).filter(
    (shipment) => shipment.readiness.toLowerCase() !== "ready",
  ).length;
  const activeFilterCount = [Boolean(deferredQuery.trim()), status !== "all", flight !== "all", sortBy !== "updated"].filter(
    Boolean,
  ).length;

  const exportParams = new URLSearchParams();
  if (deferredQuery.trim()) exportParams.set("query", deferredQuery.trim());
  if (status !== "all") exportParams.set("status", status);
  if (flight !== "all") exportParams.set("flight", flight);
  if (sortBy) exportParams.set("sortBy", sortBy);

  const isReadOnly = data?.viewer.readOnly ?? false;
  const urgencyState = getUrgencyState(selectedShipment);
  const confidenceState = getConfidenceState(selectedShipment);
  const listPageSize = 10;
  const shipments = data?.shipments ?? [];
  const totalPages = Math.max(1, Math.ceil(shipments.length / listPageSize));
  const pageStart = (listPage - 1) * listPageSize;
  const pagedShipments = shipments.slice(pageStart, pageStart + listPageSize);

  useEffect(() => {
    setListPage(1);
  }, [deferredQuery, flight, sortBy, status]);

  useEffect(() => {
    if (listPage <= totalPages) return;
    setListPage(totalPages);
  }, [listPage, totalPages]);

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
      setActionNotice("Shipment berhasil dibuat.");
      void loadShipments(payload.shipment?.id ?? selectedId, "refresh");
    } else {
      setActionNotice(await resolveErrorMessage(response, "Gagal membuat shipment."));
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
      setActionNotice("Perubahan shipment berhasil disimpan.");
      void loadShipments(selectedShipment.id, "refresh");
    } else {
      setActionNotice(await resolveErrorMessage(response, "Gagal menyimpan shipment."));
    }

    setSaving(false);
  }

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    if (!selectedShipment || !event.target.files?.[0]) return;
    const file = event.target.files[0];
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(`/api/shipments/${selectedShipment.id}/documents`, {
      method: "POST",
      body: formData,
    });

    if (response.ok) {
      setActionNotice("Dokumen berhasil diunggah dan tersimpan di database.");
      await loadShipments(selectedShipment.id, "refresh");
    } else {
      setActionNotice(await resolveErrorMessage(response, "Gagal mengunggah dokumen. Gunakan PDF, JPG, atau JPEG."));
    }

    event.target.value = "";
  }

  async function handleDeleteDocument(documentId: string) {
    if (!selectedShipment) return;

    const response = await fetch(`/api/shipments/${selectedShipment.id}/documents/${documentId}`, {
      method: "DELETE",
    });

    const payload = (await response.json()) as { warning?: string | null };
    if (response.ok) {
      setActionNotice(payload.warning || "Dokumen berhasil dihapus dari tampilan kerja.");
      await loadShipments(selectedShipment.id, "refresh");
    }
  }

  async function handleVerifyPaymentDocument(documentId: string) {
    if (!selectedShipment) return;

    setSaving(true);
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
      setActionNotice("Pembayaran berhasil diverifikasi admin.");
    } else {
      setActionNotice(await resolveErrorMessage(response, "Gagal verifikasi pembayaran."));
    }

    setSaving(false);
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
      setActionNotice(`Shipment ${selectedShipment.awb} berhasil dihapus dari database.`);
      void loadShipments(null, "refresh");
    } else {
      setActionNotice(await resolveErrorMessage(response, "Gagal menghapus shipment."));
    }
  }

  function handlePageChange(nextPage: number) {
    const clamped = Math.min(Math.max(nextPage, 1), totalPages);
    setListPage(clamped);
    const firstOnNextPage = shipments[(clamped - 1) * listPageSize] ?? null;

    if (firstOnNextPage) {
      handleSelectShipment(firstOnNextPage.id);
    }
  }

  return (
    <div className="page-workspace">
      <PageHeader
        eyebrow="Kontrol Manifest"
        title={isReadOnly ? "Shipment Saya" : "Ledger Shipment"}
        subtitle={
          isReadOnly
            ? `Daftar shipment milik ${data?.viewer.customerAccountName || "akun Anda"}.`
            : "Tambah, cari, ubah, dan hapus shipment."
        }
        actions={
          <>
            {!isReadOnly && data?.permissions.canExport ? (
              <Link href={`/exports/shipments?${exportParams.toString()}`} className="btn btn-secondary">
                <FileText size={16} />
                PDF / Print
              </Link>
            ) : null}
            {data?.permissions.canCreate ? (
              <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
                <Plus size={16} />
                Buat Shipment
              </button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-4">
        <DataCard
          label="Total Shipment"
          value={data?.shipments.length ?? 0}
          note="Data tampil."
          meta={`${activeFilterCount} filter aktif${lastSyncedAt ? ` • Sinkron ${formatRelativeShort(lastSyncedAt)}` : ""}`}
          icon={Boxes}
          tone="primary"
        />
        <DataCard
          label="Berat Total"
          value={formatWeight(totalWeight)}
          note="Total berat."
          meta={`${assignedFlightCount} shipment sudah assigned ke flight`}
          icon={PackageSearch}
          tone="info"
        />
        <DataCard
          label="Assigned Flight"
          value={assignedFlightCount}
          note="Terhubung flight."
          meta={`${(data?.flights ?? []).length} pilihan flight tersedia`}
          icon={PlaneTakeoff}
          tone="success"
        />
        <DataCard
          label="Perlu Review"
          value={pendingDocsCount + holdCount + readinessIssuesCount}
          note="Hold, dokumen, readiness."
          meta={`${holdCount} hold • ${pendingDocsCount} dokumen • ${readinessIssuesCount} readiness`}
          icon={CircleAlert}
          tone="warning"
        />
      </div>

      <FilterBar className="xl:grid-cols-[minmax(0,1.45fr)_170px_170px_200px]">
        <div>
          <label className="label">Cari Shipment</label>
          <input
            className="input-field"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="AWB, pengirim, penerima, barang, kendaraan..."
          />
        </div>
        <div>
          <label className="label">Status</label>
          <select className="select-field" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">Semua</option>
            <option value="received">Diterima</option>
            <option value="sortation">Sortasi</option>
            <option value="loaded_to_aircraft">Muat ke Pesawat</option>
            <option value="departed">Berangkat</option>
            <option value="arrived">Tiba</option>
            <option value="hold">Tertahan</option>
          </select>
        </div>
        <div>
          <label className="label">Flight</label>
          <select className="select-field" value={flight} onChange={(event) => setFlight(event.target.value)}>
            <option value="all">Semua</option>
            {(data?.flights ?? []).map((item) => (
              <option key={item.id} value={item.flightNumber}>
                {item.flightNumber}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Urutan</label>
          <select className="select-field" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
            <option value="updated">Update Terbaru</option>
            <option value="received">Penerimaan Terbaru</option>
            <option value="priority">Prioritas Review</option>
          </select>
        </div>
      </FilterBar>

      {actionNotice ? (
        <div className="rounded-[18px] border border-[color:var(--tone-info-border)] bg-[color:var(--tone-info-soft)] px-4 py-3 text-sm font-medium text-[color:var(--tone-info)]">
          {actionNotice}
        </div>
      ) : null}

      <div className="page-grid-2 split-pane-shell">
        <OpsPanel className="page-pane split-pane-left internal-scrollbar flex min-h-0 flex-col overflow-hidden p-0">
          <div className="border-b border-[color:var(--border-soft)] p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="ops-eyebrow">Manifest Board</p>
                <h2 className="mt-2 font-[family:var(--font-heading)] text-[1.55rem] font-extrabold tracking-[-0.04em] text-[color:var(--text-strong)]">
                  Papan manifest aktif
                </h2>
                <p className="mt-2 text-sm leading-7 text-[color:var(--muted-fg)]">
                  Daftar ringkas AWB. Detail lengkap dibaca di panel kanan.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge value={refreshing ? "live" : "synced"} label={refreshing ? "Memuat ulang" : "Tersinkron"} />
                {lastSyncedAt ? (
                  <span className="inline-flex min-h-[36px] items-center gap-2 rounded-full border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-3 text-xs font-semibold text-[color:var(--muted-fg)]">
                    <RefreshCw size={13} className={cn(refreshing && "animate-spin")} />
                    {formatDateTime(lastSyncedAt)}
                  </span>
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
            <div className="min-h-0 flex-1 p-5">
              {(data?.shipments ?? []).length ? (
                <div className="space-y-3">
                  {pagedShipments.map((shipment) => {
                    const isSelected = selectedShipment?.id === shipment.id;
                    const needsAttention =
                      shipment.status === "hold" ||
                      shipment.docStatus.toLowerCase() !== "complete" ||
                      shipment.readiness.toLowerCase() !== "ready";

                    return (
                      <button
                        key={shipment.id}
                        type="button"
                        onClick={() => handleSelectShipment(shipment.id)}
                        className={cn(
                          "w-full rounded-[22px] border px-4 py-4 text-left transition-colors",
                          isSelected
                            ? "border-[color:var(--brand-primary)] bg-[color:var(--brand-primary-soft)]"
                            : "border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] hover:bg-[color:var(--brand-primary-soft)]",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-mono text-sm font-semibold text-[color:var(--brand-primary)]">{shipment.awb}</p>
                            <p className="mt-1 truncate text-sm font-semibold text-[color:var(--text-strong)]">{shipment.commodity}</p>
                            <p className="mt-1 truncate text-xs text-[color:var(--muted-fg)]">
                              {shipment.origin} {" -> "} {shipment.destination}
                            </p>
                            <p className="mt-1 truncate text-xs text-[color:var(--muted-fg)]">
                              {shipment.customerAccountName || shipment.shipper}
                            </p>
                            <p className="mt-1 truncate text-xs text-[color:var(--muted-fg)]">
                              {shipment.cargoMode} • {shipment.serviceType} • {shipment.senderPhone}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <StatusBadge value={shipment.status} label={shipment.statusLabel} />
                            <p className="mt-2 text-xs text-[color:var(--muted-fg)]">{formatRelativeShort(shipment.updatedAt)}</p>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[color:var(--muted-fg)]">
                          <span>{formatWeight(shipment.weightKg)}</span>
                          <span>•</span>
                          <span>{shipment.pieces} pcs</span>
                          <span>•</span>
                          <span>{shipment.flightNumber || "Belum assigned"}</span>
                          <span>•</span>
                          <span>{shipment.vehicleCode || shipment.vehicleType}</span>
                          {needsAttention ? (
                            <>
                              <span>•</span>
                              <span className="font-semibold text-[color:var(--tone-warning)]">Butuh review</span>
                            </>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}

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
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--muted-fg)]">
                      Halaman {listPage} / {totalPages}
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
                  icon={PackageSearch}
                  title="Tidak ada shipment yang cocok"
                  copy="Ubah kata kunci atau filter untuk melihat shipment lain yang tersedia di manifest."
                  className="m-0"
                />
              )}
            </div>
          )}
        </OpsPanel>

        <OpsPanel className="page-pane split-pane-right flex min-h-0 flex-col overflow-hidden p-0">
          {selectedShipment ? (
            <>
              <div className="border-b border-[color:var(--border-soft)] p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="ops-eyebrow">Detail Shipment</p>
                    <div className="mt-2 flex flex-wrap items-end gap-3">
                      <h2 className="font-[family:var(--font-heading)] text-[2rem] font-black tracking-[-0.05em] text-[color:var(--brand-primary)]">
                        {selectedShipment.awb}
                      </h2>
                      <StatusBadge value={selectedShipment.status} label={selectedShipment.statusLabel} />
                    </div>
                    <p className="mt-2 text-sm leading-7 text-[color:var(--muted-fg)]">
                      {selectedShipment.commodity} • {selectedShipment.origin} &rarr; {selectedShipment.destination}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge value={urgencyState.badgeValue} label={urgencyState.label} />
                    <StatusBadge value={confidenceState.badgeValue} label={`Confidence ${confidenceState.label}`} />
                  </div>
                </div>

                <div
                  className={cn(
                    "mt-5 rounded-[22px] border px-4 py-4 text-sm leading-7",
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
                <div className="ledger-info-grid">
                  <DataCard
                    label="Tanggal Kirim"
                    value={formatDateTime(selectedShipment.sentAt)}
                    note={`Update ${formatRelativeShort(selectedShipment.updatedAt)}`}
                    icon={Clock3}
                  />
                  <DataCard
                    label="Flight"
                    value={selectedShipment.flightNumber || "-"}
                    note="Assignment aktif"
                    icon={PlaneTakeoff}
                    tone={selectedShipment.flightNumber ? "info" : "default"}
                  />
                  <DataCard
                    label="Pengirim / Penerima"
                    value={selectedShipment.customerAccountName || selectedShipment.shipper}
                    note={`${selectedShipment.consignee} • ${selectedShipment.senderPhone}`}
                    icon={FolderOpen}
                  />
                  <DataCard
                    label="Dokumen"
                    value={selectedShipment.docStatus}
                    note={`${selectedShipment.documentSummary.count} file aktif`}
                    icon={FileText}
                    tone={selectedShipment.docStatus.toLowerCase() === "complete" ? "success" : "warning"}
                  />
                  <DataCard
                    label="Jenis Pengiriman"
                    value={selectedShipment.serviceType}
                    note={`${selectedShipment.cargoMode} • Rp ${selectedShipment.shippingRate.toLocaleString("id-ID")}`}
                    icon={PackageSearch}
                    tone="info"
                  />
                  <DataCard
                    label="Kendaraan"
                    value={selectedShipment.vehicleName || selectedShipment.vehicleType}
                    note={`${selectedShipment.vehicleCode || "-"} • ${selectedShipment.vehicleCapacityKg} kg`}
                    icon={PlaneTakeoff}
                    tone={selectedShipment.vehicleStatus === "Aktif" ? "success" : "warning"}
                  />
                  <DataCard
                    label="Status Barang"
                    value={selectedShipment.goodsStatus}
                    note={`Transaksi: ${selectedShipment.transactionStatus}`}
                    icon={Boxes}
                    tone={selectedShipment.goodsStatus === "Selesai" ? "success" : "default"}
                  />
                  <DataCard
                    label="Barang"
                    value={selectedShipment.commodity}
                    note={`${selectedShipment.pieces} pcs • ${formatWeight(selectedShipment.weightKg)}`}
                    icon={PackageSearch}
                  />
                </div>

                <div className="section-stack-gap mt-6">
                  {!isReadOnly ? (
                    <>
                      <div className="ledger-section-card rounded-[26px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)]">
                        <SectionHeader
                          title="Review Operasional"
                          subtitle="Mode baca. Tekan Edit Shipment untuk mengubah metadata operasional."
                        />
                        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          <DataCard label="Status" value={selectedShipment.statusLabel} note={`Dokumen: ${selectedShipment.docStatus}`} />
                          <DataCard label="Penanggung Jawab" value={selectedShipment.ownerName || "-"} note={selectedShipment.senderPhone || "No telepon kosong"} />
                          <DataCard label="Tanggal Kirim" value={formatDateInput(selectedShipment.sentAt)} note={`${selectedShipment.cargoMode} • ${selectedShipment.serviceType}`} />
                          <DataCard label="Rute" value={`${selectedShipment.origin} -> ${selectedShipment.destination}`} note={selectedShipment.flightNumber || "Tanpa flight"} />
                          <DataCard label="Muatan" value={`${selectedShipment.pieces} pcs`} note={formatWeight(selectedShipment.weightKg)} />
                          <DataCard label="Tarif" value={`Rp ${selectedShipment.shippingRate.toLocaleString("id-ID")}`} note={`Transaksi: ${selectedShipment.transactionStatus}`} />
                          <DataCard label="Kendaraan" value={selectedShipment.vehicleName || selectedShipment.vehicleType} note={`${selectedShipment.vehicleCode || "-"} • ${selectedShipment.vehicleStatus}`} />
                          <DataCard label="Akun Pelanggan" value={selectedShipment.customerAccountName || "-"} note={selectedShipment.customerAccountId ? "Terhubung" : "Tanpa akun"} />
                          <DataCard label="Kesiapan" value={selectedShipment.readiness} note={`Barang: ${selectedShipment.goodsStatus}`} />
                        </div>
                        {selectedShipment.notes ? (
                          <div className="mt-4 rounded-[22px] border border-[color:var(--border-soft)] bg-[color:var(--panel-bg)] px-4 py-4 text-sm leading-6 text-[color:var(--muted-fg)]">
                            {selectedShipment.notes}
                          </div>
                        ) : null}
                        <div className="mt-6 flex flex-wrap gap-3 rounded-[22px] border border-[color:var(--border-soft)] bg-[color:var(--panel-bg)] p-5">
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
                              Edit Shipment
                            </button>
                          ) : null}
                          {data?.permissions.canDocument ? (
                            <label className="btn btn-secondary flex-1 cursor-pointer">
                              <Upload size={16} />
                              Upload Dokumen
                              <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,application/pdf,image/jpeg" onChange={handleUpload} />
                            </label>
                          ) : null}
                          {data?.permissions.canDelete ? (
                            <button type="button" className="btn btn-warning" onClick={handleDeleteShipment}>
                              <Trash2 size={16} />
                              Hapus
                            </button>
                          ) : null}
                        </div>
                      </div>

                      {editOpen ? (
                        <div className="ops-modal-backdrop" onClick={() => setEditOpen(false)}>
                          <div className="ops-modal-panel" onClick={(event) => event.stopPropagation()}>
                            <div className="flex items-start justify-between gap-4 border-b border-[color:var(--border-soft)] pb-5">
                              <div>
                                <p className="ops-eyebrow">Edit Shipment</p>
                                <h2 className="mt-2 font-[family:var(--font-heading)] text-[2rem] font-black tracking-[-0.05em] text-[color:var(--text-strong)]">
                                  Perbarui {selectedShipment.awb}
                                </h2>
                                <p className="mt-2 text-sm text-[color:var(--muted-fg)]">
                                  Semua perubahan disimpan setelah tombol Simpan Perubahan ditekan.
                                </p>
                              </div>
                              <button type="button" className="topbar-button" onClick={() => setEditOpen(false)}>
                                <X size={16} />
                              </button>
                            </div>
                            <div className="mt-6 space-y-5">
                              <SectionHeader
                                title="Review Operasional"
                                subtitle="Metadata dikelompokkan agar status action, assignment, dan ownership mudah direvisi."
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
                            value={drawerDraft.senderPhone}
                            onChange={(event) =>
                              setDrawerDraft((current) => ({ ...current, senderPhone: event.target.value }))
                            }
                          />
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
                          <input className="input-field" value={selectedShipment.goodsStatus} readOnly />
                          <p className="form-help">Otomatis dari status workflow shipment.</p>
                        </div>
                        <div>
                          <label className="label">Status Transaksi</label>
                          <input className="input-field" value={selectedShipment.transactionStatus} readOnly />
                          <p className="form-help">Otomatis dari tarif dan bukti pembayaran terverifikasi admin.</p>
                        </div>
                        <div>
                          <label className="label">Flight</label>
                          <select
                            className="select-field"
                            value={drawerDraft.flightId}
                            onChange={(event) =>
                              setDrawerDraft((current) => ({ ...current, flightId: event.target.value }))
                            }
                          >
                            <option value="">Tanpa flight</option>
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
                          <input className="input-field" value={selectedShipment.docStatus} readOnly />
                          <p className="form-help">Otomatis dari dokumen aktif dan bukti bayar.</p>
                        </div>
                        <div>
                          <label className="label">Kesiapan</label>
                          <input className="input-field" value={selectedShipment.readiness} readOnly />
                          <p className="form-help">Ready jika dokumen complete, pembayaran aman, dan tidak hold.</p>
                        </div>
                        <div className="md:col-span-2">
                          <label className="label">Catatan Review</label>
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
                        <button type="button" className="btn btn-warning" onClick={handleDeleteShipment}>
                          <Trash2 size={16} />
                          Hapus
                        </button>
                      </div>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className="ledger-section-card rounded-[26px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)]">
                      <SectionHeader
                        title="Ringkasan Pelanggan"
                        subtitle="Portal pelanggan menampilkan status, ringkasan dokumen, dan kronologi tanpa aksi edit."
                      />
                      <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        <DataCard
                          label="Dokumen Aktif"
                          value={`${selectedShipment.documentSummary.count} file`}
                          note={
                            selectedShipment.documentSummary.latestUploadedAt
                              ? `Upload terakhir ${formatDateTime(selectedShipment.documentSummary.latestUploadedAt)}`
                              : "Belum ada timestamp upload"
                          }
                        />
                        <DataCard
                          label="Readiness"
                          value={selectedShipment.readiness}
                          note="Status kesiapan yang dibagikan ke akun pelanggan"
                        />
                      </div>
                    </div>
                  )}

                  {!isReadOnly ? (
                    <div className="ledger-section-card rounded-[26px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)]">
                      <SectionHeader
                        title="Dokumen Aktif"
                        subtitle="Upload dan penghapusan file tetap dekat dengan detail shipment yang sedang dipilih."
                      />
                      <div className="mt-5 space-y-3">
                        {selectedShipment.documents.length ? (
                          selectedShipment.documents.map((document) => (
                            <div
                              key={document.id}
                              className="rounded-[22px] border border-[color:var(--border-soft)] bg-[color:var(--panel-bg)] px-4 py-4"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <a
                                    href={document.storageUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="font-semibold text-[color:var(--text-strong)] underline-offset-2 hover:underline"
                                  >
                                    {document.fileName}
                                  </a>
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
                                      onClick={() => handleDeleteDocument(document.id)}
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

                  <div className="ledger-section-card rounded-[26px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)]">
                    <SectionHeader
                      title="Tracking Timeline"
                      subtitle="Hubungan visual antara manifest board dan panel detail dijaga lewat event log yang tetap kronologis."
                    />
                    <div className="mt-5 space-y-3">
                      {selectedShipment.trackingLogs.map((log) => (
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
          ) : (
            <div className="flex min-h-[420px] flex-1 items-center justify-center p-6">
              <EmptyState
                icon={PackageSearch}
                title="Pilih Shipment"
                copy={
                  isReadOnly
                    ? "Klik salah satu shipment pada daftar untuk melihat ringkasan status, dokumen, dan timeline."
                    : "Klik salah satu shipment pada manifest board untuk membuka detail review, metadata, dan aksi operasional."
                }
              />
            </div>
          )}
        </OpsPanel>
      </div>

      {createOpen ? (
        <div className="ops-modal-backdrop" onClick={() => setCreateOpen(false)}>
          <div className="ops-modal-panel" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b border-[color:var(--border-soft)] pb-5">
              <div>
                <p className="ops-eyebrow">Buat Shipment</p>
                <h2 className="mt-2 font-[family:var(--font-heading)] text-[2rem] font-black tracking-[-0.05em] text-[color:var(--text-strong)]">
                  Tambah manifest baru
                </h2>
                <p className="mt-2 text-sm text-[color:var(--muted-fg)]">
                  AWB dapat diisi manual atau dibuat otomatis. Form dipecah berdasarkan identitas kiriman, routing, dan kontak.
                </p>
              </div>
              <button type="button" className="topbar-button" onClick={() => setCreateOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <form className="mt-6 space-y-6" onSubmit={submitCreate}>
              <div className="rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-5">
                <SectionHeader title="Identitas Shipment" subtitle="Identifier utama dan ownership operasional." />
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="label">AWB</label>
                    <input
                      className="input-field"
                      placeholder="Kosongkan untuk generate otomatis"
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
                      value={form.ownerName}
                      onChange={(event) => setForm((current) => ({ ...current, ownerName: event.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="label">No Telepon</label>
                    <input
                      className="input-field"
                      placeholder="Nomor pengirim/penerima"
                      value={form.senderPhone}
                      onChange={(event) => setForm((current) => ({ ...current, senderPhone: event.target.value }))}
                    />
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
                      value={form.pieces}
                      onChange={(event) => setForm((current) => ({ ...current, pieces: Number(event.target.value) }))}
                    />
                  </div>
                  <div>
                    <label className="label">Berat</label>
                    <input
                      className="input-field"
                      type="number"
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
                    <input className="input-field" value="Diproses" readOnly />
                    <p className="form-help">Otomatis dari workflow shipment.</p>
                  </div>
                  <div>
                    <label className="label">Status Transaksi</label>
                    <input className="input-field" value={getDraftTransactionStatus(form.shippingRate)} readOnly />
                    <p className="form-help">Tidak dapat dipilih manual.</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-5">
                <SectionHeader title="Kontak & Relasi" subtitle="Pengirim, penerima, forwarder, flight, dan akun pelanggan." />
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="label">Pengirim</label>
                    <input
                      className="input-field"
                      placeholder="Nama pengirim"
                      value={form.shipper}
                      onChange={(event) => setForm((current) => ({ ...current, shipper: event.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="label">Penerima</label>
                    <input
                      className="input-field"
                      placeholder="Nama penerima"
                      value={form.consignee}
                      onChange={(event) => setForm((current) => ({ ...current, consignee: event.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="label">Forwarder</label>
                    <input
                      className="input-field"
                      placeholder="Nama forwarder"
                      value={form.forwarder}
                      onChange={(event) => setForm((current) => ({ ...current, forwarder: event.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="label">Flight</label>
                    <select
                      className="select-field"
                      value={form.flightId}
                      onChange={(event) => setForm((current) => ({ ...current, flightId: event.target.value }))}
                    >
                      <option value="">Tanpa flight</option>
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
                      placeholder="Catatan staff"
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
                  {saving ? "Menyimpan..." : "Buat Shipment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
