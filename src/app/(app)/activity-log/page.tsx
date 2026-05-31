"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, History } from "lucide-react";
import { cn, formatDateTime } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState, FilterBar, OpsPanel, PageHeader, SectionHeader } from "@/components/ops-ui";

const LEVEL_FILTERS = [
  {
    value: "success",
    label: "Berhasil",
    dot: "bg-[color:var(--tone-success)]",
    active: "border-[color:var(--tone-success-border)] bg-[color:var(--tone-success-soft)] text-[color:var(--tone-success)]",
  },
  {
    value: "info",
    label: "Info",
    dot: "bg-[color:var(--tone-info)]",
    active: "border-[color:var(--tone-info-border)] bg-[color:var(--tone-info-soft)] text-[color:var(--tone-info)]",
  },
  {
    value: "warning",
    label: "Peringatan",
    dot: "bg-[color:var(--tone-warning)]",
    active: "border-[color:var(--tone-warning-border)] bg-[color:var(--tone-warning-soft)] text-[color:var(--tone-warning)]",
  },
  {
    value: "error",
    label: "Galat",
    dot: "bg-[color:var(--tone-danger)]",
    active: "border-[color:var(--tone-danger-border)] bg-[color:var(--tone-danger-soft)] text-[color:var(--tone-danger)]",
  },
] as const;

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
  const [level, setLevel] = useState<string>("all");
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

  const actions = Array.from(new Set((data?.logs ?? []).map((log) => log.action)));
  const levels = (data?.logs ?? []).reduce(
    (acc, log) => {
      if (log.level in acc) acc[log.level as keyof typeof acc] += 1;
      return acc;
    },
    { success: 0, info: 0, warning: 0, error: 0 },
  );
  const filteredLogs = level === "all" ? (data?.logs ?? []) : (data?.logs ?? []).filter((log) => log.level === level);
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / ACTIVITY_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * ACTIVITY_PAGE_SIZE;
  const pagedLogs = filteredLogs.slice(pageStart, pageStart + ACTIVITY_PAGE_SIZE);
  const visibleStart = filteredLogs.length ? pageStart + 1 : 0;
  const visibleEnd = Math.min(pageStart + pagedLogs.length, filteredLogs.length);


  return (
    <div className="page-workspace activity-log-workspace">
      <PageHeader
        eyebrow="Jejak Audit"
        title="Log Aktivitas"
        subtitle="Audit internal."
      />

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
        <div className="activity-level-filter">
          <label className="label">Level</label>
          <div className="flex flex-wrap items-center gap-1.5">
            {LEVEL_FILTERS.map((chip) => {
              const selected = level === chip.value;
              return (
                <button
                  key={chip.value}
                  type="button"
                  aria-pressed={selected}
                  title={`Filter level ${chip.label}`}
                  onClick={() => {
                    setLevel((current) => (current === chip.value ? "all" : chip.value));
                    setPage(1);
                  }}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold transition-colors",
                    selected
                      ? chip.active
                      : "border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] text-[color:var(--muted-fg)] hover:text-[color:var(--text-strong)]",
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", chip.dot)} />
                  {chip.label}
                  <span className="tabular-nums font-bold">{levels[chip.value]}</span>
                </button>
              );
            })}
          </div>
        </div>
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
            {visibleStart}-{visibleEnd} dari {filteredLogs.length} • Halaman {currentPage}/{totalPages}
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
