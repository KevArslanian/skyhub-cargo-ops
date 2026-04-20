"use client";

import { useCallback, useEffect, useMemo, useState, type ComponentProps } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  CircleDashed,
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
  Share2,
  TriangleAlert,
  UserRound,
  Weight,
} from "lucide-react";
import { AWB_REGEX } from "@/lib/constants";
import { cn, formatDateTime, formatRelativeShort, formatWeight } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { DataCard, EmptyState, OpsPanel, PageHeader, SectionHeader, SkeletonBlock } from "@/components/ops-ui";

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
  updatedAt: string | null;
  docStatus: string | null;
};

const requiredSteps = [
  { key: "received", label: "Diterima" },
  { key: "sortation", label: "Sortasi" },
  { key: "loaded_to_aircraft", label: "Muat ke Pesawat" },
  { key: "departed", label: "Berangkat" },
  { key: "arrived", label: "Tiba" },
] as const;

type DataCardTone = ComponentProps<typeof DataCard>["tone"];

function SearchBlank({
  title,
  copy,
  recentSearches,
  onPickRecent,
}: {
  title: string;
  copy: string;
  recentSearches: RecentSearch[];
  onPickRecent: (awb: string) => void;
}) {
  return (
    <OpsPanel className="overflow-hidden p-0">
      <div className="grid gap-0 xl:grid-cols-[minmax(0,1.1fr)_320px]">
        <div className="p-6 lg:p-7">
          <div className="inline-flex h-13 w-13 items-center justify-center rounded-[20px] bg-[color:var(--brand-primary-soft)] text-[color:var(--brand-primary)]">
            <Radar size={22} />
          </div>
          <h2 className="mt-5 font-[family:var(--font-heading)] text-[2rem] font-black tracking-[-0.05em] text-[color:var(--text-strong)]">
            {title}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[color:var(--muted-fg)]">{copy}</p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <DataCard
              label="Format cepat"
              value={<span className="font-mono text-[color:var(--brand-primary)]">160-12345678</span>}
              note="Gunakan format tiga digit prefix, tanda hubung, lalu delapan digit nomor AWB."
              tone="primary"
            />
            <DataCard
              label="Hint pencarian"
              value="Lacak dari AWB aktif"
              note="Setelah lookup berhasil, timeline, summary shipment, dan event log akan langsung diprioritaskan di atas fold."
            />
          </div>

          <div className="mt-6 rounded-[26px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="label">Placeholder Timeline</p>
                <p className="text-sm text-[color:var(--muted-fg)]">Urutan milestone yang akan muncul setelah AWB ditemukan.</p>
              </div>
              <StatusBadge value="pending" label="Menunggu lookup" />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-5">
              {requiredSteps.map((step, index) => (
                <div key={step.key} className="rounded-[22px] border border-dashed border-[color:var(--border-strong)] bg-white/60 px-4 py-4 dark:bg-white/[0.02]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-2)]">Step {index + 1}</p>
                  <p className="mt-2 font-semibold text-[color:var(--text-strong)]">{step.label}</p>
                  <p className="mt-3 text-xs leading-5 text-[color:var(--muted-fg)]">Timestamp dan lokasi akan tampil otomatis.</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-[color:var(--border-soft)] bg-[color:var(--panel-muted)]/70 p-6 lg:p-7 xl:border-l xl:border-t-0">
          <p className="ops-eyebrow">Pencarian Terakhir</p>
          <p className="mt-3 text-sm leading-7 text-[color:var(--muted-fg)]">
            Gunakan riwayat AWB untuk memulai lookup ulang tanpa mengetik ulang nomor kiriman.
          </p>

          <div className="mt-5 space-y-3">
            {recentSearches.length ? (
              recentSearches.slice(0, 4).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="w-full rounded-[22px] border border-[color:var(--border-soft)] bg-[color:var(--panel-bg)] px-4 py-4 text-left transition-colors hover:bg-[color:var(--brand-primary-soft)]"
                  onClick={() => onPickRecent(item.awb)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-sm font-semibold text-[color:var(--brand-primary)]">{item.awb}</p>
                      <p className="mt-1 text-xs text-[color:var(--muted-fg)]">
                        {item.origin && item.destination ? `${item.origin} -> ${item.destination}` : "Lookup tercatat"}
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
                    <span className="text-xs text-[color:var(--muted-fg)]">{item.flightNumber || "Belum ada flight"}</span>
                  </div>
                </button>
              ))
            ) : (
              <p className="text-sm text-[color:var(--muted-fg)]">Belum ada pencarian AWB yang tersimpan untuk akun ini.</p>
            )}
          </div>
        </div>
      </div>
    </OpsPanel>
  );
}

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
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);

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

  const stepTimeline = useMemo(
    () =>
      requiredSteps.map((step) => {
        const log = shipment?.trackingLogs.find((item) => item.status === step.key) ?? null;
        return { ...step, log };
      }),
    [shipment?.trackingLogs],
  );

  const activeLog = shipment?.trackingLogs.at(-1) ?? null;
  const completedSteps = stepTimeline.filter((step) => step.log).length;
  const progressPercent = shipment ? (completedSteps / requiredSteps.length) * 100 : 0;
  const hasException =
    shipment &&
    (shipment.status === "hold" ||
      shipment.docStatus.toLowerCase() !== "complete" ||
      shipment.readiness.toLowerCase() !== "ready");

  const intelligenceItems: Array<{
    label: string;
    value: string;
    note: string;
    tone: DataCardTone;
  }> = shipment
    ? [
        {
          label: "Update terakhir",
          value: formatDateTime(activeLog?.createdAt || shipment.updatedAt),
          note: activeLog ? `${activeLog.label} di ${activeLog.location}` : "Belum ada event log",
          tone: hasException ? "warning" : ("success" as const),
        },
        {
          label: "Progress",
          value: `${completedSteps}/${requiredSteps.length} milestone`,
          note: shipment.statusLabel,
          tone: "primary" as const,
        },
        {
          label: "Dokumen",
          value: shipment.docStatus,
          note: `Readiness ${shipment.readiness}`,
          tone:
            shipment.docStatus.toLowerCase() === "complete" && shipment.readiness.toLowerCase() === "ready"
              ? ("success" as const)
              : ("warning" as const),
        },
      ]
    : [
        {
          label: "Contoh format",
          value: "160-12345678",
          note: "Masukkan AWB lengkap untuk membuka timeline perjalanan.",
          tone: "primary" as const,
        },
        {
          label: "Pencarian cepat",
          value: `${recentSearches.length} riwayat`,
          note: "Riwayat lookup aktif bisa dipakai ulang dari panel samping.",
          tone: "info" as const,
        },
        {
          label: "State hasil",
          value: "Command center siap",
          note: "Shipment summary, alerts, dan event log akan tampil setelah lookup berhasil.",
          tone: "default" as const,
        },
      ];

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
        subtitle="Ubah halaman lookup menjadi command center tracking: input besar, state hasil dominan, dan timeline perjalanan langsung terbaca oleh operator."
      />

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.55fr)_360px]">
        <div className="page-stack">
          <OpsPanel className="overflow-hidden p-0">
            <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="p-6 lg:p-7">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="ops-eyebrow">Lookup Command Center</p>
                    <h2 className="mt-3 font-[family:var(--font-heading)] text-[1.8rem] font-black tracking-[-0.05em] text-[color:var(--text-strong)]">
                      Cari AWB, prioritaskan hasil, dan teruskan aksi dari konteks yang sama.
                    </h2>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-[color:var(--muted-fg)]">
                      Input AWB dibuat lebih dominan agar operator dapat langsung membuka status utama, timestamp, alert, dan log kronologis tanpa area kosong yang tidak produktif.
                    </p>
                  </div>
                  <StatusBadge value={loading ? "live" : "synced"} label={loading ? "Sedang sinkron" : "Siap lacak"} />
                </div>

                <form onSubmit={handleSubmit} className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
                  <div>
                    <label className="label">Nomor AWB</label>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[color:var(--muted-fg)]" />
                      <input
                        value={awb}
                        onChange={(event) => setAwb(event.target.value)}
                        className="input-field input-field-leading h-[58px] text-lg font-semibold tracking-[0.03em]"
                        placeholder="160-12345678"
                      />
                    </div>
                    {error ? <p className="mt-2 text-sm text-[color:var(--tone-warning)]">{error}</p> : null}
                  </div>

                  <button type="submit" className="btn btn-primary h-[58px] self-end px-6">
                    {loading ? <LoaderCircle size={17} className="animate-spin" /> : <Radar size={16} />}
                    Lacak
                  </button>
                </form>

                <div className="mt-5 rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="label">Quick Actions</p>
                      <p className="text-sm text-[color:var(--muted-fg)]">
                        Print, salin tautan, dan laporkan isu disusun dalam satu bar aksi yang dekat dengan input.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
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
                  </div>
                </div>

                {actionMessage ? (
                  <div className="mt-4 rounded-[18px] border border-[color:var(--tone-info-border)] bg-[color:var(--tone-info-soft)] px-4 py-3 text-sm font-medium text-[color:var(--tone-info)]">
                    {actionMessage}
                  </div>
                ) : null}
              </div>

              <div className="border-t border-[color:var(--border-soft)] bg-[color:var(--panel-muted)]/70 p-6 lg:p-7 xl:border-l xl:border-t-0">
                <p className="ops-eyebrow">Pintasan Tracking</p>
                <div className="mt-4 space-y-4">
                  <DataCard
                    label="Format valid"
                    value={<span className="font-mono text-[color:var(--brand-primary)]">160-12345678</span>}
                    note="Prefix tiga digit, tanda hubung, delapan digit nomor airway bill."
                    tone="primary"
                  />
                  <DataCard
                    label="Hasil dominan"
                    value="Timeline di atas fold"
                    note="Begitu AWB ditemukan, status utama, route, alert, dan milestone langsung mengambil area primer."
                  />
                  <DataCard
                    label="State tracking"
                    value="Empty, loading, success, warning"
                    note="Setiap state dibuat eksplisit agar operator tahu apa yang terjadi sebelum dan sesudah lookup."
                  />
                </div>
              </div>
            </div>
          </OpsPanel>

          {loading ? (
            <OpsPanel className="p-6">
              <div className="grid gap-4">
                <SkeletonBlock className="h-6 w-40" />
                <SkeletonBlock className="h-[124px] w-full rounded-[26px]" />
                <div className="grid gap-3 md:grid-cols-5">
                  {requiredSteps.map((step) => (
                    <SkeletonBlock key={step.key} className="h-[120px] w-full rounded-[22px]" />
                  ))}
                </div>
                <div className="grid gap-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <SkeletonBlock key={index} className="h-[110px] w-full rounded-[24px]" />
                  ))}
                </div>
              </div>
            </OpsPanel>
          ) : null}

          {!loading && !shipment && !notFound ? (
            <SearchBlank
              title="Masukkan AWB untuk membuka perjalanan kargo secara utuh."
              copy="Halaman ini sekarang diprioritaskan untuk timeline dan hasil tracking, bukan sekadar form kosong. Begitu nomor AWB valid dimasukkan, hasil aktif akan tampil sebagai panel utama lengkap dengan ringkasan flight, dokumen, berat, consignee, dan event log."
              recentSearches={recentSearches}
              onPickRecent={(nextAwb) => router.push(`/awb-tracking?awb=${encodeURIComponent(nextAwb)}`)}
            />
          ) : null}

          {!loading && notFound ? (
            <SearchBlank
              title="AWB belum ditemukan di sistem operasional."
              copy="Nomor airway bill yang Anda masukkan belum tercatat. Periksa kembali format AWB, pastikan digitnya lengkap, lalu hubungi supervisor operasional bila kiriman seharusnya sudah masuk ke gudang udara."
              recentSearches={recentSearches}
              onPickRecent={(nextAwb) => router.push(`/awb-tracking?awb=${encodeURIComponent(nextAwb)}`)}
            />
          ) : null}

          {!loading && shipment ? (
            <OpsPanel className="page-pane flex min-h-0 flex-col overflow-hidden p-0">
              <div className="border-b border-[color:var(--border-soft)] p-6 lg:p-7">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="ops-eyebrow">Hasil Tracking</p>
                    <div className="mt-3 flex flex-wrap items-end gap-3">
                      <h2 className="font-[family:var(--font-heading)] text-[2.4rem] font-black tracking-[-0.06em] text-[color:var(--brand-primary)]">
                        {shipment.awb}
                      </h2>
                      <StatusBadge value={shipment.status} label={shipment.statusLabel} />
                    </div>
                    <p className="mt-3 text-sm leading-7 text-[color:var(--muted-fg)]">
                      {shipment.shipper} <ArrowRight className="mx-1 inline size-4" /> {shipment.consignee}
                    </p>
                  </div>

                  <div className="rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-4 py-4">
                    <p className="label">Update Terakhir</p>
                    <p className="font-semibold text-[color:var(--text-strong)]">{formatDateTime(activeLog?.createdAt || shipment.updatedAt)}</p>
                    <p className="mt-1 text-xs text-[color:var(--muted-fg)]">
                      {activeLog ? `${activeLog.location} • ${activeLog.actorName || "Sistem"}` : "Belum ada actor log"}
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.9fr)]">
                  <div className="rounded-[26px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-5 py-5">
                    <p className="label">Rute Perjalanan</p>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <span className="inline-flex items-center gap-2 rounded-full bg-white/75 px-4 py-2 text-sm font-semibold text-[color:var(--text-strong)] shadow-sm dark:bg-white/[0.04]">
                        <MapPinned size={16} className="text-[color:var(--brand-primary)]" />
                        {shipment.origin}
                      </span>
                      <span className="text-[color:var(--muted-fg)]" aria-hidden="true">
                        &rarr;
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-full bg-white/75 px-4 py-2 text-sm font-semibold text-[color:var(--text-strong)] shadow-sm dark:bg-white/[0.04]">
                        <MapPinned size={16} className="text-[color:var(--brand-primary)]" />
                        {shipment.destination}
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-soft)] px-4 py-2 text-sm text-[color:var(--muted-fg)]">
                        <PlaneTakeoff size={16} />
                        {shipment.flightNumber || "Belum ada flight"}
                      </span>
                    </div>
                    <div className="mt-5 h-2 rounded-full bg-white/80 dark:bg-white/[0.05]">
                      <div
                        className="h-full rounded-full bg-[linear-gradient(90deg,var(--brand-primary),var(--brand-primary-2))] transition-[width]"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
                      <span className="font-semibold text-[color:var(--text-strong)]">
                        {completedSteps} dari {requiredSteps.length} milestone sudah tercatat
                      </span>
                      <span className="text-[color:var(--muted-fg)]">
                        Status aktif: {shipment.statusLabel}
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <DataCard
                      label="Flight"
                      value={shipment.flightNumber || "-"}
                      note="Assignment aktif"
                      icon={PlaneTakeoff}
                      tone="info"
                    />
                    <DataCard
                      label="Pieces & Berat"
                      value={`${shipment.pieces} pcs`}
                      note={formatWeight(shipment.weightKg)}
                      icon={Weight}
                    />
                    <DataCard
                      label="Dokumen"
                      value={shipment.docStatus}
                      note={`Readiness ${shipment.readiness}`}
                      icon={FileCheck2}
                      tone={shipment.docStatus.toLowerCase() === "complete" ? "success" : "warning"}
                    />
                    <DataCard
                      label="Customer / Consignee"
                      value={shipment.customerAccountName || shipment.consignee}
                      note={shipment.customerAccountName ? shipment.consignee : "Consignee aktif"}
                      icon={UserRound}
                    />
                  </div>
                </div>

                {hasException ? (
                  <div className="mt-5 rounded-[22px] border border-[color:var(--tone-warning-border)] bg-[color:var(--tone-warning-soft)] px-4 py-4 text-sm leading-7 text-[color:var(--tone-warning)]">
                    <div className="flex items-start gap-3">
                      <TriangleAlert size={18} className="mt-1 shrink-0" />
                      <div>
                        <p className="font-semibold text-[color:var(--text-strong)]">Perlu perhatian operator</p>
                        <p className="mt-1">
                          Shipment ini memiliki exception atau kesiapan yang belum bersih. Periksa status dokumen, readiness, dan event log terakhir sebelum meneruskan proses.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="mt-6 grid gap-3 md:grid-cols-5">
                  {stepTimeline.map((step, index) => (
                    <div
                      key={step.key}
                      className={cn(
                        "rounded-[22px] border px-4 py-4 transition-colors",
                        step.log
                          ? "border-[color:var(--tone-success-border)] bg-[linear-gradient(180deg,var(--tone-success-soft),rgba(255,255,255,0.96))]"
                          : "border-[color:var(--border-soft)] bg-[color:var(--panel-muted)]",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-2)]">
                            Step {index + 1}
                          </p>
                          <p className="mt-2 font-semibold text-[color:var(--text-strong)]">{step.label}</p>
                        </div>
                        <span
                          className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-full border",
                            step.log
                              ? "border-[color:var(--tone-success-border)] bg-white/80 text-[color:var(--tone-success)] dark:bg-white/[0.05]"
                              : "border-[color:var(--border-soft)] bg-white/60 text-[color:var(--muted-fg)] dark:bg-white/[0.03]",
                          )}
                        >
                          {step.log ? step.label.charAt(0) : <CircleDashed size={16} />}
                        </span>
                      </div>
                      <p className="mt-3 text-xs leading-5 text-[color:var(--muted-fg)]">
                        {step.log ? formatDateTime(step.log.createdAt) : "Menunggu update berikutnya"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid min-h-0 flex-1 gap-0 xl:grid-cols-[minmax(0,1.18fr)_360px]">
                <div className="min-h-0 border-b border-[color:var(--border-soft)] p-6 lg:p-7 xl:border-b-0 xl:border-r">
                  <SectionHeader
                    title="Event Log"
                    subtitle="Aktivitas disusun kronologis agar operator dapat menelusuri perubahan terakhir tanpa berpindah halaman."
                  />
                  <div className="page-scroll mt-5 space-y-3">
                    {shipment.trackingLogs.map((log, index) => (
                      <div key={log.id} className="rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-4 py-4">
                        <div className="flex items-start gap-4">
                          <div className="flex min-h-[42px] flex-col items-center">
                            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--brand-primary-soft)] text-xs font-black text-[color:var(--brand-primary)]">
                              {index + 1}
                            </span>
                            {index < shipment.trackingLogs.length - 1 ? (
                              <div className="mt-2 h-full w-px bg-[color:var(--border-soft)]" />
                            ) : null}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="font-[family:var(--font-heading)] text-[1.2rem] font-extrabold tracking-[-0.03em] text-[color:var(--text-strong)]">
                                  {log.label}
                                </p>
                                <p className="mt-2 text-sm leading-7 text-[color:var(--muted-fg)]">{log.message}</p>
                              </div>
                              <StatusBadge value={log.status} label={log.label} />
                            </div>
                            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-[color:var(--muted-2)]">
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
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="page-scroll p-6 lg:p-7">
                  <SectionHeader
                    title="Ringkasan Cepat"
                    subtitle="Intelligence card untuk memastikan status, dokumen, dan readiness dapat diverifikasi dalam sekali scan."
                  />
                  <div className="mt-5 space-y-3">
                    {intelligenceItems.map((item) => (
                      <DataCard
                        key={item.label}
                        label={item.label}
                        value={item.value}
                        note={item.note}
                        tone={item.tone}
                      />
                    ))}
                    <DataCard
                      label="Shipper"
                      value={shipment.shipper}
                      note="Pihak pengirim aktif"
                      icon={Package2}
                    />
                    <DataCard
                      label="Consignee"
                      value={shipment.consignee}
                      note="Penerima tujuan"
                      icon={UserRound}
                    />
                    <DataCard
                      label="Chronology"
                      value={`${shipment.trackingLogs.length} event`}
                      note={activeLog ? `${formatRelativeShort(activeLog.createdAt)} • ${activeLog.label}` : "Belum ada log"}
                      icon={History}
                    />
                  </div>
                </div>
              </div>
            </OpsPanel>
          ) : null}
        </div>

        <div className="page-stack">
          <OpsPanel className="p-5">
            <SectionHeader title="Pencarian Terakhir" subtitle="Nomor AWB, status, dan waktu relatif ditata agar bisa dipanggil ulang secepat mungkin." />
            <div className="page-scroll mt-5 space-y-3">
              {recentSearches.length ? (
                recentSearches.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="w-full rounded-[22px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-4 py-4 text-left transition-colors hover:bg-[color:var(--brand-primary-soft)]"
                    onClick={() => router.push(`/awb-tracking?awb=${encodeURIComponent(item.awb)}`)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-sm font-semibold text-[color:var(--brand-primary)]">{item.awb}</p>
                        <p className="mt-1 text-xs text-[color:var(--muted-fg)]">
                          {item.origin && item.destination ? `${item.origin} -> ${item.destination}` : "Riwayat lookup"}
                        </p>
                      </div>
                      <span className="text-xs text-[color:var(--muted-fg)]">{formatRelativeShort(item.createdAt)}</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      {item.status && item.statusLabel ? (
                        <StatusBadge value={item.status} label={item.statusLabel} />
                      ) : (
                        <StatusBadge value="pending" label="Menunggu data" />
                      )}
                      <span className="text-xs text-[color:var(--muted-fg)]">{item.flightNumber || "Belum ada flight"}</span>
                    </div>
                  </button>
                ))
              ) : (
                <p className="text-sm text-[color:var(--muted-fg)]">Belum ada pencarian terbaru.</p>
              )}
            </div>
          </OpsPanel>

          <OpsPanel className="p-5">
            <SectionHeader title="Ringkasan Cepat" subtitle="Summary intelligence untuk lookup aktif atau guidance saat belum ada hasil." />
            <div className="page-scroll mt-5 space-y-3">
              {intelligenceItems.map((item) => (
                <DataCard key={item.label} label={item.label} value={item.value} note={item.note} tone={item.tone} />
              ))}
              {!shipment ? (
                <EmptyState
                  icon={Radar}
                  title="Tracking center siap dipakai"
                  copy="Masukkan AWB pada search module untuk memunculkan progress perjalanan, alert, dan log kronologis secara penuh."
                  className="px-5 py-8"
                />
              ) : null}
            </div>
          </OpsPanel>
        </div>
      </div>
    </div>
  );
}
