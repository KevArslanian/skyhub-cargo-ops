"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Copy, Printer, Radar, Search, Share2, TriangleAlert } from "lucide-react";
import { AWB_REGEX } from "@/lib/constants";
import { formatDateTime, formatRelativeShort } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState, OpsPanel, PageHeader, SectionHeader } from "@/components/ops-ui";

type ShipmentPayload = {
  id: string;
  awb: string;
  commodity: string;
  origin: string;
  destination: string;
  status: string;
  statusLabel: string;
  shipper: string;
  consignee: string;
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
} | null;

const requiredSteps = [
  { key: "received", label: "Received" },
  { key: "sortation", label: "Sortation" },
  { key: "loaded_to_aircraft", label: "Loaded to Aircraft" },
  { key: "departed", label: "Departed" },
  { key: "arrived", label: "Arrived" },
] as const;

export default function AwbTrackingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const awbFromQuery = searchParams.get("awb") || "";
  const [awb, setAwb] = useState(awbFromQuery);
  const [inputDirty, setInputDirty] = useState(false);
  const awbInputValue = inputDirty ? awb : awbFromQuery;
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [shipment, setShipment] = useState<ShipmentPayload>(null);
  const [notFound, setNotFound] = useState(false);
  const [recentSearches, setRecentSearches] = useState<{ id: string; awb: string; createdAt: string }[]>([]);

  const fetchRecentSearches = useCallback(() => {
    fetch("/api/awb/recent")
      .then((response) => response.json())
      .then((payload) => setRecentSearches(payload.searches || []))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    fetchRecentSearches();
  }, [fetchRecentSearches]);

  useEffect(() => {
    if (!actionMessage) return;
    const timer = window.setTimeout(() => setActionMessage(""), 2200);
    return () => window.clearTimeout(timer);
  }, [actionMessage]);

  useEffect(() => {
    async function lookup() {
      if (!awbFromQuery) {
        setShipment(null);
        setNotFound(false);
        return;
      }

      setLoading(true);
      const response = await fetch(`/api/shipments?awb=${encodeURIComponent(awbFromQuery)}`, { cache: "no-store" });
      const payload = (await response.json()) as { shipment: ShipmentPayload };
      setShipment(payload.shipment);
      setNotFound(!payload.shipment);
      setLoading(false);
      fetchRecentSearches();
    }

    void lookup();
  }, [awbFromQuery, fetchRecentSearches]);

  const stepTimeline = useMemo(() => {
    return requiredSteps.map((step) => {
      const log = shipment?.trackingLogs.find((item) => item.status === step.key) ?? null;
      return {
        ...step,
        log,
      };
    });
  }, [shipment?.trackingLogs]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!AWB_REGEX.test(awb.trim())) {
      setError("Format AWB harus XXX-XXXXXXXX.");
      return;
    }
    setError("");
    setInputDirty(false);
    router.push(`/awb-tracking?awb=${encodeURIComponent(awb.trim())}`);
  }

  async function handleCopyLink() {
    if (!awbFromQuery) return;
    const url = `${window.location.origin}/awb-tracking?awb=${encodeURIComponent(awbFromQuery)}`;
    await navigator.clipboard.writeText(url);
    setActionMessage("Link tracking berhasil disalin.");
  }

  async function handleReportIssue() {
    if (!awbFromQuery) return;
    const response = await fetch("/api/awb/report-issue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ awb: awbFromQuery }),
    });
    if (response.ok) {
      setActionMessage("Issue berhasil dikirim ke audit trail.");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Lookup Console"
        title="Tracking Airway Bill"
        subtitle="Input AWB, tampilkan timestamp pada setiap status wajib, dan gunakan state human-friendly saat data belum ditemukan."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_320px]">
        <OpsPanel className="p-5">
          <SectionHeader title="AWB Lookup" subtitle="Query canonical memakai parameter `?awb=` agar hasil dapat dibagikan ulang dengan link yang sama." />
          <form onSubmit={handleSubmit} className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <label className="label">Nomor AWB</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[color:var(--muted-fg)]" />
                <input
                  value={awbInputValue}
                  onChange={(event) => {
                    setAwb(event.target.value);
                    setInputDirty(true);
                  }}
                  className="input-field input-field-leading"
                  placeholder="160-12345678"
                />
              </div>
              {error ? <p className="mt-2 text-sm text-[color:var(--tone-warning)]">{error}</p> : null}
            </div>
            <button type="submit" className="btn btn-primary self-end">
              <Radar size={16} />
              Lacak AWB
            </button>
          </form>

          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" className="btn btn-secondary" onClick={() => window.print()} disabled={!shipment}>
              <Printer size={16} />
              Print summary
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleCopyLink} disabled={!shipment}>
              <Share2 size={16} />
              Share link
            </button>
            <button type="button" className="btn btn-warning" onClick={handleReportIssue} disabled={!awbFromQuery}>
              <TriangleAlert size={16} />
              Report issue
            </button>
          </div>
          {actionMessage ? (
            <div className="mt-4 rounded-[18px] border border-[color:var(--tone-info-border)] bg-[color:var(--tone-info-soft)] px-4 py-3 text-sm font-medium text-[color:var(--tone-info)]">
              {actionMessage}
            </div>
          ) : null}
        </OpsPanel>

        <OpsPanel className="ops-pane-scroll p-5">
          <SectionHeader title="Recent Searches" subtitle="Riwayat pencarian AWB operator aktif." />
          <div className="mt-5 space-y-3">
            {recentSearches.length ? (
              recentSearches.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="flex w-full items-center justify-between rounded-[22px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-4 py-4 text-left"
                  onClick={() => router.push(`/awb-tracking?awb=${encodeURIComponent(item.awb)}`)}
                >
                  <span className="font-mono text-sm font-semibold text-[color:var(--brand-primary)]">{item.awb}</span>
                  <span className="text-xs text-[color:var(--muted-fg)]">{formatRelativeShort(item.createdAt)}</span>
                </button>
              ))
            ) : (
              <p className="text-sm text-[color:var(--muted-fg)]">Belum ada pencarian terbaru.</p>
            )}
          </div>
        </OpsPanel>
      </div>

      {loading ? (
        <OpsPanel className="p-10 text-center text-[color:var(--muted-fg)]">Mencari data AWB terbaru...</OpsPanel>
      ) : null}

      {!loading && notFound ? (
        <EmptyState
          icon={TriangleAlert}
          title="AWB belum ditemukan"
          copy="Nomor airway bill yang Anda masukkan belum tercatat di sistem. Periksa kembali inputnya atau hubungi supervisor operasional bila barang sudah seharusnya masuk gudang udara."
        />
      ) : null}

      {!loading && shipment ? (
        <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.3fr)_360px]">
          <OpsPanel className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[color:var(--border-soft)] pb-5">
              <div>
                <p className="ops-eyebrow">Tracking Result</p>
                <h2 className="mt-2 font-[family:var(--font-heading)] text-[2.2rem] font-black tracking-[-0.05em] text-[color:var(--brand-primary)]">
                  {shipment.awb}
                </h2>
                <p className="mt-2 text-sm text-[color:var(--muted-fg)]">
                  {shipment.shipper}{" -> "}{shipment.consignee}
                </p>
              </div>
              <StatusBadge value={shipment.status} label={shipment.statusLabel} />
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              <div className="ops-panel-muted p-4">
                <p className="label">Komoditas</p>
                <p className="font-semibold text-[color:var(--text-strong)]">{shipment.commodity}</p>
              </div>
              <div className="ops-panel-muted p-4">
                <p className="label">Rute</p>
                <p className="font-semibold text-[color:var(--text-strong)]">{shipment.origin}{" -> "}{shipment.destination}</p>
              </div>
              <div className="ops-panel-muted p-4">
                <p className="label">Flight</p>
                <p className="font-semibold text-[color:var(--text-strong)]">{shipment.flightNumber || "-"}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 lg:grid-cols-5">
              {stepTimeline.map((step, index) => (
                <div
                  key={step.key}
                  className={`rounded-[22px] border px-4 py-4 ${step.log ? "border-[color:var(--tone-success-border)] bg-[color:var(--tone-success-soft)]" : "border-[color:var(--border-soft)] bg-[color:var(--panel-muted)]"}`}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-2)]">Step {index + 1}</p>
                  <p className="mt-2 font-semibold text-[color:var(--text-strong)]">{step.label}</p>
                  <p className="mt-2 text-xs leading-5 text-[color:var(--muted-fg)]">
                    {step.log ? formatDateTime(step.log.createdAt) : "Menunggu update"}
                  </p>
                </div>
              ))}
            </div>

            <div className="ops-pane-scroll mt-8 space-y-4">
              {shipment.trackingLogs.map((log, index) => (
                <div key={log.id} className="grid grid-cols-[32px_1fr] gap-4">
                  <div className="flex flex-col items-center">
                    <div className="mt-1 h-3.5 w-3.5 rounded-full bg-[color:var(--brand-primary)]" />
                    {index < shipment.trackingLogs.length - 1 ? <div className="mt-1 h-full w-px bg-[color:var(--border-soft)]" /> : null}
                  </div>
                  <div className="pb-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="font-[family:var(--font-heading)] text-xl font-extrabold tracking-[-0.03em] text-[color:var(--text-strong)]">{log.label}</p>
                      <StatusBadge value={log.status} label={log.label} />
                    </div>
                    <p className="mt-2 text-sm leading-6">{log.message}</p>
                    <div className="mt-3 flex flex-wrap gap-4 text-xs text-[color:var(--muted-2)]">
                      <span>{formatDateTime(log.createdAt)}</span>
                      <span>{log.location}</span>
                      <span>{log.actorName || "System"}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </OpsPanel>

          <OpsPanel className="p-5">
            <SectionHeader title="Ringkasan Cepat" subtitle="Snapshot cepat untuk operator sebelum pindah ke modul lain." />
            <div className="mt-5 space-y-4">
              <div className="ops-panel-muted p-4">
                <p className="label">Status Terkini</p>
                <p className="font-[family:var(--font-heading)] text-2xl font-extrabold tracking-[-0.04em] text-[color:var(--text-strong)]">{shipment.statusLabel}</p>
              </div>
              <div className="ops-panel-muted p-4">
                <p className="label">Update Terakhir</p>
                <p className="font-semibold text-[color:var(--text-strong)]">{formatDateTime(shipment.trackingLogs.at(-1)?.createdAt || new Date())}</p>
              </div>
              <div className="ops-panel-muted p-4">
                <p className="label">Bagikan Hasil</p>
                <button type="button" className="btn btn-secondary mt-3 w-full" onClick={handleCopyLink}>
                  <Copy size={16} />
                  Copy link tracking
                </button>
              </div>
              <div className="ops-panel-muted p-4">
                <p className="label">Catatan Operator</p>
                <p className="text-sm leading-6 text-[color:var(--muted-fg)]">
                  Setiap perubahan status diambil dari `tracking_logs` untuk menjaga sumber kebenaran tetap konsisten dan bertimestamp.
                </p>
              </div>
            </div>
          </OpsPanel>
        </div>
      ) : null}
    </div>
  );
}
