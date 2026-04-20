"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Printer, Radar, Search, Share2, TriangleAlert } from "lucide-react";
import { AWB_REGEX } from "@/lib/constants";
import { cn, formatDateTime, formatRelativeShort } from "@/lib/format";
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
  docStatus: string;
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
  { key: "received", label: "Diterima" },
  { key: "sortation", label: "Sortasi" },
  { key: "loaded_to_aircraft", label: "Muat ke Pesawat" },
  { key: "departed", label: "Berangkat" },
  { key: "arrived", label: "Tiba" },
] as const;

export default function AwbTrackingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const awbFromQuery = searchParams.get("awb") || "";
  const [awb, setAwb] = useState(awbFromQuery);
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
    setAwb(awbFromQuery);
  }, [awbFromQuery]);

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
      return { ...step, log };
    });
  }, [shipment?.trackingLogs]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!AWB_REGEX.test(awb.trim())) {
      setError("Format AWB harus XXX-XXXXXXXX.");
      return;
    }

    setError("");
    router.push(`/awb-tracking?awb=${encodeURIComponent(awb.trim())}`);
  }

  async function handleCopyLink() {
    if (!awbFromQuery) return;
    const url = `${window.location.origin}/awb-tracking?awb=${encodeURIComponent(awbFromQuery)}`;
    await navigator.clipboard.writeText(url);
    setActionMessage("Tautan pelacakan berhasil disalin.");
  }

  async function handleReportIssue() {
    if (!awbFromQuery) return;
    const response = await fetch("/api/awb/report-issue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ awb: awbFromQuery }),
    });

    if (response.ok) {
      setActionMessage("Isu berhasil dicatat untuk ditinjau.");
    }
  }

  return (
    <div className="page-workspace">
      <PageHeader
        eyebrow="Pelacakan AWB"
        title="Pelacakan AWB"
        subtitle="Masukkan nomor AWB untuk melihat status wajib, timestamp, dan ringkasan perjalanan kargo."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <OpsPanel className="page-pane p-5">
          <SectionHeader title="Pencarian AWB" subtitle="Gunakan parameter `?awb=` agar hasil bisa dibagikan ulang dengan tautan yang sama." />
          <form onSubmit={handleSubmit} className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <label className="label">Nomor AWB</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[color:var(--muted-fg)]" />
                <input value={awb} onChange={(event) => setAwb(event.target.value)} className="input-field input-field-leading" placeholder="160-12345678" />
              </div>
              {error ? <p className="mt-2 text-sm text-[color:var(--tone-warning)]">{error}</p> : null}
            </div>
            <button type="submit" className="btn btn-primary self-end">
              <Radar size={16} />
              Lacak
            </button>
          </form>

          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" className="btn btn-secondary" onClick={() => window.print()} disabled={!shipment}>
              <Printer size={16} />
              Print
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleCopyLink} disabled={!shipment}>
              <Share2 size={16} />
              Salin Tautan
            </button>
            <button type="button" className="btn btn-warning" onClick={handleReportIssue} disabled={!awbFromQuery}>
              <TriangleAlert size={16} />
              Laporkan Isu
            </button>
          </div>

          {actionMessage ? (
            <div className="mt-4 rounded-[18px] border border-[color:var(--tone-info-border)] bg-[color:var(--tone-info-soft)] px-4 py-3 text-sm font-medium text-[color:var(--tone-info)]">
              {actionMessage}
            </div>
          ) : null}
        </OpsPanel>

        <div className="page-stack">
          <OpsPanel className="page-pane p-5">
            <SectionHeader title="Pencarian Terakhir" subtitle="Riwayat pencarian AWB untuk akun yang sedang aktif." />
            <div className="page-scroll mt-5 space-y-3">
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

          <OpsPanel className="page-pane p-5">
            <SectionHeader title="Ringkasan Cepat" subtitle="Ringkasan cepat hasil lookup aktif." />
            <div className="page-scroll mt-5 space-y-3">
              {shipment ? (
                <>
                  <div className="ops-panel-muted p-4">
                    <p className="label">Status</p>
                    <div className="mt-2">
                      <StatusBadge value={shipment.status} label={shipment.statusLabel} />
                    </div>
                  </div>
                  <div className="ops-panel-muted p-4">
                    <p className="label">Rute</p>
                    <p className="font-semibold text-[color:var(--text-strong)]">{shipment.origin}{" -> "}{shipment.destination}</p>
                  </div>
                  <div className="ops-panel-muted p-4">
                    <p className="label">Flight</p>
                    <p className="font-semibold text-[color:var(--text-strong)]">{shipment.flightNumber || "-"}</p>
                  </div>
                  <div className="ops-panel-muted p-4">
                    <p className="label">Dokumen</p>
                    <p className="font-semibold text-[color:var(--text-strong)]">{shipment.docStatus}</p>
                  </div>
                  <div className="ops-panel-muted p-4">
                    <p className="label">Update Terakhir</p>
                    <p className="font-semibold text-[color:var(--text-strong)]">
                      {formatDateTime(shipment.trackingLogs.at(-1)?.createdAt || new Date())}
                    </p>
                  </div>
                </>
              ) : (
                <p className="text-sm text-[color:var(--muted-fg)]">Ringkasan akan muncul setelah AWB berhasil ditemukan.</p>
              )}
            </div>
          </OpsPanel>
        </div>
      </div>

      {loading ? <OpsPanel className="p-10 text-center text-[color:var(--muted-fg)]">Mencari data AWB terbaru...</OpsPanel> : null}

      {!loading && notFound ? (
        <EmptyState
          icon={TriangleAlert}
          title="AWB belum ditemukan"
          copy="Nomor airway bill ini belum bisa ditampilkan. Periksa format AWB, pastikan digitnya benar, lalu hubungi supervisor bila kiriman seharusnya sudah masuk ke sistem."
        />
      ) : null}

      {!loading && shipment ? (
        <div className="page-grid-2">
          <OpsPanel className="page-pane p-5">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[color:var(--border-soft)] pb-5">
              <div>
                <p className="ops-eyebrow">Hasil Tracking</p>
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
                  className={cn(
                    "rounded-[22px] border px-4 py-4",
                    step.log
                      ? "border-[color:var(--tone-success-border)] bg-[color:var(--tone-success-soft)]"
                      : "border-[color:var(--border-soft)] bg-[color:var(--panel-muted)]",
                  )}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-2)]">Step {index + 1}</p>
                  <p className="mt-2 font-semibold text-[color:var(--text-strong)]">{step.label}</p>
                  <p className="mt-2 text-xs leading-5 text-[color:var(--muted-fg)]">
                    {step.log ? formatDateTime(step.log.createdAt) : "Menunggu update"}
                  </p>
                </div>
              ))}
            </div>

            <div className="page-scroll mt-8 space-y-4">
              {shipment.trackingLogs.map((log, index) => (
                <div key={log.id} className="rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-4 py-4">
                  <div className="flex items-start gap-4">
                    <div className="flex min-h-[36px] flex-col items-center">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--brand-primary-soft)] text-xs font-bold text-[color:var(--brand-primary)]">
                        {index + 1}
                      </span>
                      {index < shipment.trackingLogs.length - 1 ? <div className="mt-1 h-full w-px bg-[color:var(--border-soft)]" /> : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-[family:var(--font-heading)] text-xl font-extrabold tracking-[-0.03em] text-[color:var(--text-strong)]">{log.label}</p>
                          <p className="mt-2 text-sm leading-6 text-[color:var(--muted-fg)]">{log.message}</p>
                        </div>
                        <StatusBadge value={log.status} label={log.label} />
                      </div>
                      <p className="mt-3 text-xs text-[color:var(--muted-2)]">{formatDateTime(log.createdAt)} | {log.location} | {log.actorName || "Sistem"}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </OpsPanel>

          <OpsPanel className="page-pane p-5">
            <SectionHeader title="Ringkasan Status" subtitle="Status aktif dan timestamp terkini." />
            <div className="page-scroll mt-5 space-y-4">
              <div className="ops-panel-muted p-4">
                <p className="label">Status Aktif</p>
                <p className="font-[family:var(--font-heading)] text-2xl font-extrabold tracking-[-0.04em] text-[color:var(--text-strong)]">{shipment.statusLabel}</p>
              </div>
              <div className="ops-panel-muted p-4">
                <p className="label">Timestamp Terakhir</p>
                <p className="font-semibold text-[color:var(--text-strong)]">{formatDateTime(shipment.trackingLogs.at(-1)?.createdAt || new Date())}</p>
              </div>
              <div className="ops-panel-muted p-4">
                <p className="label">Catatan Data</p>
                <p className="text-sm leading-7 text-[color:var(--muted-fg)]">
                  Setiap perubahan status diambil langsung dari tracking log agar urutan status dan timestamp tetap konsisten.
                </p>
              </div>
            </div>
          </OpsPanel>
        </div>
      ) : null}
    </div>
  );
}
