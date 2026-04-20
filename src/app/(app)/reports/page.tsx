"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FileBarChart2, FileText, ShieldCheck } from "lucide-react";
import { OpsPanel, PageHeader, SectionHeader, StatCard } from "@/components/ops-ui";

type DashboardMetrics = {
  metrics: {
    shipmentsToday: number;
    activeFlights: number;
    onTime: number;
    delayed: number;
    departed: number;
    holds: number;
  };
};

export default function ReportsPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics["metrics"] | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((response) => response.json())
      .then((payload) => {
        if (payload.variant === "internal") {
          setMetrics(payload.metrics);
        }
      })
      .catch(() => undefined);
  }, []);

  return (
    <div className="page-workspace">
      <PageHeader
        eyebrow="Pusat Laporan"
        title="Laporan"
        subtitle="Ruang cetak formal untuk ledger shipment dan log aktivitas dengan sumber data yang sama seperti modul operasional."
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <StatCard label="Shipment Harian" value={metrics?.shipmentsToday ?? 0} note="Ringkasan volume kargo yang masuk hari ini." icon={FileBarChart2} tone="primary" />
        <StatCard label="Flight Tepat Waktu" value={metrics?.onTime ?? 0} note="Dipakai untuk melihat performa operasional hari berjalan." icon={ShieldCheck} tone="success" />
        <StatCard label="Isu Terbuka" value={metrics?.holds ?? 0} note="Shipment tertahan atau exception yang masih perlu review." icon={FileText} tone="warning" />
      </div>

      <OpsPanel className="page-pane p-5">
        <SectionHeader title="Pusat Cetak" subtitle="Semua output menggunakan sumber data yang sama dengan modul operasional utama." />
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Link href="/exports/shipments" className="rounded-[26px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-5 py-5">
            <FileBarChart2 size={20} className="text-[color:var(--brand-primary)]" />
            <p className="mt-4 font-semibold text-[color:var(--text-strong)]">Shipment PDF / Print</p>
            <p className="mt-2 text-sm leading-6 text-[color:var(--muted-fg)]">Gunakan tampilan print untuk simpan sebagai PDF atau cetak formal.</p>
          </Link>
          <Link href="/exports/activity-log" className="rounded-[26px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-5 py-5">
            <FileText size={20} className="text-[color:var(--brand-primary)]" />
            <p className="mt-4 font-semibold text-[color:var(--text-strong)]">Log Aktivitas PDF / Print</p>
            <p className="mt-2 text-sm leading-6 text-[color:var(--muted-fg)]">Versi formal untuk kebutuhan audit, supervisi, dan arsip cetak.</p>
          </Link>
        </div>
      </OpsPanel>
    </div>
  );
}
