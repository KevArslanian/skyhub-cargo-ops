"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Filter, History, RefreshCw, Search } from "lucide-react";
import { formatAwbDisplay, formatDateTime, formatLogLevel, normalizeOperationalCopy } from "@/lib/format";
import { ACTIVITY_CATEGORY_ALL } from "@/lib/activity-categories";
import { StatusBadge } from "@/components/status-badge";
import { GlassSelect } from "@/components/glass-select";
import { CrudPageScaffold, EmptyState, FilterBar, FilterFields, FilterSearch, OpsPanel, PaginationBar, SectionHeader } from "@/components/ops-ui";
import { useVisibleTablePageSize } from "@/lib/use-visible-table-page-size";
import { useOpsAlert } from "@/components/ops-alert-provider";
import { networkErrorMessage, readApiError } from "@/lib/ops-feedback";

type ActivityCategory = {
  id: string;
  label: string;
  count: number;
};

type ActivityLogItem = {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  targetLabel: string;
  targetHref: string | null;
  category: string;
  categoryLabel: string;
  description: string;
  level: string;
  userName: string;
  userId: string | null;
  createdAt: string;
};

type ActivityPayload = {
  users: { id: string; name: string }[];
  categories: ActivityCategory[];
  logs: ActivityLogItem[];
};

export default function ActivityLogPage() {
  const router = useRouter();
  const { showAlert } = useOpsAlert();
  const [category, setCategory] = useState<string>(ACTIVITY_CATEGORY_ALL);
  const [action, setAction] = useState("all");
  const [userId, setUserId] = useState("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ActivityPayload | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const tableRef = useRef<HTMLTableElement | null>(null);

  const loadActivityLog = useCallback(async () => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("query", query.trim());
    if (action !== "all") params.set("action", action);
    if (userId !== "all") params.set("userId", userId);
    if (category !== ACTIVITY_CATEGORY_ALL) params.set("category", category);

    setRefreshing(true);
    try {
      const response = await fetch(`/api/activity-log?${params.toString()}`, {
        cache: "no-store",
        credentials: "include",
      });
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok) {
        showAlert({
          title: "Gagal Memuat",
          description: await readApiError(response, "Catatan aktivitas belum bisa dimuat."),
          tone: "error",
        });
        return;
      }
      const payload = (await response.json()) as ActivityPayload;
      setData(payload);
    } catch {
      showAlert({
        title: "Koneksi Terputus",
        description: networkErrorMessage("memuat catatan aktivitas"),
        tone: "warning",
      });
    } finally {
      setRefreshing(false);
    }
  }, [action, category, query, router, showAlert, userId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadActivityLog();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadActivityLog]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadActivityLog();
    }, 60_000);

    return () => window.clearInterval(interval);
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
  const logPageSize = useVisibleTablePageSize(
    tableScrollRef,
    tableRef,
    Boolean(data?.logs.length),
    data?.logs.length ?? 0,
    { fallback: 3, min: 1, max: 8 },
  );
  const totalPages = Math.max(1, Math.ceil((data?.logs.length ?? 0) / logPageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * logPageSize;
  const pagedLogs = (data?.logs ?? []).slice(pageStart, pageStart + logPageSize);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [logPageSize, totalPages]);
  const visibleStart = data?.logs.length ? pageStart + 1 : 0;
  const visibleEnd = Math.min(pageStart + pagedLogs.length, data?.logs.length ?? 0);
  const activeFilterCount = [category !== ACTIVITY_CATEGORY_ALL, action !== "all", userId !== "all", Boolean(query.trim())].filter(
    Boolean,
  ).length;

  const categoryTabs = data?.categories ?? [];

  const filterControls = useMemo(
    () => (
      <FilterBar ariaLabel="Pencarian dan filter Catatan Aktivitas">
        <FilterSearch>
          <label className="label" htmlFor="activity-query">
            Cari Log
          </label>
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
              placeholder="Cari log aktivitas"
            />
          </div>
        </FilterSearch>
        <FilterFields aria-label="Filter Catatan Aktivitas">
          <div className="shell-filter-field">
            <label className="label" htmlFor="activity-action">
              Aksi
            </label>
            <GlassSelect
              id="activity-action"
              aria-label="Filter aksi aktivitas"
              value={action}
              onChange={(value) => {
                setAction(value);
                setPage(1);
              }}
              options={[{ value: "all", label: "Semua aksi" }, ...actions.map((item) => ({ value: item, label: item }))]}
            />
          </div>
          <div className="shell-filter-field">
            <label className="label" htmlFor="activity-user">
              Pengguna
            </label>
            <GlassSelect
              id="activity-user"
              aria-label="Filter pengguna aktivitas"
              value={userId}
              onChange={(value) => {
                setUserId(value);
                setPage(1);
              }}
              options={[
                { value: "all", label: "Semua pengguna" },
                ...(data?.users ?? []).map((user) => ({ value: user.id, label: user.name })),
              ]}
            />
          </div>
          {activeFilterCount > 0 ? (
            <span className="shell-filter-count" aria-label={`${activeFilterCount} filter aktif`}>
              <Filter size={14} />
              {activeFilterCount}
            </span>
          ) : null}
          <button
            type="button"
            className="btn btn-secondary h-9 gap-2 px-4"
            onClick={() => void loadActivityLog()}
            disabled={refreshing}
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : undefined} />
            Muat ulang
          </button>
        </FilterFields>
      </FilterBar>
    ),
    [action, actions, activeFilterCount, data?.users, loadActivityLog, query, refreshing, userId],
  );

  return (
    <CrudPageScaffold
      className="activity-log-workspace"
      eyebrow="Jejak Audit"
      title="Catatan Aktivitas"
      subtitle="Jejak keputusan operator per area kerja."
      filters={
        <>
          <nav className="segmented-control -mx-1 flex gap-2 overflow-x-auto px-1 pb-1" aria-label="Kategori aktivitas">
            {categoryTabs.map((tab) => {
              const active = category === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  className={`ops-tab-button shrink-0 ${active ? "ops-tab-button-active" : ""}`}
                  aria-current={active ? "page" : undefined}
                  onClick={() => {
                    setCategory(tab.id);
                    setPage(1);
                  }}
                >
                  <span>
                    {tab.label}
                    {tab.count > 0 ? ` (${tab.count})` : ""}
                  </span>
                </button>
              );
            })}
          </nav>
          {filterControls}
        </>
      }
      body={
        <OpsPanel className="page-pane activity-log-panel flex min-h-0 flex-1 flex-col overflow-hidden p-5">
        <SectionHeader className="shrink-0" title="Linimasa Aktivitas" />
        <div ref={tableScrollRef} className="page-scroll activity-log-scroll mt-4 min-h-0 flex-1 table-shell">
          <table ref={tableRef} className="data-table">
            <thead>
              <tr>
                <th>Waktu</th>
                {category === ACTIVITY_CATEGORY_ALL ? <th>Kategori</th> : null}
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
                    {category === ACTIVITY_CATEGORY_ALL ? (
                      <td>
                        <span className="rounded-full border border-[color:var(--border-soft)] px-2.5 py-1 text-xs font-semibold text-[color:var(--muted-fg)]">
                          {log.categoryLabel}
                        </span>
                      </td>
                    ) : null}
                    <td>{log.userName}</td>
                    <td className="font-semibold text-[color:var(--text-strong)]">{log.action}</td>
                    <td className="max-w-[180px] font-mono text-sm tabular-nums tracking-tight text-[color:var(--brand-primary)]">
                      {log.targetHref ? (
                        <Link href={log.targetHref} className="block truncate hover:underline" title={log.targetLabel}>
                          {formatAwbDisplay(log.targetLabel)}
                        </Link>
                      ) : (
                        <span className="block truncate" title={log.targetLabel}>
                          {formatAwbDisplay(log.targetLabel)}
                        </span>
                      )}
                    </td>
                    <td className="max-w-[460px] text-sm leading-6">{normalizeOperationalCopy(log.description)}</td>
                    <td>
                      <StatusBadge value={log.level} label={formatLogLevel(log.level)} />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={category === ACTIVITY_CATEGORY_ALL ? 7 : 6}>
                    <EmptyState
                      icon={History}
                      title="Belum ada log yang cocok"
                      copy="Ubah tab kategori, filter, atau pencarian utama."
                      className="m-4"
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </OpsPanel>
      }
      footer={
        <PaginationBar
          page={currentPage}
          totalPages={totalPages}
          visibleStart={visibleStart}
          visibleEnd={visibleEnd}
          totalItems={data?.logs.length ?? 0}
          onPageChange={(nextPage) => setPage(nextPage)}
          label="Aktivitas"
        />
      }
    />
  );
}