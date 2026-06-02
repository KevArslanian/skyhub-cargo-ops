"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { EmptyState, OpsPanel, PageHeader, SectionHeader } from "@/components/ops-ui";
import { StatusBadge } from "@/components/status-badge";
import { formatDateTime } from "@/lib/format";

type ComplaintPayload = {
  summary: {
    total: number;
    new: number;
    inReview: number;
    resolved: number;
    closed: number;
  };
  complaints: {
    id: string;
    ticketCode: string;
    reporterName: string;
    contact: string;
    topic: string;
    topicLabel: string;
    referenceNo: string | null;
    message: string;
    status: "new" | "in_review" | "resolved" | "closed";
    statusLabel: string;
    handledByName: string | null;
    handledAt: string | null;
    resolutionNote: string | null;
    createdAt: string;
    updatedAt: string;
  }[];
};

const PAGE_SIZE = 20;

const statusOptions = [
  { value: "all", label: "Semua status" },
  { value: "new", label: "Baru" },
  { value: "in_review", label: "Ditinjau" },
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

const statusTone: Record<ComplaintPayload["complaints"][number]["status"], string> = {
  new: "warning",
  in_review: "info",
  resolved: "success",
  closed: "pending",
};

export default function ComplaintsPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [topic, setTopic] = useState("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ComplaintPayload | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadComplaints = useCallback(async () => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("query", query.trim());
    if (status !== "all") params.set("status", status);
    if (topic !== "all") params.set("topic", topic);

    const response = await fetch(`/api/complaints?${params.toString()}`, { cache: "no-store" });
    if (!response.ok) return;
    const payload = (await response.json()) as ComplaintPayload;
    setData(payload);
  }, [query, status, topic]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadComplaints();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadComplaints]);

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

  const totalPages = Math.max(1, Math.ceil((data?.complaints.length ?? 0) / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pagedComplaints = (data?.complaints ?? []).slice(pageStart, pageStart + PAGE_SIZE);

  const summaryCards = useMemo(
    () => [
      { label: "Total", value: data?.summary.total ?? 0 },
      { label: "Baru", value: data?.summary.new ?? 0 },
      { label: "Ditinjau", value: data?.summary.inReview ?? 0 },
      { label: "Selesai", value: data?.summary.resolved ?? 0 },
    ],
    [data?.summary],
  );

  async function updateStatus(complaintId: string, nextStatus: ComplaintPayload["complaints"][number]["status"]) {
    setUpdatingId(complaintId);
    try {
      const response = await fetch(`/api/complaints/${complaintId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!response.ok) return;
      await loadComplaints();
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="page-workspace complaints-workspace">
      <PageHeader
        title="Kotak Keluhan"
        subtitle="Laporan publik dari halaman About Us masuk ke sini untuk ditinjau tim operasional."
      />

      <div className="grid gap-4 md:grid-cols-4">
        {summaryCards.map((card) => (
          <OpsPanel key={card.label} className="p-5">
            <div className="text-sm text-[color:var(--muted-fg)]">{card.label}</div>
            <div className="mt-2 text-3xl font-semibold">{card.value}</div>
          </OpsPanel>
        ))}
      </div>

      <OpsPanel className="page-pane p-5">
        <SectionHeader title="Filter Keluhan" subtitle="Cari dan saring laporan publik dari About Us." />
        <div className="ops-filter-strip mt-5">
          <div className="ops-filter-search">
            <label className="label" htmlFor="complaint-query">Cari Keluhan</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[color:var(--muted-fg)]" />
              <input
                id="complaint-query"
                className="input-field input-field-leading"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Cari tiket, nama, kontak, AWB, atau isi keluhan"
              />
            </div>
          </div>
          <div className="shell-inline-filters">
            <div className="shell-filter-field">
              <label className="label" htmlFor="complaint-status">Status</label>
              <select
                id="complaint-status"
                className="select-field"
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(1);
                }}
              >
                {statusOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="shell-filter-field">
              <label className="label" htmlFor="complaint-topic">Topik</label>
              <select
                id="complaint-topic"
                className="select-field"
                value={topic}
                onChange={(event) => {
                  setTopic(event.target.value);
                  setPage(1);
                }}
              >
                {topicOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </OpsPanel>

      <OpsPanel className="page-pane complaints-panel p-5">
        <SectionHeader title="Antrian Keluhan" subtitle="Setiap tiket masuk ke tim operasional untuk ditinjau." />
        <div className="page-scroll complaints-scroll mt-5 table-shell">
          {!pagedComplaints.length ? (
            <EmptyState
              icon={Search}
              title="Belum ada keluhan"
              copy="Laporan dari halaman About Us akan muncul di sini setelah pengguna mengirim form."
            />
          ) : (
            <div className="space-y-4">
              {pagedComplaints.map((item) => (
                <article key={item.id} className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel)] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted-fg)]">{item.ticketCode}</div>
                      <h3 className="mt-2 text-xl font-semibold">{item.reporterName}</h3>
                      <p className="mt-1 text-sm text-[color:var(--muted-fg)]">{item.contact}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge value={statusTone[item.status]} label={item.statusLabel} />
                      <StatusBadge value="info" label={item.topicLabel} />
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
                    <div>
                      <div className="text-[color:var(--muted-fg)]">Referensi</div>
                      <div>{item.referenceNo || "-"}</div>
                    </div>
                    <div>
                      <div className="text-[color:var(--muted-fg)]">Masuk</div>
                      <div>{formatDateTime(item.createdAt)}</div>
                    </div>
                    <div>
                      <div className="text-[color:var(--muted-fg)]">Penangan</div>
                      <div>{item.handledByName || "Belum ditugaskan"}</div>
                    </div>
                  </div>

                  <p className="mt-4 text-sm leading-7 text-[color:var(--foreground)]">{item.message}</p>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {item.status === "new" ? (
                      <button
                        type="button"
                        className="button-primary"
                        disabled={updatingId === item.id}
                        onClick={() => void updateStatus(item.id, "in_review")}
                      >
                        Tinjau
                      </button>
                    ) : null}
                    {item.status === "in_review" ? (
                      <button
                        type="button"
                        className="button-primary"
                        disabled={updatingId === item.id}
                        onClick={() => void updateStatus(item.id, "resolved")}
                      >
                        Tandai Selesai
                      </button>
                    ) : null}
                    {item.status !== "closed" ? (
                      <button
                        type="button"
                        className="button-secondary"
                        disabled={updatingId === item.id}
                        onClick={() => void updateStatus(item.id, "closed")}
                      >
                        Tutup
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        {pagedComplaints.length ? (
          <div className="mt-5 flex items-center justify-between gap-3">
            <p className="text-sm text-[color:var(--muted-fg)]">
              Menampilkan {pageStart + 1}-{pageStart + pagedComplaints.length} dari {data?.complaints.length ?? 0} keluhan
            </p>
            <div className="flex items-center gap-2">
              <button type="button" className="icon-button" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                <ChevronLeft className="size-4" />
              </button>
              <span className="text-sm">{currentPage} / {totalPages}</span>
              <button type="button" className="icon-button" disabled={currentPage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        ) : null}
      </OpsPanel>
    </div>
  );
}
