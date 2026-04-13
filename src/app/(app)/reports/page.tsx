"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Download, FileBarChart2, FileSpreadsheet, ShieldCheck } from "lucide-react";
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
      .then((payload) => setMetrics(payload.metrics))
      .catch(() => undefined);
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Management Module"
        title="Reports"
        subtitle="Ruang sekunder untuk export, statistik ringkas, dan ringkasan manajerial tanpa mengganggu workflow operator di dashboard utama."
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <StatCard label="Shipment Harian" value={metrics?.shipmentsToday ?? 0} note="Ringkasan volume masuk gudang udara hari ini." icon={FileBarChart2} tone="primary" />
        <StatCard label="Flight On-Time" value={metrics?.onTime ?? 0} note="Dipakai untuk evaluasi performa operasional." icon={ShieldCheck} tone="success" />
        <StatCard label="Open Issues" value={metrics?.holds ?? 0} note="Shipment hold dan exception yang masih perlu review." icon={FileSpreadsheet} tone="warning" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <OpsPanel className="p-5">
          <SectionHeader title="Export Center" subtitle="Semua export mengambil data yang sama dengan modul operasional utama." />
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Link href="/api/exports/shipments" className="rounded-[26px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-5 py-5">
              <Download size={20} className="text-[color:var(--brand-primary)]" />
              <p className="mt-4 font-semibold text-[color:var(--text-strong)]">Shipment Ledger CSV</p>
              <p className="mt-2 text-sm leading-6 text-[color:var(--muted-fg)]">Ekspor tabel shipment aktual sesuai data terbaru.</p>
            </Link>
            <Link href="/api/exports/activity-log" className="rounded-[26px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-5 py-5">
              <Download size={20} className="text-[color:var(--brand-primary)]" />
              <p className="mt-4 font-semibold text-[color:var(--text-strong)]">Activity Log CSV</p>
              <p className="mt-2 text-sm leading-6 text-[color:var(--muted-fg)]">Ekspor audit trail operator dan sistem.</p>
            </Link>
            <Link href="/exports/shipments" className="rounded-[26px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-5 py-5">
              <FileBarChart2 size={20} className="text-[color:var(--brand-primary)]" />
              <p className="mt-4 font-semibold text-[color:var(--text-strong)]">Shipment PDF / Print</p>
              <p className="mt-2 text-sm leading-6 text-[color:var(--muted-fg)]">Gunakan tampilan print untuk simpan sebagai PDF.</p>
            </Link>
            <Link href="/exports/activity-log" className="rounded-[26px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-5 py-5">
              <FileBarChart2 size={20} className="text-[color:var(--brand-primary)]" />
              <p className="mt-4 font-semibold text-[color:var(--text-strong)]">Activity PDF / Print</p>
              <p className="mt-2 text-sm leading-6 text-[color:var(--muted-fg)]">Versi formal untuk audit dan supervisi.</p>
            </Link>
          </div>
        </OpsPanel>

        <OpsPanel className="p-5">
          <SectionHeader title="Catatan Operasional" subtitle="Konvensi yang dipertahankan agar modul reports tetap aman dan ringan." />
          <div className="mt-5 space-y-4">
            {[
              "Dashboard tetap fokus ke operator, sedangkan halaman Reports dipakai untuk rangkuman dan export manajerial.",
              "Semua angka di modul ini diambil dari sumber data yang sama dengan dashboard dan activity log.",
              "Format PDF memakai browser print agar aman dipakai lokal maupun deployment tanpa generator dokumen tambahan.",
            ].map((note) => (
              <div key={note} className="rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-4 py-4 text-sm leading-6 text-[color:var(--muted-fg)]">
                {note}
              </div>
            ))}
          </div>
        </OpsPanel>
      </div>
    </div>
  );
}
