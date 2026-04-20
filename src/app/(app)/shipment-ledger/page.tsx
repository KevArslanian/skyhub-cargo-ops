"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { startTransition, useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  Archive,
  Boxes,
  CircleAlert,
  FileText,
  PackageSearch,
  PlaneTakeoff,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { formatDateTime, formatWeight } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState, FilterBar, OpsPanel, PageHeader, SectionHeader, StatCard } from "@/components/ops-ui";

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
    role: "admin" | "operator" | "supervisor" | "customer";
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
  const [actionNotice, setActionNotice] = useState<string>("");
  const [form, setForm] = useState(blankForm);
  const [drawerDraft, setDrawerDraft] = useState({
    status: "received",
    ownerName: "",
    notes: "",
    flightId: "",
    customerAccountId: "",
    docStatus: "Complete",
    readiness: "Ready",
  });

  const deferredQuery = useDeferredValue(query);

  const loadShipments = useCallback(async () => {
    const params = new URLSearchParams();
    if (deferredQuery.trim()) params.set("query", deferredQuery.trim());
    if (status !== "all") params.set("status", status);
    if (flight !== "all") params.set("flight", flight);
    if (sortBy) params.set("sortBy", sortBy);

    const response = await fetch(`/api/shipments?${params.toString()}`, { cache: "no-store" });
    if (!response.ok) return;

    const payload = (await response.json()) as LedgerPayload;
    startTransition(() => {
      setData(payload);
      const nextSelected =
        payload.shipments.find((shipment) => shipment.id === selectedId)?.id ??
        payload.shipments[0]?.id ??
        null;
      setSelectedId(nextSelected);
    });
  }, [deferredQuery, flight, selectedId, sortBy, status]);

  useEffect(() => {
    void loadShipments();
  }, [loadShipments]);

  useEffect(() => {
    const selectedShipment = data?.shipments.find((shipment) => shipment.id === selectedId);
    if (!selectedShipment) return;

    setDrawerDraft({
      status: selectedShipment.status,
      ownerName: selectedShipment.ownerName,
      notes: selectedShipment.notes,
      flightId: selectedShipment.flightId || "",
      customerAccountId: selectedShipment.customerAccountId || "",
      docStatus: selectedShipment.docStatus,
      readiness: selectedShipment.readiness,
    });
  }, [data?.shipments, selectedId]);

  useEffect(() => {
    if (!actionNotice) return;
    const timer = window.setTimeout(() => setActionNotice(""), 2600);
    return () => window.clearTimeout(timer);
  }, [actionNotice]);

  const selectedShipment = useMemo(
    () => data?.shipments.find((shipment) => shipment.id === selectedId) ?? null,
    [data, selectedId],
  );

  const totalWeight = useMemo(
    () => (data?.shipments ?? []).reduce((sum, shipment) => sum + shipment.weightKg, 0),
    [data?.shipments],
  );

  const holdCount = (data?.shipments ?? []).filter((shipment) => shipment.status === "hold").length;
  const assignedFlightCount = (data?.shipments ?? []).filter((shipment) => shipment.flightNumber).length;
  const pendingDocsCount = (data?.shipments ?? []).filter((shipment) => shipment.docStatus.toLowerCase() !== "complete").length;

  const exportParams = new URLSearchParams();
  if (deferredQuery.trim()) exportParams.set("query", deferredQuery.trim());
  if (status !== "all") exportParams.set("status", status);
  if (flight !== "all") exportParams.set("flight", flight);
  if (sortBy) exportParams.set("sortBy", sortBy);

  const isReadOnly = data?.viewer.readOnly ?? false;

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
      setCreateOpen(false);
      setForm(blankForm);
      setActionNotice("Shipment berhasil dibuat.");
      await loadShipments();
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
      await loadShipments();
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
      await loadShipments();
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
      await loadShipments();
    }
  }

  async function handleArchiveShipment() {
    if (!selectedShipment) return;

    const response = await fetch(`/api/shipments/${selectedShipment.id}`, {
      method: "DELETE",
    });

    if (response.ok) {
      setActionNotice(`Shipment ${selectedShipment.awb} berhasil diarsipkan.`);
      await loadShipments();
    }
  }

  return (
    <div className="page-workspace">
      <PageHeader
        eyebrow="Kontrol Manifest"
        title={isReadOnly ? "Shipment Saya" : "Ledger Shipment"}
        subtitle={
          isReadOnly
            ? `Daftar shipment milik ${data?.viewer.customerAccountName || "akun Anda"} dengan status, ringkasan dokumen, dan timeline.`
            : "Pusat kendali manifest harian dengan filter cepat, panel detail, dan pengelolaan shipment untuk tim internal."
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
        <StatCard label="Total Shipment" value={data?.shipments.length ?? 0} note="Jumlah shipment pada filter aktif." icon={Boxes} tone="primary" />
        <StatCard label="Berat Total" value={formatWeight(totalWeight)} note="Akumulasi berat hasil filter saat ini." icon={PackageSearch} tone="info" />
        <StatCard label="Assigned Flight" value={assignedFlightCount} note="Shipment yang sudah terhubung ke flight aktif." icon={PlaneTakeoff} tone="success" />
        <StatCard label="Perlu Review" value={pendingDocsCount + holdCount} note="Shipment dengan status dokumen belum lengkap atau exception aktif." icon={CircleAlert} tone="warning" />
      </div>

      <FilterBar className="xl:grid-cols-[1fr_180px_180px_180px]">
        <div>
          <label className="label">Cari Shipment</label>
          <input className="input-field" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="AWB, komoditas, shipper..." />
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
          <label className="label">Urutkan</label>
          <select className="select-field" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
            <option value="updated">Update Terbaru</option>
            <option value="received">Penerimaan Terbaru</option>
            <option value="priority">Prioritas</option>
          </select>
        </div>
      </FilterBar>

      {actionNotice ? (
        <div className="rounded-[18px] border border-[color:var(--tone-info-border)] bg-[color:var(--tone-info-soft)] px-4 py-3 text-sm font-medium text-[color:var(--tone-info)]">
          {actionNotice}
        </div>
      ) : null}

      <div className="page-grid-2">
        <OpsPanel className="page-pane p-5">
          <SectionHeader title="Papan Manifest" subtitle={isReadOnly ? "Klik baris untuk membuka detail shipment Anda." : "Klik baris untuk membuka detail, memperbarui status, atau mengelola dokumen."} />
          <div className="page-scroll mt-5 table-shell">
            <table className="data-table">
              <thead>
                <tr>
                  <th>AWB</th>
                  <th>Komoditas</th>
                  <th>Rute</th>
                  <th>Status</th>
                  <th>Flight</th>
                  <th>Update</th>
                </tr>
              </thead>
              <tbody>
                {(data?.shipments ?? []).length ? (
                  (data?.shipments ?? []).map((shipment) => (
                    <tr
                      key={shipment.id}
                      onClick={() => setSelectedId(shipment.id)}
                      className={selectedShipment?.id === shipment.id ? "bg-[color:var(--brand-primary-soft)]" : "cursor-pointer"}
                    >
                      <td className="font-mono text-sm font-semibold text-[color:var(--brand-primary)]">{shipment.awb}</td>
                      <td>
                        <p className="font-semibold text-[color:var(--text-strong)]">{shipment.commodity}</p>
                        <p className="mt-1 text-xs text-[color:var(--muted-fg)]">{formatWeight(shipment.weightKg)} | {shipment.pieces} pcs</p>
                      </td>
                      <td>{shipment.origin}{" -> "}{shipment.destination}</td>
                      <td><StatusBadge value={shipment.status} label={shipment.statusLabel} /></td>
                      <td>{shipment.flightNumber || "-"}</td>
                      <td className="text-sm text-[color:var(--muted-fg)]">{formatDateTime(shipment.updatedAt)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState
                        icon={PackageSearch}
                        title="Tidak ada shipment yang cocok"
                        copy="Ubah kata kunci atau filter untuk melihat shipment lain yang tersedia."
                        className="m-4"
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </OpsPanel>

        <OpsPanel className="page-pane p-5">
          {selectedShipment ? (
            <div className="page-scroll space-y-5">
              <div className="flex items-start justify-between gap-4 border-b border-[color:var(--border-soft)] pb-4">
                <div>
                  <p className="ops-eyebrow">Detail Shipment</p>
                  <h2 className="mt-2 font-[family:var(--font-heading)] text-[2rem] font-black tracking-[-0.05em] text-[color:var(--brand-primary)]">
                    {selectedShipment.awb}
                  </h2>
                  <p className="mt-2 text-sm text-[color:var(--muted-fg)]">
                    {selectedShipment.commodity} | {selectedShipment.origin}{" -> "}{selectedShipment.destination}
                  </p>
                </div>
                <StatusBadge value={selectedShipment.status} label={selectedShipment.statusLabel} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="ops-panel-muted p-4">
                  <p className="label">Diterima</p>
                  <p className="font-semibold text-[color:var(--text-strong)]">{formatDateTime(selectedShipment.receivedAt)}</p>
                </div>
                <div className="ops-panel-muted p-4">
                  <p className="label">Flight</p>
                  <p className="font-semibold text-[color:var(--text-strong)]">{selectedShipment.flightNumber ?? "-"}</p>
                </div>
                <div className="ops-panel-muted p-4">
                  <p className="label">Akun Pelanggan</p>
                  <p className="font-semibold text-[color:var(--text-strong)]">{selectedShipment.customerAccountName || "-"}</p>
                </div>
                <div className="ops-panel-muted p-4">
                  <p className="label">Status Dokumen</p>
                  <p className="font-semibold text-[color:var(--text-strong)]">{selectedShipment.docStatus}</p>
                </div>
              </div>

              {isReadOnly ? (
                <>
                  <div className="ops-panel-muted p-4">
                    <p className="label">Ringkasan Dokumen</p>
                    <p className="font-semibold text-[color:var(--text-strong)]">{selectedShipment.documentSummary.count} dokumen tercatat</p>
                    <p className="mt-2 text-sm text-[color:var(--muted-fg)]">
                      {selectedShipment.documentSummary.latestUploadedAt
                        ? `Upload terakhir ${formatDateTime(selectedShipment.documentSummary.latestUploadedAt)}`
                        : "Belum ada timestamp upload"}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-[color:var(--muted-fg)]">
                      Portal pelanggan hanya menampilkan status ringkas dokumen. Nama file dan aksi unduh tidak tersedia pada versi ini.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="label">Status</label>
                      <select className="select-field" value={drawerDraft.status} onChange={(event) => setDrawerDraft((current) => ({ ...current, status: event.target.value }))}>
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
                      <input className="input-field" value={drawerDraft.ownerName} onChange={(event) => setDrawerDraft((current) => ({ ...current, ownerName: event.target.value }))} />
                    </div>
                    <div>
                      <label className="label">Flight</label>
                      <select className="select-field" value={drawerDraft.flightId} onChange={(event) => setDrawerDraft((current) => ({ ...current, flightId: event.target.value }))}>
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
                      <select className="select-field" value={drawerDraft.customerAccountId} onChange={(event) => setDrawerDraft((current) => ({ ...current, customerAccountId: event.target.value }))}>
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
                      <input className="input-field" value={drawerDraft.docStatus} onChange={(event) => setDrawerDraft((current) => ({ ...current, docStatus: event.target.value }))} />
                    </div>
                    <div>
                      <label className="label">Kesiapan</label>
                      <input className="input-field" value={drawerDraft.readiness} onChange={(event) => setDrawerDraft((current) => ({ ...current, readiness: event.target.value }))} />
                    </div>
                  </div>

                  <div>
                    <label className="label">Catatan</label>
                    <textarea className="textarea-field" value={drawerDraft.notes} onChange={(event) => setDrawerDraft((current) => ({ ...current, notes: event.target.value }))} />
                  </div>

                  <div className="flex flex-wrap gap-3">
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

                  <div>
                    <p className="label">Dokumen Aktif</p>
                    <div className="space-y-3">
                      {selectedShipment.documents.length ? (
                        selectedShipment.documents.map((document) => (
                          <div key={document.id} className="rounded-[22px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-4 py-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <a href={document.storageUrl} target="_blank" rel="noreferrer" className="font-semibold text-[color:var(--text-strong)] underline-offset-2 hover:underline">
                                  {document.fileName}
                                </a>
                                <p className="mt-1 text-xs text-[color:var(--muted-fg)]">{formatDateTime(document.createdAt)}</p>
                              </div>
                              <button type="button" className="topbar-button" onClick={() => handleDeleteDocument(document.id)}>
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
                </>
              )}

              <div>
                <p className="label">Tracking Timeline</p>
                <div className="space-y-3">
                  {selectedShipment.trackingLogs.map((log) => (
                    <div key={log.id} className="rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-[color:var(--text-strong)]">{log.label}</p>
                          <p className="mt-2 text-sm leading-6">{log.message}</p>
                        </div>
                        <StatusBadge value={log.status} label={log.label} />
                      </div>
                      <p className="mt-3 text-xs text-[color:var(--muted-2)]">{formatDateTime(log.createdAt)} | {log.location} | {log.actorName || "Sistem"}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={PackageSearch}
              title="Pilih Shipment"
              copy={isReadOnly ? "Klik salah satu shipment pada daftar untuk melihat ringkasan status dan timeline." : "Klik salah satu shipment pada manifest board untuk melihat detail dan melakukan aksi."}
            />
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
                <p className="mt-2 text-sm text-[color:var(--muted-fg)]">Jika AWB kosong, sistem akan membuat nomor AWB unik secara otomatis.</p>
              </div>
              <button type="button" className="topbar-button" onClick={() => setCreateOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <form className="mt-6 space-y-5" onSubmit={submitCreate}>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="label">AWB</label>
                  <input className="input-field" placeholder="AWB opsional" value={form.awb} onChange={(event) => setForm((current) => ({ ...current, awb: event.target.value }))} />
                </div>
                <div>
                  <label className="label">Komoditas</label>
                  <input className="input-field" placeholder="Komoditas" value={form.commodity} onChange={(event) => setForm((current) => ({ ...current, commodity: event.target.value }))} />
                </div>
                <div>
                  <label className="label">Penanggung Jawab</label>
                  <input className="input-field" placeholder="Penanggung jawab" value={form.ownerName} onChange={(event) => setForm((current) => ({ ...current, ownerName: event.target.value }))} />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <label className="label">Asal</label>
                  <input className="input-field" placeholder="Bandara asal" value={form.origin} onChange={(event) => setForm((current) => ({ ...current, origin: event.target.value.toUpperCase() }))} />
                </div>
                <div>
                  <label className="label">Tujuan</label>
                  <input className="input-field" placeholder="Bandara tujuan" value={form.destination} onChange={(event) => setForm((current) => ({ ...current, destination: event.target.value.toUpperCase() }))} />
                </div>
                <div>
                  <label className="label">Pieces</label>
                  <input className="input-field" type="number" placeholder="Pieces" value={form.pieces} onChange={(event) => setForm((current) => ({ ...current, pieces: Number(event.target.value) }))} />
                </div>
                <div>
                  <label className="label">Berat</label>
                  <input className="input-field" type="number" placeholder="Berat" value={form.weightKg} onChange={(event) => setForm((current) => ({ ...current, weightKg: Number(event.target.value) }))} />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <label className="label">Volume</label>
                  <input className="input-field" type="number" step="0.1" placeholder="Volume" value={form.volumeM3} onChange={(event) => setForm((current) => ({ ...current, volumeM3: Number(event.target.value) }))} />
                </div>
                <div>
                  <label className="label">Penanganan Khusus</label>
                  <input className="input-field" placeholder="Instruksi penanganan khusus" value={form.specialHandling} onChange={(event) => setForm((current) => ({ ...current, specialHandling: event.target.value }))} />
                </div>
                <div>
                  <label className="label">Pengirim</label>
                  <input className="input-field" placeholder="Nama pengirim" value={form.shipper} onChange={(event) => setForm((current) => ({ ...current, shipper: event.target.value }))} />
                </div>
                <div>
                  <label className="label">Penerima</label>
                  <input className="input-field" placeholder="Nama penerima" value={form.consignee} onChange={(event) => setForm((current) => ({ ...current, consignee: event.target.value }))} />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="label">Forwarder</label>
                  <input className="input-field" placeholder="Nama forwarder" value={form.forwarder} onChange={(event) => setForm((current) => ({ ...current, forwarder: event.target.value }))} />
                </div>
                <div>
                  <label className="label">Flight</label>
                  <select className="select-field" value={form.flightId} onChange={(event) => setForm((current) => ({ ...current, flightId: event.target.value }))}>
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
                  <select className="select-field" value={form.customerAccountId} onChange={(event) => setForm((current) => ({ ...current, customerAccountId: event.target.value }))}>
                    <option value="">Tanpa akun pelanggan</option>
                    {(data?.customerAccounts ?? []).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="label">Catatan Operator</label>
                <textarea className="textarea-field" placeholder="Catatan operator" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
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
