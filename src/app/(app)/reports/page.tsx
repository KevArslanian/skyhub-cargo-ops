"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FileBarChart2, FileSpreadsheet, ShieldCheck } from "lucide-react";
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

      <OpsPanel className="p-5">
        <SectionHeader title="Print & Report Center" subtitle="Gunakan print view untuk menyimpan PDF formal." />
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Link href="/exports/shipments" className="rounded-[26px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-5 py-5">
            <FileBarChart2 size={20} className="text-[color:var(--brand-primary)]" />
            <p className="mt-4 font-semibold text-[color:var(--text-strong)]">Shipment PDF / Print</p>
            <p className="mt-2 text-sm leading-6 text-[color:var(--muted-fg)]">Gunakan tampilan print untuk simpan sebagai PDF formal shipment.</p>
          </Link>
          <Link href="/exports/activity-log" className="rounded-[26px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-5 py-5">
            <FileBarChart2 size={20} className="text-[color:var(--brand-primary)]" />
            <p className="mt-4 font-semibold text-[color:var(--text-strong)]">Activity PDF / Print</p>
            <p className="mt-2 text-sm leading-6 text-[color:var(--muted-fg)]">Versi formal untuk audit trail operasional dan supervisi.</p>
          </Link>
        </div>
      </OpsPanel>
    </div>
  );
}
