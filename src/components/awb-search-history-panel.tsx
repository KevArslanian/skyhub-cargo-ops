"use client";

import { useEffect, useRef } from "react";
import { History } from "lucide-react";
import { GlassDatePicker } from "@/components/glass-date-picker";
import { EmptyState, OpsPanel, PaginationBar } from "@/components/ops-ui";
import { StatusBadge } from "@/components/status-badge";
import { formatDateTime } from "@/lib/format";
import { useVisiblePanelPageSize } from "@/lib/use-visible-panel-page-size";

export type AwbRecentSearch = {
  id: string;
  awb: string;
  createdAt: string;
  status: string | null;
  statusLabel: string | null;
  origin: string | null;
  destination: string | null;
  flightNumber: string | null;
};

type AwbSearchHistoryPanelProps = {
  activeAwb: string;
  activeStatusLabel?: string | null;
  recentSearches: AwbRecentSearch[];
  historyDateFrom: string;
  historyDateTo: string;
  page: number;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onOpenAwb: (awb: string) => void;
};

/** Panel kanan: nomor AWB aktif + riwayat pencarian dalam satu kotak */
export function AwbSearchHistoryPanel({
  activeAwb,
  activeStatusLabel,
  recentSearches,
  historyDateFrom,
  historyDateTo,
  page,
  onDateFromChange,
  onDateToChange,
  onPageChange,
  onOpenAwb,
}: AwbSearchHistoryPanelProps) {
  const historyListRef = useRef<HTMLDivElement | null>(null);
  const historyPageSize = useVisiblePanelPageSize(
    historyListRef,
    recentSearches.length > 0,
    recentSearches.length,
    "[data-awb-history-item]",
    { fallback: 3, min: 1, max: 8, gapPx: 12 },
  );

  const totalPages = Math.max(1, Math.ceil(recentSearches.length / historyPageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * historyPageSize;
  const pagedSearches = recentSearches.slice(pageStart, pageStart + historyPageSize);
  const visibleStart = recentSearches.length ? pageStart + 1 : 0;
  const visibleEnd = Math.min(pageStart + pagedSearches.length, recentSearches.length);

  useEffect(() => {
    if (page > totalPages) {
      onPageChange(totalPages);
    }
  }, [historyPageSize, onPageChange, page, totalPages]);

  return (
    <OpsPanel className="page-pane awb-history-panel flex h-full min-h-0 flex-col overflow-hidden p-0">
      <header className="awb-history-panel-head shrink-0 border-b border-[color:var(--border-soft)] p-4 sm:p-5">
        <p className="label">Riwayat Pelacakan</p>
        <h2 className="mt-2 font-mono text-xl font-black tracking-tight text-[color:var(--brand-primary)] sm:text-2xl">
          {activeAwb || "—"}
        </h2>
        {activeAwb && activeStatusLabel ? (
          <p className="mt-2 text-xs font-semibold text-[color:var(--muted-fg)]">Status aktif: {activeStatusLabel}</p>
        ) : (
          <p className="mt-2 text-xs text-[color:var(--muted-fg)]">Lacak AWB atau pilih entri riwayat di bawah.</p>
        )}
      </header>

      <div className="awb-history-body flex min-h-0 flex-1 flex-col gap-4 p-4 sm:p-5">
        <div className="awb-history-date-filters grid shrink-0 gap-3">
          <div className="awb-history-date-field">
            <label className="label" htmlFor="awb-history-from">
              Tanggal Awal
            </label>
            <GlassDatePicker id="awb-history-from" aria-label="Tanggal awal" value={historyDateFrom} onChange={onDateFromChange} />
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
              onChange={onDateToChange}
            />
          </div>
        </div>

        <p className="shrink-0 text-xs font-semibold text-[color:var(--muted-fg)]" aria-live="polite">
          {recentSearches.length} riwayat pelacakan
        </p>

        <div
          ref={historyListRef}
          className="awb-history-list internal-scrollbar min-h-0 flex-1 space-y-3 overflow-x-hidden overflow-y-hidden overscroll-y-contain"
          role="list"
          aria-label="Riwayat pelacakan AWB"
        >
          {recentSearches.length ? (
            pagedSearches.map((item) => {
              const isActive = activeAwb === item.awb;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="listitem"
                  data-awb-history-item
                  aria-current={isActive ? "true" : undefined}
                  className="w-full rounded-[20px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-4 py-4 text-left transition-colors hover:bg-[color:var(--brand-primary-soft)] data-[active=true]:border-[color:var(--brand-primary)]/40 data-[active=true]:bg-[color:var(--brand-primary-soft)]"
                  data-active={isActive ? "true" : undefined}
                  onClick={() => onOpenAwb(item.awb)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-semibold text-[color:var(--brand-primary)]">{item.awb}</p>
                      <p className="mt-1 text-xs text-[color:var(--muted-fg)]">
                        {item.origin && item.destination ? `${item.origin} → ${item.destination}` : "Riwayat pelacakan"}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-[color:var(--muted-fg)]">{formatDateTime(item.createdAt)}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    {item.status && item.statusLabel ? (
                      <StatusBadge value={item.status} label={item.statusLabel} />
                    ) : (
                      <StatusBadge value="pending" label="Belum aktif" />
                    )}
                    <span className="shrink-0 text-xs text-[color:var(--muted-fg)]">{item.flightNumber || "—"}</span>
                  </div>
                </button>
              );
            })
          ) : (
            <EmptyState
              icon={History}
              variant="neutral"
              title="Belum ada riwayat"
              copy="Riwayat pencarian AWB akan muncul di sini setelah kamu melakukan pelacakan."
            />
          )}
        </div>

        {recentSearches.length > historyPageSize ? (
          <div className="awb-history-pagination shrink-0 border-t border-[color:var(--border-soft)] pt-3">
            <PaginationBar
              page={currentPage}
              totalPages={totalPages}
              visibleStart={visibleStart}
              visibleEnd={visibleEnd}
              totalItems={recentSearches.length}
              onPageChange={onPageChange}
              label="Riwayat"
            />
          </div>
        ) : null}
      </div>
    </OpsPanel>
  );
}