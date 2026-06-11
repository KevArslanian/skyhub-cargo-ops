"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Clock3,
  History,
  LoaderCircle,
  MapPinned,
  ScanBarcode,
  Search,
  TriangleAlert,
} from "lucide-react";
import { validateAwb } from "@/lib/client-validation";
import { AWB_REGEX, getCargoIqMilestone, OPS_LIST_PAGE_SIZE } from "@/lib/constants";
import { formatAwbInput } from "@/lib/input-guards";
import { formatDateTime, formatRelativeShort } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";

import { GlassDatePicker } from "@/components/glass-date-picker";
import {
  CrudPageScaffold,
  EmptyState,
  FilterBar,
  FilterSearch,
  OpsPanel,
  PaginationBar,
  SectionHeader,
  SkeletonBlock,
} from "@/components/ops-ui";
import { OpsDrawer } from "@/components/ops-drawer";
import { useOpsAlert } from "@/components/ops-alert-provider";
import { networkErrorMessage } from "@/lib/ops-feedback";

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
  forwarder: string;
  ownerName: string;
  customerAccountName: string | null;
  serviceType: string;
  shippingRate: number;
  goodsStatus: string;
  transactionStatus: string;
  pieces: number;
  weightKg: number;
  readiness: string;
  flightNumber: string | null;
  vehicleName: string;
  docStatus: string;
  receivedAt: string;
  sentAt: string;
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

export default function AwbTrackingPage() {
  const { showAlert } = useOpsAlert();
  const router = useRouter();
  const searchParams = useSearchParams();
  const awbFromQuery = searchParams.get("awb") || "";
  const resultsRef = useRef<HTMLDivElement | null>(null);
  const shouldScrollToResultRef = useRef(false);
  const [awb, setAwb] = useState(awbFromQuery);
  const [trackedAwb, setTrackedAwb] = useState("");
  const [loading, setLoading] = useState(false);
  const [reportingIssue, setReportingIssue] = useState(false);

  const [shipment, setShipment] = useState<ShipmentPayload>(null);
  const [notFound, setNotFound] = useState(false);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [recentPage, setRecentPage] = useState(1);
  const [historyDateFrom, setHistoryDateFrom] = useState("");
  const [historyDateTo, setHistoryDateTo] = useState("");
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);

  const fetchRecentSearches = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (historyDateFrom) params.set("dateFrom", historyDateFrom);
      if (historyDateTo) params.set("dateTo", historyDateTo);
      const query = params.toString();
      const response = await fetch(`/api/awb/recent${query ? `?${query}` : ""}`, { cache: "no-store" });
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as { searches?: RecentSearch[] };
      setRecentSearches(payload.searches || []);
    } catch {
      showAlert({
        title: "Koneksi Terputus",
        description: networkErrorMessage("memuat riwayat pencarian AWB"),
        tone: "warning",
      });
    }
  }, [historyDateFrom, historyDateTo, showAlert]);

  useEffect(() => {
    setAwb(awbFromQuery);
  }, [awbFromQuery]);

  useEffect(() => {
    void fetchRecentSearches();
  }, [fetchRecentSearches, historyDateFrom, historyDateTo]);

  useEffect(() => {
    setRecentPage(1);
  }, [recentSearches.length]);

  const lookupAwb = useCallback(
    async (targetAwb: string) => {
      setLoading(true);
      setShipment(null);
      setNotFound(false);

      try {
        const response = await fetch(`/api/shipments?awb=${encodeURIComponent(targetAwb)}`, { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as { shipment?: ShipmentPayload; error?: string } | null;

        if (!response.ok) {
          showAlert({ title: "Gagal Memuat", description: payload?.error || "Pelacakan AWB belum bisa dimuat.", tone: "error" });
          return;
        }

        setShipment(payload?.shipment ?? null);
        setNotFound(!payload?.shipment);
        setTrackedAwb(targetAwb);
        if (payload?.shipment) {
          fetchRecentSearches();
        }
      } catch {
        showAlert({
          title: "Koneksi Terputus",
          description: networkErrorMessage("memuat pelacakan AWB"),
          tone: "warning",
        });
      } finally {
        setLoading(false);
        if (shouldScrollToResultRef.current) {
          shouldScrollToResultRef.current = false;
          window.setTimeout(() => {
            resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 80);
        }
      }
    },
    [fetchRecentSearches, showAlert],
  );

  useEffect(() => {
    const normalizedAwb = awbFromQuery.trim();
    if (!normalizedAwb || !AWB_REGEX.test(normalizedAwb)) return;
    void lookupAwb(normalizedAwb);
  }, [awbFromQuery, lookupAwb]);

  const compactTimelineLogs = useMemo(() => shipment?.trackingLogs.slice(-3) ?? [], [shipment?.trackingLogs]);
  const hiddenTimelineCount = Math.max(0, (shipment?.trackingLogs.length ?? 0) - compactTimelineLogs.length);
  const totalRecentPages = Math.max(1, Math.ceil(recentSearches.length / OPS_LIST_PAGE_SIZE));
  const currentRecentPage = Math.min(recentPage, totalRecentPages);
  const recentPageStart = (currentRecentPage - 1) * OPS_LIST_PAGE_SIZE;
  const pagedRecentSearches = recentSearches.slice(recentPageStart, recentPageStart + OPS_LIST_PAGE_SIZE);
  const recentVisibleStart = recentSearches.length ? recentPageStart + 1 : 0;
  const recentVisibleEnd = Math.min(recentPageStart + pagedRecentSearches.length, recentSearches.length);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedAwb = awb.trim();
    const awbValidation = validateAwb(normalizedAwb, "lookup");
    if (!awbValidation.ok) {
      showAlert({
        title: "Format Salah",
        description: awbValidation.message || "Format nomor resi harus XXX-XXXXXXXX, contoh: 160-10000001.",
        tone: "warning",
      });
      return;
    }

    shouldScrollToResultRef.current = true;
    const nextPath = `/awb-tracking?awb=${encodeURIComponent(normalizedAwb)}`;
    if (nextPath !== `/awb-tracking?awb=${encodeURIComponent(awbFromQuery)}`) {
      router.push(nextPath);
    }
    void lookupAwb(normalizedAwb);
  }

  function openHistoryAwb(nextAwb: string) {
    setHistoryDrawerOpen(false);
    setAwb(nextAwb);
    shouldScrollToResultRef.current = true;
    const nextPath = `/awb-tracking?awb=${encodeURIComponent(nextAwb)}`;
    router.push(nextPath);
    void lookupAwb(nextAwb);
  }

  async function handleReportIssue() {
    if (!trackedAwb || !AWB_REGEX.test(trackedAwb.trim())) {
      showAlert({ title: "Input Tidak Valid", description: "Format AWB tidak valid untuk melaporkan masalah.", tone: "warning" });
      return;
    }

    setReportingIssue(true);
    try {
      const response = await fetch("/api/awb/report-issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ awb: trackedAwb }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (response.ok) {
        showAlert({ title: "Berhasil", description: "Masalah AWB sudah masuk Pusat Peringatan untuk ditindaklanjuti.", tone: "success" });
      } else {
        showAlert({ title: "Gagal", description: payload?.error || "Gagal mencatat masalah AWB.", tone: "error" });
      }
    } catch {
      showAlert({ title: "Koneksi Terputus", description: "Koneksi terputus saat mencatat masalah AWB.", tone: "warning" });
    } finally {
      setReportingIssue(false);
    }
  }

  return (
    <CrudPageScaffold
      className="awb-tracking-workspace"
      eyebrow="Pelacakan"
      title="Pelacakan AWB"
      subtitle="Cari nomor AWB untuk membuka status kiriman, rute, dan linimasa event operasional."
      actions={
        <button type="button" className="btn btn-secondary" onClick={() => setHistoryDrawerOpen(true)}>
          <History size={16} />
          Riwayat Lacakan
        </button>
      }
      filters={
        <FilterBar ariaLabel="Filter pelacakan AWB">
          <FilterSearch>
            <label className="label" htmlFor="awb-tracking-input">
              Nomor AWB
            </label>
            <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[color:var(--muted-fg)]" />
                <input
                  id="awb-tracking-input"
                  value={awb}
                  onChange={(event) => setAwb(formatAwbInput(event.target.value))}
                  className="input-field input-field-leading"
                  placeholder="Contoh: 123-45678901"
                  aria-describedby="awb-helper-text"
                />
              </div>
              <button type="submit" className="btn btn-primary h-[48px] shrink-0 px-5" disabled={loading} aria-label="Lacak AWB">
                {loading ? <LoaderCircle size={16} className="animate-spin" /> : <ScanBarcode size={16} />}
                Lacak
              </button>
            </form>
            <p id="awb-helper-text" className="mt-2 text-xs text-[color:var(--muted-fg)]">
              Format: 3 digit - 8 digit (contoh: 123-45678901)
            </p>
          </FilterSearch>
        </FilterBar>
      }
      body={
      <>
      <div className="awb-tracking-layout flex min-h-0 flex-1 flex-col gap-5">
        <div className="page-stack min-h-0">
          <OpsPanel className="page-pane awb-tracking-panel flex h-full min-h-0 flex-col overflow-hidden p-0">
            <div className="shrink-0 border-b border-[color:var(--border-soft)] p-4 sm:p-5">
              <SectionHeader
                title="Hasil Pelacakan"
                subtitle="Gunakan filter di atas untuk mencari AWB. Riwayat pencarian tersedia lewat tombol Riwayat Lacakan."
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-warning"
                  onClick={handleReportIssue}
                  disabled={!shipment || reportingIssue}
                  title={!shipment ? "Laporkan isu tersedia setelah hasil pelacakan muncul" : undefined}
                >
                  {reportingIssue ? <LoaderCircle size={16} className="animate-spin" /> : <TriangleAlert size={16} />}
                  {reportingIssue ? "Mencatat..." : "Laporkan Isu"}
                </button>
              </div>


            </div>

            <div ref={resultsRef} className="awb-tracking-results min-h-0 flex-1 overflow-hidden p-4 sm:p-5">
              {loading ? (
                <div className="space-y-4">
                  <SkeletonBlock className="h-24 w-full rounded-[24px]" />
                  <SkeletonBlock className="h-24 w-full rounded-[24px]" />
                  <SkeletonBlock className="h-24 w-full rounded-[24px]" />
                </div>
              ) : null}

            {!loading && !trackedAwb && !shipment && !notFound ? (
              <EmptyState
                icon={ScanBarcode}
                title="Pelacakan siap digunakan"
                copy="Masukkan nomor resi lalu tekan Lacak untuk menampilkan status, rute pengiriman, dan kronologi event."
                className="awb-tracking-empty py-10"
              />
            ) : null}

            {!loading && trackedAwb && notFound ? (
              <EmptyState
                icon={TriangleAlert}
                title="Resi belum ditemukan"
                copy="Nomor resi tidak ada di sistem. Periksa penulisan lalu coba lagi, atau hubungi petugas cargo."
                className="awb-tracking-empty py-10"
              />
            ) : null}

            {!loading && trackedAwb && shipment ? (
              <div className="awb-tracking-summary space-y-4">
                <div className="rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="label">Ringkasan Pelacakan</p>
                      <h2 className="mt-2 font-mono text-2xl font-black text-[color:var(--brand-primary)]">{shipment.awb}</h2>
                      <p className="mt-2 inline-flex flex-wrap items-center gap-2 text-sm text-[color:var(--muted-fg)]">
                        <MapPinned size={14} className="shrink-0 text-[color:var(--brand-primary)]" />
                        <span className="font-semibold text-[color:var(--text-strong)]">{shipment.origin}</span>
                        <span aria-hidden="true">→</span>
                        <span className="font-semibold text-[color:var(--text-strong)]">{shipment.destination}</span>
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <StatusBadge value={shipment.status} label={shipment.statusLabel} />
                      <p className="text-xs font-semibold text-[color:var(--muted-fg)]">
                        Diperbarui {formatDateTime(shipment.updatedAt)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-5">
                  <p className="label">Event Terbaru</p>
                  <div className="mt-4 space-y-3">
                    {compactTimelineLogs.length ? (
                      compactTimelineLogs.map((log) => {
                        const milestone = getCargoIqMilestone(log.status);
                        return (
                          <div
                            key={log.id}
                            className="rounded-[20px] border border-[color:var(--border-soft)] bg-[color:var(--panel-bg)] px-4 py-3"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-semibold text-[color:var(--text-strong)]">{log.label}</p>
                                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-primary)]">
                                  Cargo iQ {milestone.code} · {milestone.title}
                                </p>
                              </div>
                              <StatusBadge value={log.status} label={log.label} />
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[color:var(--muted-2)]">
                              <span className="inline-flex items-center gap-1.5">
                                <Clock3 size={13} />
                                {formatDateTime(log.createdAt)}
                              </span>
                              <span className="inline-flex items-center gap-1.5">
                                <MapPinned size={13} />
                                {log.location}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-sm text-[color:var(--muted-fg)]">Belum ada event pelacakan.</p>
                    )}
                    {hiddenTimelineCount > 0 ? (
                      <p className="text-xs font-semibold text-[color:var(--muted-fg)]">
                        +{hiddenTimelineCount} event lainnya tidak ditampilkan di ringkasan.
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
            </div>
          </OpsPanel>
        </div>
      </div>

      <OpsDrawer
        open={historyDrawerOpen}
        eyebrow="Pelacakan"
        title="Riwayat Lacakan"
        description="Riwayat pencarian AWB terakhir. Pilih entri untuk memuat ulang hasil pelacakan."
        onClose={() => setHistoryDrawerOpen(false)}
      >
        <div className="flex min-h-0 flex-1 flex-col gap-5">
          <div className="awb-history-date-filters grid shrink-0 gap-4 sm:grid-cols-2">
            <div className="awb-history-date-field">
              <label className="label" htmlFor="awb-history-from">
                Tanggal Awal
              </label>
              <GlassDatePicker id="awb-history-from" aria-label="Tanggal awal" value={historyDateFrom} onChange={setHistoryDateFrom} />
            </div>
            <div className="awb-history-date-field">
              <label className="label" htmlFor="awb-history-to">
                Tanggal Akhir
              </label>
              <GlassDatePicker
                id="awb-history-to"
                aria-label="Tanggal akhir"
                min={historyDateFrom || undefined}
                value={historyDateTo}
                onChange={setHistoryDateTo}
              />
            </div>
          </div>

          <p className="shrink-0 text-xs font-semibold text-[color:var(--muted-fg)]" aria-live="polite">
            {recentSearches.length} riwayat pelacakan
          </p>

          <div
            className="awb-history-list internal-scrollbar min-h-0 flex-1 space-y-3 overflow-x-hidden overflow-y-auto overscroll-y-contain"
            role="list"
            aria-label="Riwayat pelacakan AWB"
          >
            {recentSearches.length ? (
              pagedRecentSearches.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="listitem"
                  className="w-full rounded-[20px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-4 py-4 text-left hover:bg-[color:var(--brand-primary-soft)]"
                  onClick={() => openHistoryAwb(item.awb)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-semibold text-[color:var(--brand-primary)]">{item.awb}</p>
                      <p className="mt-1 text-xs text-[color:var(--muted-fg)]">
                        {item.origin && item.destination ? `${item.origin} -> ${item.destination}` : "Riwayat pelacakan"}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-[color:var(--muted-fg)]">{formatRelativeShort(item.createdAt)}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    {item.status && item.statusLabel ? (
                      <StatusBadge value={item.status} label={item.statusLabel} />
                    ) : (
                      <StatusBadge value="pending" label="Belum aktif" />
                    )}
                    <span className="shrink-0 text-xs text-[color:var(--muted-fg)]">{item.flightNumber || "-"}</span>
                  </div>
                </button>
              ))
            ) : (
              <EmptyState icon={History} variant="neutral" title="Belum ada riwayat" copy="Riwayat pencarian AWB akan muncul di sini setelah kamu melakukan pelacakan." />
            )}
          </div>

          {recentSearches.length > OPS_LIST_PAGE_SIZE ? (
            <div className="awb-history-pagination shrink-0 border-t border-[color:var(--border-soft)] bg-[color:var(--panel-bg)] pt-3">
              <PaginationBar
                page={currentRecentPage}
                totalPages={totalRecentPages}
                visibleStart={recentVisibleStart}
                visibleEnd={recentVisibleEnd}
                totalItems={recentSearches.length}
                onPageChange={(nextPage) => setRecentPage(nextPage)}
                label="Riwayat"
              />
            </div>
          ) : null}
        </div>
      </OpsDrawer>
      </>
      }
    />
  );
}
