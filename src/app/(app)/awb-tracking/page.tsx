"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileCheck2,
  History,
  LoaderCircle,
  MapPinned,
  Package2,
  PlaneTakeoff,
  Printer,
  Radar,
  Search,
  TriangleAlert,
} from "lucide-react";
import { AWB_REGEX } from "@/lib/constants";
import { t } from "@/lib/i18n";
import { formatDateTime, formatRelativeShort, formatWeight } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState, OpsPanel, PageHeader, SectionHeader, SkeletonBlock } from "@/components/ops-ui";

type TrackingLog = {
  id: string;
  label: string;
  status: string;
  message: string;
  location: string;
  actorName: string | null;
  createdAt: string;
};

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
  customerAccountName: string | null;
  pieces: number;
  weightKg: number;
  readiness: string;
  flightNumber: string | null;
  docStatus: string;
  updatedAt: string;
  trackingLogs: TrackingLog[];
} | null;

type RecentSearch = {
  id: string;
  awb: string;
  createdAt: string;
  status: string | null;
  statusLabel: string | null;
  origin: string | null;
  destination: string | null;
  flightNumber: string | null;
};

const RECENT_PAGE_SIZE = 4;

export default function AwbTrackingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const awbFromQuery = searchParams.get("awb") || "";
  const resultsRef = useRef<HTMLDivElement | null>(null);
  const shouldScrollToResultRef = useRef(Boolean(awbFromQuery));
  const [awb, setAwb] = useState(awbFromQuery);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [shipment, setShipment] = useState<ShipmentPayload>(null);
  const [notFound, setNotFound] = useState(false);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [recentPage, setRecentPage] = useState(1);

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
    setRecentPage(1);
  }, [recentSearches.length]);

  useEffect(() => {
    async function lookup() {
      if (!awbFromQuery) {
        setShipment(null);
        setNotFound(false);
        return;
      }

      setLoading(true);
      setError("");
      setNotFound(false);

      try {
        const response = await fetch(`/api/shipments?awb=${encodeURIComponent(awbFromQuery)}`, { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Gagal mengambil data");
        }
        const payload = (await response.json()) as { shipment: ShipmentPayload };
        setShipment(payload.shipment);
        setNotFound(!payload.shipment);
        if (payload.shipment) {
          setLastUpdated(new Date());
        }
      } catch {
        setError(t('awb.fetchFailed'));
        setNotFound(true);
      } finally {
        setLoading(false);
        fetchRecentSearches();
      }

      if (shouldScrollToResultRef.current) {
        shouldScrollToResultRef.current = false;
        window.setTimeout(() => {
          resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 80);
      }
    }

    void lookup();
  }, [awbFromQuery, fetchRecentSearches]);

  const activeLog = useMemo(() => shipment?.trackingLogs.at(-1) ?? null, [shipment?.trackingLogs]);
  const totalRecentPages = Math.max(1, Math.ceil(recentSearches.length / RECENT_PAGE_SIZE));
  const currentRecentPage = Math.min(recentPage, totalRecentPages);
  const recentPageStart = (currentRecentPage - 1) * RECENT_PAGE_SIZE;
  const pagedRecentSearches = recentSearches.slice(recentPageStart, recentPageStart + RECENT_PAGE_SIZE);
  const recentVisibleStart = recentSearches.length ? recentPageStart + 1 : 0;
  const recentVisibleEnd = Math.min(recentPageStart + pagedRecentSearches.length, recentSearches.length);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = awb.trim();
    if (!trimmed) {
      setError("Masukkan nomor AWB yang ingin dilacak.");
      return;
    }
    if (!AWB_REGEX.test(trimmed)) {
      setError(t('awb.invalid'));
      return;
    }

    setError("");
    shouldScrollToResultRef.current = true;
    const nextPath = `/awb-tracking?awb=${encodeURIComponent(awb.trim())}`;
    if (nextPath === `/awb-tracking?awb=${encodeURIComponent(awbFromQuery)}`) {
      window.setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
      return;
    }
    router.push(nextPath);
  }

  function openHistoryAwb(nextAwb: string) {
    shouldScrollToResultRef.current = true;
    const nextPath = `/awb-tracking?awb=${encodeURIComponent(nextAwb)}`;
    if (nextPath === `/awb-tracking?awb=${encodeURIComponent(awbFromQuery)}`) {
      window.setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
      return;
    }
    router.push(nextPath);
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
    <div className="page-workspace awb-tracking-workspace">
      <PageHeader
        eyebrow="Pelacakan AWB"
        title="Pelacakan AWB"
        subtitle="Input tracking dan history tracking dalam alur yang ringkas."
      />

      <div className="awb-tracking-layout grid items-stretch gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.92fr)]">
        <div className="page-stack">
          <OpsPanel className="page-pane awb-tracking-panel h-full overflow-hidden p-0">
            <div className="border-b border-[color:var(--border-soft)] p-6">
              <SectionHeader
                title="Input Tracking"
                subtitle="Masukkan nomor AWB untuk membuka status, ringkasan kiriman, dan timeline event."
              />
              <form onSubmit={handleSubmit} className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
                <div>
                  <label className="label">Nomor AWB</label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[color:var(--muted-fg)]" />
                    <input
                      value={awb}
                      onChange={(event) => setAwb(event.target.value)}
                      className="input-field input-field-leading h-[56px] text-lg font-semibold tracking-[0.03em]"
                      placeholder="160-12345678"
                    />
                  </div>
                  {error ? (
                    <div className="mt-2 flex items-start gap-2 rounded-xl border border-[color:var(--tone-warning-border)] bg-[color:var(--tone-warning-soft)] px-3 py-2 text-sm text-[color:var(--tone-warning)]">
                      <TriangleAlert size={16} className="mt-0.5 shrink-0" />
                      <span>{error}</span>
                    </div>
                  ) : null}
                </div>
                <button type="submit" className="btn btn-primary h-[56px] self-end px-6">
                  {loading ? <LoaderCircle size={17} className="animate-spin" /> : <Radar size={16} />}
                  Lacak
                </button>
              </form>

              <div className="mt-4 flex flex-wrap gap-3">
                {shipment ? (
                  <Link href={`/exports/awb?awb=${encodeURIComponent(shipment.awb)}`} className="btn btn-secondary">
                    <Printer size={16} />
                    Print
                  </Link>
                ) : (
                  <button type="button" className="btn btn-secondary" disabled>
                    <Printer size={16} />
                    Print
                  </button>
                )}
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
            </div>

            <div ref={resultsRef} className="awb-tracking-results scroll-mt-24 p-6">
              {loading ? (
                <div className="space-y-4">
                  <SkeletonBlock className="h-24 w-full rounded-[24px]" />
                  <SkeletonBlock className="h-24 w-full rounded-[24px]" />
                  <SkeletonBlock className="h-24 w-full rounded-[24px]" />
                </div>
              ) : null}

            {!loading && !shipment && !notFound ? (
              <EmptyState
                icon={Radar}
                title="Tracking siap digunakan"
                copy="Masukkan AWB valid untuk menampilkan status, ringkasan, dan kronologi pengiriman."
                className="awb-tracking-empty py-10"
              />
            ) : null}

            {!loading && notFound ? (
              <EmptyState
                icon={TriangleAlert}
                title="AWB tidak ditemukan"
                copy="Pastikan nomor AWB yang Anda masukkan sudah benar dan sudah terdaftar di sistem. Hubungi tim operasional jika Anda yakin AWB tersebut sudah dikirim."
                className="awb-tracking-empty py-10"
              />
            ) : null}

            {!loading && shipment ? (
              <div className="space-y-5">
                <div className="rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-5">
                  <div>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="label">Hasil Tracking</p>
                        <h2 className="mt-2 font-mono text-2xl font-black text-[color:var(--brand-primary)]">{shipment.awb}</h2>
                        <p className="mt-1 text-sm text-[color:var(--muted-fg)]">
                          {shipment.origin} → {shipment.destination}
                        </p>
                      </div>
                      <StatusBadge value={shipment.status} label={shipment.statusLabel} />
                    </div>

                    <div className="mt-3 text-[10px] uppercase tracking-[0.16em] text-[color:var(--muted-2)]">
                      Data diambil langsung dari database operasional
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-[color:var(--muted-fg)]">
                    <span><strong className="text-[color:var(--text-strong)]">Flight:</strong> {shipment.flightNumber || "-"}</span>
                    <span><strong className="text-[color:var(--text-strong)]">Dokumen:</strong> {shipment.docStatus}</span>
                    <span><strong className="text-[color:var(--text-strong)]">Kargo:</strong> {shipment.pieces} pcs • {formatWeight(shipment.weightKg)}</span>
                    <span><strong className="text-[color:var(--text-strong)]">Update:</strong> {formatRelativeShort(activeLog?.createdAt || shipment.updatedAt)}</span>
                  </div>
                </div>

                <div className="rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-5">
                  <div className="flex items-center justify-between">
                    <p className="label">Timeline Tracking</p>
                    {lastUpdated && (
                      <span className="text-[10px] uppercase tracking-[0.14em] text-[color:var(--muted-2)]">
                        Diperbarui {formatRelativeShort(lastUpdated.toISOString())}
                      </span>
                    )}
                  </div>
                  <div className="mt-4 space-y-3">
                    {shipment.trackingLogs.length ? (
                      shipment.trackingLogs.map((log) => (
                        <div
                          key={log.id}
                          className="rounded-[20px] border border-[color:var(--border-soft)] bg-[color:var(--panel-bg)] px-4 py-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-[color:var(--text-strong)]">{log.label}</p>
                              <p className="mt-1 text-sm text-[color:var(--muted-fg)]">{log.message}</p>
                            </div>
                            <StatusBadge value={log.status} label={log.label} />
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[color:var(--muted-2)]">
                            <span className="inline-flex items-center gap-1.5">
                              <Clock3 size={13} />
                              {formatDateTime(log.createdAt)}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <MapPinned size={13} />
                              {log.location}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <History size={13} />
                              {log.actorName || "Sistem"}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-[color:var(--border-soft)] bg-[color:var(--panel-bg)] p-6 text-center">
                        <p className="text-sm text-[color:var(--muted-fg)]">
                          Belum ada catatan perjalanan untuk AWB ini.
                        </p>
                        <p className="mt-1 text-xs text-[color:var(--muted-2)]">
                          Status akan muncul otomatis setelah barang diproses di gudang.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
            </div>
          </OpsPanel>
        </div>

        <OpsPanel className="awb-history-panel p-5">
          <SectionHeader title="History Tracking" subtitle="Riwayat pencarian AWB terakhir untuk akses cepat." />
          <div className="awb-history-list mt-5 space-y-3">
            {recentSearches.length ? (
              pagedRecentSearches.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="w-full rounded-[20px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-4 py-4 text-left hover:bg-[color:var(--brand-primary-soft)]"
                  onClick={() => openHistoryAwb(item.awb)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-sm font-semibold text-[color:var(--brand-primary)]">{item.awb}</p>
                      <p className="mt-1 text-xs text-[color:var(--muted-fg)]">
                        {item.origin && item.destination ? `${item.origin} -> ${item.destination}` : "Riwayat tracking"}
                      </p>
                    </div>
                    <span className="text-xs text-[color:var(--muted-fg)]">{formatRelativeShort(item.createdAt)}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    {item.status && item.statusLabel ? (
                      <StatusBadge value={item.status} label={item.statusLabel} />
                    ) : (
                      <StatusBadge value="pending" label="Belum aktif" />
                    )}
                    <span className="text-xs text-[color:var(--muted-fg)]">{item.flightNumber || "-"}</span>
                  </div>
                </button>
              ))
            ) : (
              <p className="text-sm text-[color:var(--muted-fg)]">Belum ada riwayat tracking.</p>
            )}
          </div>
          {recentSearches.length > RECENT_PAGE_SIZE ? (
            <div className="table-pagination-footer mt-4">
              <button
                type="button"
                className="topbar-button"
                onClick={() => setRecentPage((current) => Math.max(1, current - 1))}
                disabled={currentRecentPage <= 1}
              >
                <ChevronLeft size={16} />
                Sebelumnya
              </button>
              <p>
                {recentVisibleStart}-{recentVisibleEnd} dari {recentSearches.length} • Halaman {currentRecentPage}/{totalRecentPages}
              </p>
              <button
                type="button"
                className="topbar-button"
                onClick={() => setRecentPage((current) => Math.min(totalRecentPages, current + 1))}
                disabled={currentRecentPage >= totalRecentPages}
              >
                Berikutnya
                <ChevronRight size={16} />
              </button>
            </div>
          ) : null}
        </OpsPanel>
      </div>
    </div>
  );
}
