"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { startTransition, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  Boxes,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  FileText,
  FolderOpen,
  PackageSearch,
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
  commodity: string;
  origin: string;
  destination: string;
  pieces: number;
  weightKg: number;
  volumeM3: number | null;
  specialHandling: string | null;
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
  };
  shipments: ShipmentRow[];
  flights: { id: string; flightNumber: string }[];
  customerAccounts: { id: string; name: string; code: string }[];
};

function createDrawerDraft(shipment: ShipmentRow | null) {
  return {
    status: shipment?.status ?? "received",
    ownerName: shipment?.ownerName ?? "",
    notes: shipment?.notes ?? "",
    flightId: shipment?.flightId || "",
    customerAccountId: shipment?.customerAccountId || "",
    docStatus: shipment?.docStatus ?? "Complete",
    readiness: shipment?.readiness ?? "Ready",
  };
}

const blankForm = {
  awb: "",
  commodity: "",
  origin: "SOQ",
  destination: "CGK",
  pieces: 1,
  weightKg: 1,
  volumeM3: 0.5,
  specialHandling: "",
  shipper: "",
  consignee: "",
  forwarder: "SkyHub",
  ownerName: "Operator Shift",
  flightId: "",
  customerAccountId: "",
  notes: "",
};

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
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string>("");
  const [form, setForm] = useState(blankForm);
  const [drawerDraft, setDrawerDraft] = useState(() => createDrawerDraft(null));
  const [listPage, setListPage] = useState(1);
  const selectedIdRef = useRef<string | null>(null);
  const hasLoadedRef = useRef(false);

  const deferredQuery = useDeferredValue(query);

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

  const selectedShipment = useMemo(
    () => data?.shipments.find((shipment) => shipment.id === selectedId) ?? null,
    [data, selectedId],
  );

  const handleSelectShipment = useCallback(
    (shipmentId: string) => {
      const nextShipment = (data?.shipments ?? []).find((shipment) => shipment.id === shipmentId) ?? null;
      setSelectedId(shipmentId);
      setDrawerDraft(createDrawerDraft(nextShipment));
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
      setForm({ ...blankForm });
      setActionNotice("Shipment berhasil dibuat.");
      await loadShipments(payload.shipment?.id ?? selectedId, "refresh");
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
      setActionNotice("Perubahan shipment berhasil disimpan.");
      await loadShipments(selectedShipment.id, "refresh");
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
      setActionNotice("Dokumen berhasil diunggah.");
      await loadShipments(selectedShipment.id, "refresh");
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

  async function handleArchiveShipment() {
    if (!selectedShipment) return;

    const response = await fetch(`/api/shipments/${selectedShipment.id}`, {
      method: "DELETE",
    });

    if (response.ok) {
      setActionNotice(`Shipment ${selectedShipment.awb} berhasil diarsipkan.`);
      await loadShipments(null, "refresh");
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
            ? `Daftar shipment milik ${data?.viewer.customerAccountName || "akun Anda"} dengan status, dokumen, dan kronologi yang lebih mudah dipindai.`
            : "Manifest board dan detail panel dipertajam untuk review cepat: identifier lebih dominan, filter lebih rapi, dan urgency lebih terlihat."
        }
        actions={
          <>
            {!isReadOnly ? (
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
          note="Jumlah kiriman pada filter aktif."
          meta={`${activeFilterCount} filter aktif${lastSyncedAt ? ` • Sinkron ${formatRelativeShort(lastSyncedAt)}` : ""}`}
          icon={Boxes}
          tone="primary"
        />
        <DataCard
          label="Berat Total"
          value={formatWeight(totalWeight)}
          note="Akumulasi berat shipment yang sedang tampil."
          meta={`${assignedFlightCount} shipment sudah assigned ke flight`}
          icon={PackageSearch}
          tone="info"
        />
        <DataCard
          label="Assigned Flight"
          value={assignedFlightCount}
          note="Shipment yang sudah terhubung ke flight aktif."
          meta={`${(data?.flights ?? []).length} pilihan flight tersedia`}
          icon={PlaneTakeoff}
          tone="success"
        />
        <DataCard
          label="Perlu Review"
          value={pendingDocsCount + holdCount + readinessIssuesCount}
          note="Menggabungkan hold, dokumen incomplete, dan readiness issue."
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
            placeholder="AWB, komoditas, shipper, consignee..."
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
        <OpsPanel className="page-pane split-pane-left flex min-h-0 flex-col overflow-hidden p-0">
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

                  <div className="flex items-center justify-between gap-3 rounded-[18px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-3 py-3">
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

              <div className="page-scroll flex-1 p-6">
                <div className="grid gap-3 sm:grid-cols-2">
                  <DataCard
                    label="Diterima"
                    value={formatDateTime(selectedShipment.receivedAt)}
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
                    label="Akun / Shipper"
                    value={selectedShipment.customerAccountName || selectedShipment.shipper}
                    note={selectedShipment.consignee}
                    icon={FolderOpen}
                  />
                  <DataCard
                    label="Dokumen"
                    value={selectedShipment.docStatus}
                    note={`${selectedShipment.documentSummary.count} file aktif`}
                    icon={FileText}
                    tone={selectedShipment.docStatus.toLowerCase() === "complete" ? "success" : "warning"}
                  />
                </div>

                <div className="mt-6 space-y-6">
                  {!isReadOnly ? (
                    <div className="rounded-[26px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-5">
                      <SectionHeader
                        title="Review Operasional"
                        subtitle="Metadata dikelompokkan agar status action, assignment, dan ownership mudah direvisi."
                        className="pb-5"
                      />
                      <div className="grid gap-4 pt-5 md:grid-cols-2">
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
                          <input
                            className="input-field"
                            value={drawerDraft.docStatus}
                            onChange={(event) =>
                              setDrawerDraft((current) => ({ ...current, docStatus: event.target.value }))
                            }
                          />
                        </div>
                        <div>
                          <label className="label">Kesiapan</label>
                          <input
                            className="input-field"
                            value={drawerDraft.readiness}
                            onChange={(event) =>
                              setDrawerDraft((current) => ({ ...current, readiness: event.target.value }))
                            }
                          />
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

                      <div className="ops-sticky-footer mt-5 flex flex-wrap gap-3 rounded-[22px] border border-[color:var(--border-soft)] bg-white/85 p-4 shadow-[0_-8px_24px_rgba(11,30,52,0.04)] backdrop-blur dark:bg-[color:var(--panel-bg)]/85">
                        <button type="button" className="btn btn-primary flex-1" onClick={saveShipmentChanges} disabled={saving}>
                          <Save size={16} />
                          {saving ? "Menyimpan..." : "Simpan Perubahan"}
                        </button>
                        <label className="btn btn-secondary flex-1 cursor-pointer">
                          <Upload size={16} />
                          Upload Dokumen
                          <input type="file" className="hidden" onChange={handleUpload} />
                        </label>
                        <button type="button" className="btn btn-warning" onClick={handleArchiveShipment}>
                          <Archive size={16} />
                          Arsipkan
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-[26px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-5">
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
                    <div className="rounded-[26px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-5">
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
                                </div>
                                <button
                                  type="button"
                                  className="topbar-button"
                                  onClick={() => handleDeleteDocument(document.id)}
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-[color:var(--muted-fg)]">Belum ada dokumen aktif.</p>
                        )}
                      </div>
                    </div>
                  ) : null}

                  <div className="rounded-[26px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-5">
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
                    <label className="label">Komoditas</label>
                    <input
                      className="input-field"
                      placeholder="Komoditas"
                      value={form.commodity}
                      onChange={(event) => setForm((current) => ({ ...current, commodity: event.target.value }))}
                    />
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
                </div>
              </div>

              <div className="rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-5">
                <SectionHeader title="Routing & Kargo" subtitle="Asal-tujuan, pieces, berat, dan penanganan khusus." />
                <div className="mt-5 grid gap-4 md:grid-cols-4">
                  <div>
                    <label className="label">Asal</label>
                    <input
                      className="input-field"
                      placeholder="Bandara asal"
                      value={form.origin}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, origin: event.target.value.toUpperCase() }))
                      }
                    />
                  </div>
                  <div>
                    <label className="label">Tujuan</label>
                    <input
                      className="input-field"
                      placeholder="Bandara tujuan"
                      value={form.destination}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, destination: event.target.value.toUpperCase() }))
                      }
                    />
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

              <div className="flex justify-end gap-3">
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
