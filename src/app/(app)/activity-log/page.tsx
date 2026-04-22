"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FileText, History, ShieldAlert, ShieldCheck, TriangleAlert } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { FilterBar, OpsPanel, PageHeader, SectionHeader, StatCard } from "@/components/ops-ui";

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

export default function ActivityLogPage() {
  const [query, setQuery] = useState("");
  const [action, setAction] = useState("all");
  const [userId, setUserId] = useState("all");
  const [data, setData] = useState<ActivityPayload | null>(null);

  useEffect(() => {
    async function load() {
      const params = new URLSearchParams();
      if (query.trim()) params.set("query", query.trim());
      if (action !== "all") params.set("action", action);
      if (userId !== "all") params.set("userId", userId);
      const response = await fetch(`/api/activity-log?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as ActivityPayload;
      setData(payload);
    }

    void load();
  }, [query, action, userId]);

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

  const exportParams = new URLSearchParams();
  if (query.trim()) exportParams.set("query", query.trim());
  if (action !== "all") exportParams.set("action", action);
  if (userId !== "all") exportParams.set("userId", userId);

  return (
    <div className="page-workspace activity-log-workspace">
      <PageHeader
        eyebrow="Jejak Audit"
        title="Log Aktivitas"
        subtitle="Riwayat yang mudah dibaca untuk login, update shipment, upload dokumen, cetak, dan perubahan pengaturan yang relevan bagi tim staff dan admin."
      />

      <div className="grid gap-4 xl:grid-cols-4">
        <StatCard label="Berhasil" value={levels.success} note="Aksi berhasil tersimpan atau dieksekusi." icon={ShieldCheck} tone="success" />
        <StatCard label="Info" value={levels.info} note="Aktivitas normal staff dan sistem." icon={History} tone="info" />
        <StatCard label="Peringatan" value={levels.warning} note="Event yang memerlukan perhatian tetapi belum fatal." icon={TriangleAlert} tone="warning" />
        <StatCard label="Galat" value={levels.error} note="Kejadian gagal atau exception log yang tercatat." icon={ShieldAlert} tone="danger" />
      </div>

      <FilterBar className="xl:grid-cols-[1fr_220px_220px_auto]">
        <div>
          <label className="label">Cari log</label>
          <input className="input-field" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="AWB, deskripsi, target..." />
        </div>
        <div>
          <label className="label">Aksi</label>
          <select className="select-field" value={action} onChange={(event) => setAction(event.target.value)}>
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
          <select className="select-field" value={userId} onChange={(event) => setUserId(event.target.value)}>
            <option value="all">Semua pengguna</option>
            {(data?.users ?? []).map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </div>
        <Link href={`/exports/activity-log?${exportParams.toString()}`} className="btn btn-secondary self-end">
          <FileText size={16} />
          PDF / Print
        </Link>
      </FilterBar>

      <OpsPanel className="page-pane activity-log-panel p-5">
        <SectionHeader title="Timeline Aktivitas" subtitle="Semua entri audit disusun dalam tabel padat untuk memudahkan review cepat saat shift berjalan." />
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
              {(data?.logs ?? []).map((log) => (
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
              ))}
            </tbody>
          </table>
        </div>
      </OpsPanel>
    </div>
  );
}
