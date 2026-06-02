"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Filter, History, Search } from "lucide-react";
import { formatDateTime, normalizeOperationalCopy } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState, OpsPanel, PageHeader, SectionHeader } from "@/components/ops-ui";

type ActivityPayload = {
  users: { id: string; name: string }[];
  logs: {
    id: string;
    action: string;
    targetType: string;
    targetLabel: string;
    description: string;
    level: string;
    userName: string;
    userId: string | null;
    createdAt: string;
  }[];
};

const ACTIVITY_PAGE_SIZE = 25;

export default function ActivityLogPage() {
  const [action, setAction] = useState("all");
  const [userId, setUserId] = useState("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ActivityPayload | null>(null);

  const loadActivityLog = useCallback(async () => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("query", query.trim());
    if (action !== "all") params.set("action", action);
    if (userId !== "all") params.set("userId", userId);
    const response = await fetch(`/api/activity-log?${params.toString()}`, { cache: "no-store" });
    if (!response.ok) return;
    const payload = (await response.json()) as ActivityPayload;
    setData(payload);
  }, [action, query, userId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadActivityLog();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadActivityLog]);

  useEffect(() => {
    function handleContextSearch(event: Event) {
      const detail = (event as CustomEvent<{ pathname?: string; query?: string }>).detail;
      if (detail?.pathname !== "/activity-log" || !detail.query) return;
      setQuery(detail.query);
      setPage(1);
    }

    window.addEventListener("skyhub:context-search", handleContextSearch as EventListener);
    return () => window.removeEventListener("skyhub:context-search", handleContextSearch as EventListener);
  }, []);

  const actions = useMemo(() => Array.from(new Set((data?.logs ?? []).map((log) => log.action))), [data?.logs]);
  const totalPages = Math.max(1, Math.ceil((data?.logs.length ?? 0) / ACTIVITY_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * ACTIVITY_PAGE_SIZE;
  const pagedLogs = (data?.logs ?? []).slice(pageStart, pageStart + ACTIVITY_PAGE_SIZE);
  const visibleStart = data?.logs.length ? pageStart + 1 : 0;
  const visibleEnd = Math.min(pageStart + pagedLogs.length, data?.logs.length ?? 0);
  const activeFilterCount = [action !== "all", userId !== "all", Boolean(query.trim())].filter(Boolean).length;

  const filterControls = useMemo(
    () => (
      <section className="ops-filter-strip" aria-label="Pencarian dan filter Catatan Aktivitas">
        <div className="ops-filter-search">
          <label className="label" htmlFor="activity-query">Cari Log</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[color:var(--muted-fg)]" />
            <input
              id="activity-query"
              className="input-field input-field-leading"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Cari aksi, target, pengguna, atau deskripsi"
            />
          </div>
        </div>
      <div className="shell-inline-filters" aria-label="Filter Catatan Aktivitas">
        <div className="shell-filter-field">
          <label className="label" htmlFor="activity-action">Aksi</label>
          <select
            id="activity-action"
            className="select-field"
            value={action}
            onChange={(event) => {
              setAction(event.target.value);
              setPage(1);
            }}
          >
            <option value="all">Semua aksi</option>
            {actions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
        <div className="shell-filter-field">
          <label className="label" htmlFor="activity-user">Pengguna</label>
          <select
            id="activity-user"
            className="select-field"
            value={userId}
            onChange={(event) => {
              setUserId(event.target.value);
              setPage(1);
            }}
          >
            <option value="all">Semua pengguna</option>
            {(data?.users ?? []).map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </div>
        {activeFilterCount > 0 ? (
          <span className="shell-filter-count" aria-label={`${activeFilterCount} filter aktif`}>
            <Filter size={14} />
            {activeFilterCount}
          </span>
        ) : null}
      </div>
      </section>
    ),
    [action, actions, activeFilterCount, data?.users, query, userId],
  );

  return (
    <div className="page-workspace activity-log-workspace">
      <PageHeader
        eyebrow="Jejak Audit"
        title="Catatan Aktivitas"
        subtitle="Audit internal."
      />

      {filterControls}

      <OpsPanel className="page-pane activity-log-panel p-5">
        <SectionHeader title="Linimasa Aktivitas" />
        <div className="page-scroll activity-log-scroll mt-5 table-shell">
          <table className="data-table">
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Pengguna</th>
                <th>Aksi</th>
                <th>Objek</th>
                <th>Deskripsi</th>
                <th>Level</th>
              </tr>
            </thead>
            <tbody>
              {pagedLogs.length ? (
                pagedLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="text-sm text-[color:var(--muted-fg)]">{formatDateTime(log.createdAt)}</td>
                    <td>{log.userName}</td>
                    <td className="font-semibold text-[color:var(--text-strong)]">{log.action}</td>
                    <td className="font-mono text-sm text-[color:var(--brand-primary)]">{log.targetLabel}</td>
                    <td className="max-w-[460px] text-sm leading-6">{normalizeOperationalCopy(log.description)}</td>
                    <td>
                      <StatusBadge value={log.level} label={log.level} />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      icon={History}
                      title="Belum ada log yang cocok"
                      copy="Ubah filter atau pencarian utama."
                      className="m-4"
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="table-pagination-footer">
          <button
            type="button"
            className="topbar-button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={currentPage <= 1}
          >
            <ChevronLeft size={16} />
            Sebelumnya
          </button>
          <p>
            {visibleStart}-{visibleEnd} dari {data?.logs.length ?? 0} • Halaman {currentPage}/{totalPages}
          </p>
          <button
            type="button"
            className="topbar-button"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={currentPage >= totalPages}
          >
            Berikutnya
            <ChevronRight size={16} />
          </button>
        </div>
      </OpsPanel>
    </div>
  );
}
