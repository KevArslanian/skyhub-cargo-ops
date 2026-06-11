"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Search } from "lucide-react";
import { GlassSelect } from "@/components/glass-select";
import { LiquidGlassOverlay } from "@/components/liquid-glass-overlay";
import { OpsDrawer } from "@/components/ops-drawer";
import { CrudPageScaffold, EmptyState, FilterBar, FilterFields, FilterSearch, OpsPanel, PaginationBar, SectionHeader } from "@/components/ops-ui";
import { OPS_LIST_PAGE_SIZE } from "@/lib/constants";
import { useOpsAlert } from "@/components/ops-alert-provider";
import { StatusBadge } from "@/components/status-badge";
import { cn, formatDateTime } from "@/lib/format";
import { networkErrorMessage, readApiError } from "@/lib/ops-feedback";
import { getComplaintResolutionPlaceholder } from "@/lib/ops-resolution";

type ComplaintStatus = "new" | "in_review" | "escalated" | "resolved" | "closed";

type ComplaintItem = {
  id: string;
  ticketCode: string;
  reporterName: string;
  contact: string;
  topic: string;
  topicLabel: string;
  referenceNo: string | null;
  referenceHref: string | null;
  escalationDesk: string;
  escalationReason: string | null;
  escalatedByName: string | null;
  escalatedAt: string | null;
  message: string;
  status: ComplaintStatus;
  statusLabel: string;
  handledByName: string | null;
  handledAt: string | null;
  resolutionNote: string | null;
  createdAt: string;
  updatedAt: string;
};

type ComplaintPayload = {
  summary: {
    total: number;
    new: number;
    inReview: number;
    escalated: number;
    resolved: number;
    closed: number;
  };
  complaints: ComplaintItem[];
};

const statusOptions = [
  { value: "all", label: "Semua status" },
  { value: "new", label: "Baru" },
  { value: "in_review", label: "Ditinjau" },
  { value: "escalated", label: "Eskalasi" },
  { value: "resolved", label: "Selesai" },
  { value: "closed", label: "Ditutup" },
];

const topicOptions = [
  { value: "all", label: "Semua topik" },
  { value: "shipment", label: "Pengiriman / AWB" },
  { value: "flight", label: "Penerbangan" },
  { value: "document", label: "Dokumen" },
  { value: "service", label: "Layanan" },
  { value: "other", label: "Lainnya" },
];

const statusTone: Record<ComplaintStatus, string> = {
  new: "warning",
  in_review: "info",
  escalated: "error",
  resolved: "success",
  closed: "pending",
};

export default function ComplaintsPage() {
  const { showAlert } = useOpsAlert();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [topic, setTopic] = useState("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ComplaintPayload | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [resolveTarget, setResolveTarget] = useState<ComplaintItem | null>(null);
  const [escalateTarget, setEscalateTarget] = useState<ComplaintItem | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [escalationReason, setEscalationReason] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<ComplaintItem | null>(null);

  const loadComplaints = useCallback(async () => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("query", query.trim());
    if (status !== "all") params.set("status", status);
    if (topic !== "all") params.set("topic", topic);

    try {
      const response = await fetch(`/api/complaints?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) {
        showAlert({
          title: "Gagal Memuat",
          description: await readApiError(response, "Daftar keluhan belum bisa dimuat."),
          tone: "error",
        });
        return;
      }
      const payload = (await response.json()) as ComplaintPayload;
      setData(payload);
    } catch {
      showAlert({
        title: "Koneksi Terputus",
        description: networkErrorMessage("memuat daftar keluhan"),
        tone: "warning",
      });
    }
  }, [query, showAlert, status, topic]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadComplaints();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadComplaints]);

  useEffect(() => {
    if (!selectedTicket || !data) return;
    const fresh = data.complaints.find((item) => item.id === selectedTicket.id);
    if (fresh) setSelectedTicket(fresh);
  }, [data, selectedTicket?.id]);

  useEffect(() => {
    function handleContextSearch(event: Event) {
      const detail = (event as CustomEvent<{ pathname?: string; query?: string }>).detail;
      if (detail?.pathname !== "/complaints" || !detail.query) return;
      setQuery(detail.query);
      setPage(1);
    }

    window.addEventListener("skyhub:context-search", handleContextSearch as EventListener);
    return () => window.removeEventListener("skyhub:context-search", handleContextSearch as EventListener);
  }, []);

  const totalPages = Math.max(1, Math.ceil((data?.complaints.length ?? 0) / OPS_LIST_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * OPS_LIST_PAGE_SIZE;
  const pagedComplaints = (data?.complaints ?? []).slice(pageStart, pageStart + OPS_LIST_PAGE_SIZE);

  const summaryChips = useMemo(
    () => [
      {
        label: "total",
        value: data?.summary.total ?? 0,
        className: "border-[color:var(--border-soft)] bg-[color:var(--panel-bg)] text-[color:var(--text-strong)]",
      },
      {
        label: "baru",
        value: data?.summary.new ?? 0,
        className: "border-[color:var(--tone-warning-border)] bg-[color:var(--tone-warning-soft)] text-[color:var(--tone-warning)]",
      },
      {
        label: "ditinjau",
        value: data?.summary.inReview ?? 0,
        className: "border-[color:var(--tone-info-border)] bg-[color:var(--tone-info-soft)] text-[color:var(--tone-info)]",
      },
      {
        label: "eskalasi",
        value: data?.summary.escalated ?? 0,
        className: "border-[color:var(--tone-danger-border)] bg-[color:var(--tone-danger-soft)] text-[color:var(--tone-danger)]",
      },
    ],
    [data?.summary],
  );

  function openTicketDetail(item: ComplaintItem) {
    setSelectedTicket(item);
  }

  async function updateStatus(
    complaintId: string,
    nextStatus: ComplaintStatus,
    extra?: { resolutionNote?: string; escalationReason?: string },
  ) {
    setUpdatingId(complaintId);
    try {
      const response = await fetch(`/api/complaints/${complaintId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus,
          resolutionNote: extra?.resolutionNote?.trim() || undefined,
          escalationReason: extra?.escalationReason?.trim() || undefined,
        }),
      });
      if (!response.ok) {
        showAlert({
          title: "Gagal Memperbarui",
          description: await readApiError(response, "Status keluhan belum bisa diperbarui."),
          tone: "error",
        });
        return;
      }
      await loadComplaints();
      showAlert({
        title: "Berhasil",
        description: "Status keluhan berhasil diperbarui.",
        tone: "success",
      });
    } catch {
      showAlert({
        title: "Koneksi Terputus",
        description: networkErrorMessage("memperbarui status keluhan"),
        tone: "warning",
      });
    } finally {
      setUpdatingId(null);
      if (nextStatus === "resolved") {
        setResolveTarget(null);
        setResolutionNote("");
      }
      if (nextStatus === "escalated") {
        setEscalateTarget(null);
        setEscalationReason("");
      }
    }
  }

  function openResolveDialog(item: ComplaintItem) {
    setResolveTarget(item);
    setResolutionNote(item.resolutionNote ?? "");
  }

  function openEscalateDialog(item: ComplaintItem) {
    setEscalateTarget(item);
    setEscalationReason("");
  }

  return (
    <>
    <CrudPageScaffold
      className="complaints-workspace gap-6"
      title="Kotak Keluhan"
      subtitle="Tiket layanan pelanggan dari Tentang Kami. Selesai = respon ke pelanggan tercatat. Berbeda dari Pusat Peringatan yang menangani anomali sistem."
      headerExtra={
        data ? (
          <div className="flex flex-wrap gap-2" aria-label="Ringkasan kotak keluhan">
            {summaryChips.map((chip) => (
              <span
                key={chip.label}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-semibold",
                  chip.className,
                )}
              >
                {chip.value} {chip.label}
              </span>
            ))}
          </div>
        ) : null
      }
      filters={
      <FilterBar ariaLabel="Pencarian dan filter kotak keluhan">
        <FilterSearch>
          <label className="label" htmlFor="complaint-query">
            Cari Keluhan
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 z-10 size-4 -translate-y-1/2 text-[color:var(--muted-fg)]" aria-hidden="true" />
            <input
              id="complaint-query"
              className="input-field input-field-leading w-full"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Tiket, nama, kontak, atau AWB"
            />
          </div>
        </FilterSearch>
        <FilterFields aria-label="Filter status dan topik keluhan">
          <div className="shell-filter-field">
            <label className="label" htmlFor="complaint-status">
              Status
            </label>
            <GlassSelect
              id="complaint-status"
              aria-label="Filter status keluhan"
              value={status}
              onChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
              options={statusOptions}
            />
          </div>
          <div className="shell-filter-field">
            <label className="label" htmlFor="complaint-topic">
              Topik
            </label>
            <GlassSelect
              id="complaint-topic"
              aria-label="Filter topik keluhan"
              value={topic}
              onChange={(value) => {
                setTopic(value);
                setPage(1);
              }}
              options={topicOptions}
            />
          </div>
          <span className="shell-filter-count" aria-label={data ? `${data.complaints.length} keluhan tampil` : "Keluhan sedang dimuat"}>
            {data ? `${data.complaints.length} keluhan` : "…"}
          </span>
        </FilterFields>
      </FilterBar>
      }
      body={
      <OpsPanel className="page-pane complaints-panel flex min-h-0 flex-1 flex-col overflow-hidden p-5">
        <SectionHeader title="Antrian Keluhan" subtitle="Klik baris tiket untuk detail dan ubah status." />
        <div className="page-scroll complaints-scroll mt-5 table-shell">
          {!pagedComplaints.length ? (
            <EmptyState
              icon={Search}
              title="Belum ada keluhan"
              copy="Laporan dari halaman Tentang Kami akan muncul di sini setelah pengguna mengirim form."
            />
          ) : (
            <div className="space-y-3">
              {pagedComplaints.map((item) => {
                const selected = selectedTicket?.id === item.id;

                return (
                  <article
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    className={cn(
                      "cursor-pointer rounded-2xl border bg-[color:var(--panel-bg)] transition-colors hover:border-[color:var(--tone-info-border)]",
                      selected ? "border-[color:var(--tone-info-border)] shadow-[var(--shadow-soft)]" : "border-[color:var(--border-soft)]",
                    )}
                    onClick={() => openTicketDetail(item)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openTicketDetail(item);
                      }
                    }}
                  >
                    <div className="flex items-start justify-between gap-4 p-5">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted-fg)]">{item.ticketCode}</div>
                        <h3 className="mt-2 text-xl font-semibold">{item.reporterName}</h3>
                        <p className="mt-1 text-sm text-[color:var(--muted-fg)]">
                          {item.topicLabel}
                          {item.referenceNo ? ` · ${item.referenceNo}` : ""}
                        </p>
                        <p className="mt-3 line-clamp-2 text-sm leading-6 text-[color:var(--foreground)]">{item.message}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <StatusBadge value={statusTone[item.status]} label={item.statusLabel} />
                          {item.status === "new" ? (
                            <button
                              type="button"
                              className="btn btn-primary h-8 px-3 text-xs"
                              disabled={updatingId === item.id}
                              onClick={(event) => {
                                event.stopPropagation();
                                void updateStatus(item.id, "in_review");
                              }}
                            >
                              Tinjau
                            </button>
                          ) : null}
                        </div>
                        <span className="text-xs text-[color:var(--muted-fg)]">{formatDateTime(item.createdAt)}</span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        {pagedComplaints.length ? (
          <div className="mt-5">
            <PaginationBar
              page={currentPage}
              totalPages={totalPages}
              visibleStart={pageStart + 1}
              visibleEnd={pageStart + pagedComplaints.length}
              totalItems={data?.complaints.length ?? 0}
              onPageChange={(nextPage) => setPage(nextPage)}
              label="Keluhan"
            />
          </div>
        ) : null}
      </OpsPanel>
      }
    />

      <OpsDrawer
        open={Boolean(selectedTicket)}
        eyebrow={selectedTicket?.ticketCode ?? "Tiket Keluhan"}
        title={selectedTicket?.reporterName ?? "Detail Keluhan"}
        description={
          selectedTicket
            ? `${selectedTicket.topicLabel}${selectedTicket.referenceNo ? ` · ${selectedTicket.referenceNo}` : ""}`
            : undefined
        }
        onClose={() => setSelectedTicket(null)}
        className="complaints-detail-modal"
        footer={
          selectedTicket ? (
            <div className="flex w-full flex-wrap gap-2">
              {selectedTicket.referenceHref ? (
                <Link
                  href={selectedTicket.referenceHref}
                  className="btn btn-secondary h-9 px-4 text-xs"
                  onClick={(event) => event.stopPropagation()}
                >
                  <ArrowUpRight size={14} />
                  Buka referensi
                </Link>
              ) : null}
              {selectedTicket.status === "new" ? (
                <button
                  type="button"
                  className="btn btn-primary h-9 px-4 text-xs"
                  disabled={updatingId === selectedTicket.id}
                  onClick={() => void updateStatus(selectedTicket.id, "in_review")}
                >
                  Tinjau
                </button>
              ) : null}
              {selectedTicket.status === "in_review" ? (
                <>
                  <button
                    type="button"
                    className="btn btn-primary h-9 px-4 text-xs"
                    disabled={updatingId === selectedTicket.id}
                    onClick={() => openResolveDialog(selectedTicket)}
                  >
                    Tandai Selesai
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary h-9 px-4 text-xs"
                    disabled={updatingId === selectedTicket.id}
                    onClick={() => openEscalateDialog(selectedTicket)}
                  >
                    Eskalasi
                  </button>
                </>
              ) : null}
              {selectedTicket.status === "escalated" ? (
                <button
                  type="button"
                  className="btn btn-primary h-9 px-4 text-xs"
                  disabled={updatingId === selectedTicket.id}
                  onClick={() => openResolveDialog(selectedTicket)}
                >
                  Selesaikan Eskalasi
                </button>
              ) : null}
              {selectedTicket.status === "new" || selectedTicket.status === "in_review" ? (
                <button
                  type="button"
                  className="btn btn-secondary h-9 px-4 text-xs"
                  disabled={updatingId === selectedTicket.id}
                  onClick={() => void updateStatus(selectedTicket.id, "closed")}
                >
                  Tutup tiket
                </button>
              ) : null}
            </div>
          ) : null
        }
      >
        {selectedTicket ? (
          <div className="page-scroll internal-scrollbar complaints-detail-scroll mt-5 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge value={statusTone[selectedTicket.status]} label={selectedTicket.statusLabel} />
              <span className="text-xs text-[color:var(--muted-fg)]">{formatDateTime(selectedTicket.createdAt)}</span>
            </div>

            <div className="ops-panel-muted space-y-3 p-4">
              <div>
                <p className="label">Kontak pelapor</p>
                <p className="mt-1 text-sm text-[color:var(--text-strong)]">{selectedTicket.contact}</p>
              </div>
              <div>
                <p className="label">Pesan keluhan</p>
                <p className="mt-1 text-sm leading-7 text-[color:var(--muted-fg)]">{selectedTicket.message}</p>
              </div>
            </div>

            <div className="grid gap-3 text-sm md:grid-cols-2">
              <div className="ops-panel-muted p-4">
                <p className="label">Referensi</p>
                <p className="mt-1 font-semibold text-[color:var(--text-strong)]">{selectedTicket.referenceNo || "-"}</p>
              </div>
              <div className="ops-panel-muted p-4">
                <p className="label">Desk eskalasi</p>
                <p className="mt-1 font-semibold text-[color:var(--text-strong)]">{selectedTicket.escalationDesk}</p>
              </div>
              <div className="ops-panel-muted p-4">
                <p className="label">Penangan</p>
                <p className="mt-1 font-semibold text-[color:var(--text-strong)]">{selectedTicket.handledByName || "Belum ditugaskan"}</p>
              </div>
              <div className="ops-panel-muted p-4">
                <p className="label">Diperbarui</p>
                <p className="mt-1 font-semibold text-[color:var(--text-strong)]">{formatDateTime(selectedTicket.updatedAt)}</p>
              </div>
            </div>

            {selectedTicket.status === "escalated" && selectedTicket.escalationReason ? (
              <p className="rounded-xl border border-[color:var(--tone-warning-border)] bg-[color:var(--tone-warning-soft)] px-4 py-3 text-sm leading-6">
                <span className="font-medium text-[color:var(--foreground)]">Alasan eskalasi: </span>
                <span className="text-[color:var(--muted-fg)]">{selectedTicket.escalationReason}</span>
                {selectedTicket.escalatedByName ? (
                  <span className="mt-1 block text-xs text-[color:var(--muted-2)]">
                    Oleh {selectedTicket.escalatedByName}
                    {selectedTicket.escalatedAt ? ` · ${formatDateTime(selectedTicket.escalatedAt)}` : ""}
                  </span>
                ) : null}
              </p>
            ) : null}

            {selectedTicket.resolutionNote ? (
              <p className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--panel-bg)] px-4 py-3 text-sm leading-6">
                <span className="font-medium text-[color:var(--foreground)]">Catatan penyelesaian: </span>
                <span className="text-[color:var(--muted-fg)]">{selectedTicket.resolutionNote}</span>
              </p>
            ) : null}
          </div>
        ) : null}
      </OpsDrawer>

      <LiquidGlassOverlay
        open={Boolean(resolveTarget)}
        onClose={() => {
          setResolveTarget(null);
          setResolutionNote("");
        }}
        variant="sheet"
        ariaLabelledby="resolve-complaint-title"
        zIndex={80}
      >
        {resolveTarget ? (
          <>
            <h2
              id="resolve-complaint-title"
              className="font-[family:var(--font-heading)] text-xl font-extrabold tracking-[-0.03em] text-[color:var(--text-strong)]"
            >
              {resolveTarget.status === "escalated" ? "Selesaikan Eskalasi" : "Selesaikan Keluhan"}
            </h2>
            <p className="mt-2 text-sm text-[color:var(--muted-fg)]">
              Tiket {resolveTarget.ticketCode} membutuhkan catatan respon pelanggan sebelum ditutup.
            </p>
            <label className="label mt-4" htmlFor="resolution-note">
              Catatan Respon Pelanggan
            </label>
            <textarea
              id="resolution-note"
              className="textarea-field mt-2 min-h-[120px]"
              value={resolutionNote}
              onChange={(event) => setResolutionNote(event.target.value)}
              placeholder={getComplaintResolutionPlaceholder(resolveTarget.topic)}
            />
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="btn btn-secondary h-10 px-4"
                disabled={updatingId === resolveTarget.id}
                onClick={() => {
                  setResolveTarget(null);
                  setResolutionNote("");
                }}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-primary h-10 px-4"
                disabled={updatingId === resolveTarget.id || resolutionNote.trim().length < 8}
                onClick={() => void updateStatus(resolveTarget.id, "resolved", { resolutionNote })}
              >
                Simpan & Selesaikan
              </button>
            </div>
          </>
        ) : null}
      </LiquidGlassOverlay>

      <LiquidGlassOverlay
        open={Boolean(escalateTarget)}
        onClose={() => {
          setEscalateTarget(null);
          setEscalationReason("");
        }}
        variant="sheet"
        ariaLabelledby="escalate-complaint-title"
        zIndex={80}
      >
        {escalateTarget ? (
          <>
            <h2
              id="escalate-complaint-title"
              className="font-[family:var(--font-heading)] text-xl font-extrabold tracking-[-0.03em] text-[color:var(--text-strong)]"
            >
              Eskalasi Keluhan
            </h2>
            <p className="mt-2 text-sm text-[color:var(--muted-fg)]">
              Tiket {escalateTarget.ticketCode} akan dialihkan ke{" "}
              <strong className="text-[color:var(--text-strong)]">{escalateTarget.escalationDesk}</strong>.
            </p>
            <label className="label mt-4" htmlFor="escalation-reason">
              Alasan Eskalasi
            </label>
            <textarea
              id="escalation-reason"
              className="textarea-field mt-2 min-h-[120px]"
              value={escalationReason}
              onChange={(event) => setEscalationReason(event.target.value)}
              placeholder="Jelaskan mengapa tiket perlu naik ke desk supervisor (mis. butuh keputusan slot, kompensasi, atau otoritas lebih tinggi)."
            />
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="btn btn-secondary h-10 px-4"
                disabled={updatingId === escalateTarget.id}
                onClick={() => {
                  setEscalateTarget(null);
                  setEscalationReason("");
                }}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-primary h-10 px-4"
                disabled={updatingId === escalateTarget.id || escalationReason.trim().length < 8}
                onClick={() => void updateStatus(escalateTarget.id, "escalated", { escalationReason })}
              >
                Eskalasi Sekarang
              </button>
            </div>
          </>
        ) : null}
      </LiquidGlassOverlay>
    </>
  );
}