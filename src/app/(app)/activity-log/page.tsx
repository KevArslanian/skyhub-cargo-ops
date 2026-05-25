"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, History, RotateCcw, ShieldAlert, ShieldCheck, TriangleAlert } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState, FilterBar, OpsPanel, PageHeader, SectionHeader, StatCard } from "@/components/ops-ui";

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

  const levels = useMemo(() => {
    const counts = { success: 0, info: 0, warning: 0, error: 0 };
    (data?.logs ?? []).forEach((log) => {
      if (log.level in counts) {
        counts[log.level as keyof typeof counts] += 1;
      }
    });
    return counts;
  }, [data]);

  const actions = Array.from(new Set((data?.logs ?? []).map((log) => log.action)));
  const totalPages = Math.max(1, Math.ceil((data?.logs.length ?? 0) / ACTIVITY_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * ACTIVITY_PAGE_SIZE;
  const pagedLogs = (data?.logs ?? []).slice(pageStart, pageStart + ACTIVITY_PAGE_SIZE);
  const visibleStart = data?.logs.length ? pageStart + 1 : 0;
  const visibleEnd = Math.min(pageStart + pagedLogs.length, data?.logs.length ?? 0);
  const filtersDirty = action !== "all" || userId !== "all" || query.trim() !== "";

  function handleResetFilters() {
    setAction("all");
    setUserId("all");
    setQuery("");
    setPage(1);
  }

  return (
    <div className="page-workspace activity-log-workspace">
      <PageHeader
        eyebrow="Jejak Audit"
        title="Log Aktivitas"
        subtitle="Audit internal."
      />

      <div className="grid gap-4 xl:grid-cols-4">
        <StatCard label="Berhasil" value={levels.success} note="Aksi berhasil tersimpan atau dieksekusi." icon={ShieldCheck} tone="success" />
        <StatCard label="Info" value={levels.info} note="Aktivitas normal staff dan sistem." icon={History} tone="info" />
        <StatCard label="Peringatan" value={levels.warning} note="Event yang memerlukan perhatian tetapi belum fatal." icon={TriangleAlert} tone="warning" />
        <StatCard label="Galat" value={levels.error} note="Kejadian gagal atau exception log yang tercatat." icon={ShieldAlert} tone="danger" />
      </div>

      <FilterBar className="activity-log-filter-bar activity-log-filter-bar-compact">
        <div>
          <label className="label">Aksi</label>
          <select
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
        <div>
          <label className="label">Pengguna</label>
          <select
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
        <button type="button" className="topbar-button self-end" onClick={handleResetFilters} disabled={!filtersDirty}>
          <RotateCcw size={16} />
          <span>Reset</span>
        </button>
      </FilterBar>

      <OpsPanel className="page-pane activity-log-panel p-5">
        <SectionHeader title="Timeline Aktivitas" />
        <div className="page-scroll activity-log-scroll mt-5 table-shell">
          <table className="data-table">
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Pengguna</th>
                <th>Aksi</th>
                <th>Target</th>
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
                    <td className="max-w-[460px] text-sm leading-6">{log.description}</td>
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
