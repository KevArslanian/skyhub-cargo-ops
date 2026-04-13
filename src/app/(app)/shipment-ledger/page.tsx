"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { startTransition, useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { Boxes, CircleAlert, Download, PackageSearch, PlaneTakeoff, Plus, Save, Upload, X } from "lucide-react";
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
  }[];
};

type LedgerPayload = {
  shipments: ShipmentRow[];
  flights: { id: string; flightNumber: string }[];
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
  ownerName: "Andika",
  flightId: "",
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
  const [form, setForm] = useState(blankForm);
  const [drawerDraft, setDrawerDraft] = useState({ status: "received", ownerName: "", notes: "" });

  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(searchParams.get("query") || "");
      setStatus(searchParams.get("status") || "all");
      setFlight(searchParams.get("flight") || "all");
      setSortBy(searchParams.get("sortBy") || "updated");
    }, 0);

    return () => window.clearTimeout(timer);
  }, [searchParams]);

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
      if (!selectedId && payload.shipments.length) {
        const firstShipment = payload.shipments[0];
        setSelectedId(firstShipment.id);
        setDrawerDraft({
          status: firstShipment.status,
          ownerName: firstShipment.ownerName,
          notes: firstShipment.notes,
        });
      }
    });
  }, [deferredQuery, flight, selectedId, sortBy, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadShipments();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadShipments]);

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

  const exportParams = new URLSearchParams();
  if (deferredQuery.trim()) exportParams.set("query", deferredQuery.trim());
  if (status !== "all") exportParams.set("status", status);
  if (flight !== "all") exportParams.set("flight", flight);
  if (sortBy) exportParams.set("sortBy", sortBy);

  function selectShipment(shipment: ShipmentRow) {
    setSelectedId(shipment.id);
    setDrawerDraft({
      status: shipment.status,
      ownerName: shipment.ownerName,
      notes: shipment.notes,
    });
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
      }),
    });

    if (response.ok) {
      setCreateOpen(false);
      setForm(blankForm);
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
      body: JSON.stringify(drawerDraft),
    });

    if (response.ok) {
      const payload = (await response.json()) as { shipment: ShipmentRow };
      setData((current) =>
        current
          ? {
              ...current,
              shipments: current.shipments.map((shipment) => (shipment.id === payload.shipment.id ? payload.shipment : shipment)),
            }
          : current,
      );
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
      await loadShipments();
    }
    event.target.value = "";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Manifest Control"
        title="Shipment Ledger"
        subtitle="Pusat kendali manifest harian dengan filter cepat, export, create shipment, dan panel detail yang selalu siap dipakai operator."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
            <Plus size={16} />
            Create Shipment
          </button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-4">
        <StatCard label="Total Shipment" value={data?.shipments.length ?? 0} note="Jumlah manifest yang tampil pada filter aktif." icon={Boxes} tone="primary" />
        <StatCard label="Berat Total" value={formatWeight(totalWeight)} note="Akumulasi berat shipment pada hasil pencarian saat ini." icon={PackageSearch} tone="info" />
        <StatCard label="Assigned Flight" value={assignedFlightCount} note="Shipment yang sudah terhubung ke flight manifest." icon={PlaneTakeoff} tone="success" />
        <StatCard label="Hold / Exception" value={holdCount} note="Manifest yang perlu perhatian operator atau supervisor." icon={CircleAlert} tone="warning" />
      </div>

      <FilterBar className="xl:grid-cols-[1fr_180px_180px_180px_auto_auto]">
        <div>
          <label className="label">Cari shipment</label>
          <input className="input-field" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="AWB, komoditas, shipper..." />
        </div>
        <div>
          <label className="label">Status</label>
          <select className="select-field" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">Semua</option>
            <option value="received">Received</option>
            <option value="sortation">Sortation</option>
            <option value="loaded_to_aircraft">Loaded</option>
            <option value="departed">Departed</option>
            <option value="arrived">Arrived</option>
            <option value="hold">Hold</option>
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
          <label className="label">Sort</label>
          <select className="select-field" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
            <option value="updated">Updated</option>
            <option value="received">Received</option>
            <option value="priority">Priority</option>
          </select>
        </div>
        <Link href={`/api/exports/shipments?${exportParams.toString()}`} className="btn btn-secondary self-end">
          <Download size={16} />
          CSV
        </Link>
        <Link href={`/exports/shipments?${exportParams.toString()}`} className="btn btn-secondary self-end">
          <Download size={16} />
          PDF / Print
        </Link>
      </FilterBar>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.3fr)_420px]">
        <OpsPanel className="p-5">
          <SectionHeader title="Manifest Board" subtitle="Klik baris untuk membuka detail, update status, atau upload dokumen." />
          <div className="mt-5 table-shell">
            <table className="data-table">
              <thead>
                <tr>
                  <th>AWB</th>
                  <th>Komoditas</th>
                  <th>Rute</th>
                  <th>Status</th>
                  <th>Flight</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {(data?.shipments ?? []).length ? (
                  (data?.shipments ?? []).map((shipment) => (
                    <tr
                      key={shipment.id}
                      onClick={() => selectShipment(shipment)}
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
                        copy="Ubah kata kunci atau filter untuk melihat manifest lain yang tersedia di sistem."
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
          {selectedShipment ? (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-4 border-b border-[color:var(--border-soft)] pb-4">
                <div>
                  <p className="ops-eyebrow">Shipment Detail</p>
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
                  <p className="label">Received</p>
                  <p className="font-semibold text-[color:var(--text-strong)]">{formatDateTime(selectedShipment.receivedAt)}</p>
                </div>
                <div className="ops-panel-muted p-4">
                  <p className="label">Flight</p>
                  <p className="font-semibold text-[color:var(--text-strong)]">{selectedShipment.flightNumber ?? "-"}</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label">Status</label>
                  <select className="select-field" value={drawerDraft.status} onChange={(event) => setDrawerDraft((current) => ({ ...current, status: event.target.value }))}>
                    <option value="received">Received</option>
                    <option value="sortation">Sortation</option>
                    <option value="loaded_to_aircraft">Loaded to Aircraft</option>
                    <option value="departed">Departed</option>
                    <option value="arrived">Arrived</option>
                    <option value="hold">Hold</option>
                  </select>
                </div>
                <div>
                  <label className="label">Owner</label>
                  <input className="input-field" value={drawerDraft.ownerName} onChange={(event) => setDrawerDraft((current) => ({ ...current, ownerName: event.target.value }))} />
                </div>
              </div>

              <div>
                <label className="label">Catatan</label>
                <textarea className="textarea-field" value={drawerDraft.notes} onChange={(event) => setDrawerDraft((current) => ({ ...current, notes: event.target.value }))} />
              </div>

              <div className="flex flex-wrap gap-3">
                <button type="button" className="btn btn-primary flex-1" onClick={saveShipmentChanges} disabled={saving}>
                  <Save size={16} />
                  {saving ? "Menyimpan..." : "Save Changes"}
                </button>
                <label className="btn btn-secondary flex-1 cursor-pointer">
                  <Upload size={16} />
                  Upload Doc
                  <input type="file" className="hidden" onChange={handleUpload} />
                </label>
              </div>

              <div>
                <p className="label">Dokumen</p>
                <div className="space-y-3">
                  {selectedShipment.documents.length ? (
                    selectedShipment.documents.map((document) => (
                      <a key={document.id} href={document.storageUrl} target="_blank" rel="noreferrer" className="block rounded-[22px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-4 py-4">
                        <p className="font-semibold text-[color:var(--text-strong)]">{document.fileName}</p>
                        <p className="mt-1 text-xs text-[color:var(--muted-fg)]">{formatDateTime(document.createdAt)}</p>
                      </a>
                    ))
                  ) : (
                    <p className="text-sm text-[color:var(--muted-fg)]">Belum ada dokumen.</p>
                  )}
                </div>
              </div>

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
                      <p className="mt-3 text-xs text-[color:var(--muted-2)]">{formatDateTime(log.createdAt)} | {log.location} | {log.actorName || "System"}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={PackageSearch}
              title="Pilih shipment"
              copy="Klik salah satu baris pada manifest board untuk melihat detail, memperbarui status, atau mengunggah dokumen."
            />
          )}
        </OpsPanel>
      </div>

      {createOpen ? (
        <div className="ops-modal-backdrop" onClick={() => setCreateOpen(false)}>
          <div className="ops-modal-panel" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b border-[color:var(--border-soft)] pb-5">
              <div>
                <p className="ops-eyebrow">Create Shipment</p>
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
                  <label className="label">Owner</label>
                  <input className="input-field" placeholder="Owner" value={form.ownerName} onChange={(event) => setForm((current) => ({ ...current, ownerName: event.target.value }))} />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <label className="label">Origin</label>
                  <input className="input-field" placeholder="Origin" value={form.origin} onChange={(event) => setForm((current) => ({ ...current, origin: event.target.value.toUpperCase() }))} />
                </div>
                <div>
                  <label className="label">Destination</label>
                  <input className="input-field" placeholder="Destination" value={form.destination} onChange={(event) => setForm((current) => ({ ...current, destination: event.target.value.toUpperCase() }))} />
                </div>
                <div>
                  <label className="label">Pieces</label>
                  <input className="input-field" type="number" placeholder="Pieces" value={form.pieces} onChange={(event) => setForm((current) => ({ ...current, pieces: Number(event.target.value) }))} />
                </div>
                <div>
                  <label className="label">Weight</label>
                  <input className="input-field" type="number" placeholder="Weight" value={form.weightKg} onChange={(event) => setForm((current) => ({ ...current, weightKg: Number(event.target.value) }))} />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <label className="label">Volume</label>
                  <input className="input-field" type="number" step="0.1" placeholder="Volume" value={form.volumeM3} onChange={(event) => setForm((current) => ({ ...current, volumeM3: Number(event.target.value) }))} />
                </div>
                <div>
                  <label className="label">Special Handling</label>
                  <input className="input-field" placeholder="Special handling" value={form.specialHandling} onChange={(event) => setForm((current) => ({ ...current, specialHandling: event.target.value }))} />
                </div>
                <div>
                  <label className="label">Shipper</label>
                  <input className="input-field" placeholder="Shipper" value={form.shipper} onChange={(event) => setForm((current) => ({ ...current, shipper: event.target.value }))} />
                </div>
                <div>
                  <label className="label">Consignee</label>
                  <input className="input-field" placeholder="Consignee" value={form.consignee} onChange={(event) => setForm((current) => ({ ...current, consignee: event.target.value }))} />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label">Forwarder</label>
                  <input className="input-field" placeholder="Forwarder" value={form.forwarder} onChange={(event) => setForm((current) => ({ ...current, forwarder: event.target.value }))} />
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
              </div>
              <div>
                <label className="label">Catatan Operator</label>
                <textarea className="textarea-field" placeholder="Catatan operator" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" className="btn btn-secondary" onClick={() => setCreateOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Menyimpan..." : "Create Shipment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
