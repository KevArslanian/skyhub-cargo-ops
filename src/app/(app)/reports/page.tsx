"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FileBarChart2, FileText, Gauge, Radar, ShieldCheck } from "lucide-react";
import { OpsPanel, PageHeader, SectionHeader, StatCard } from "@/components/ops-ui";
import { APP_CANONICAL_URL, absoluteAppUrl } from "@/lib/constants";

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

type LandingMetrics = {
  shipmentsToday: number;
  activeFlights: number;
  onTimeAccuracy: number;
  platformUptime: number;
  generatedAt: string;
};

export default function ReportsPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics["metrics"] | null>(null);
  const [landingMetrics, setLandingMetrics] = useState<LandingMetrics | null>(null);

  useEffect(() => {
    void Promise.all([
      fetch("/api/dashboard").then((response) => response.json()),
      fetch("/api/public/landing-metrics", { cache: "no-store" }).then((response) => response.json()),
    ])
      .then(([dashboardPayload, landingPayload]) => {
        if (dashboardPayload.variant === "internal") {
          setMetrics(dashboardPayload.metrics);
        }
        setLandingMetrics(landingPayload);
      })
      .catch(() => undefined);
  }, []);

  return (
    <div className="page-workspace">
      <PageHeader
        eyebrow="Pusat Laporan"
        title="Laporan"
        subtitle={`Ruang cetak formal dengan sumber data yang sama seperti About Us, dashboard, dan link production ${APP_CANONICAL_URL}.`}
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <StatCard label="Shipment Harian" value={landingMetrics?.shipmentsToday ?? metrics?.shipmentsToday ?? 0} note="Sinkron dengan metrik About Us." icon={FileBarChart2} tone="primary" />
        <StatCard label="Flight Aktif" value={landingMetrics?.activeFlights ?? metrics?.activeFlights ?? 0} note="Diambil dari snapshot operasional yang sama." icon={ShieldCheck} tone="success" />
        <StatCard label="Isu Terbuka" value={metrics?.holds ?? 0} note="Shipment tertahan atau exception yang masih perlu review." icon={FileText} tone="warning" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <StatCard label="Akurasi Tepat Waktu" value={`${landingMetrics?.onTimeAccuracy?.toFixed(1) ?? "0.0"}%`} note="Sama dengan angka About Us." icon={Gauge} tone="success" />
        <StatCard label="Link Production" value={APP_CANONICAL_URL.replace("https://", "")} note="Gunakan link ini untuk pengumpulan asdos." icon={Radar} tone="info" />
      </div>

      <OpsPanel className="page-pane p-5">
        <SectionHeader title="Pusat Cetak" subtitle="Semua output menggunakan sumber data yang sama dengan modul operasional utama." />
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
          <Link href="/exports/flights" className="rounded-[26px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-5 py-5">
            <FileBarChart2 size={20} className="text-[color:var(--brand-primary)]" />
            <p className="mt-4 font-semibold text-[color:var(--text-strong)]">Flight PDF / Print</p>
            <p className="mt-2 text-sm leading-6 text-[color:var(--muted-fg)]">Cetak manifest flight formal dengan status, cutoff, dan jumlah shipment.</p>
          </Link>
          <Link href="/exports/awb" className="rounded-[26px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-5 py-5">
            <Radar size={20} className="text-[color:var(--brand-primary)]" />
            <p className="mt-4 font-semibold text-[color:var(--text-strong)]">AWB PDF / Print</p>
            <p className="mt-2 text-sm leading-6 text-[color:var(--muted-fg)]">Cetak dokumen tracking AWB formal dengan menambahkan query ?awb=...</p>
          </Link>
        </div>

        <div className="mt-6 rounded-[20px] border border-[color:var(--border-soft)] bg-[color:var(--panel-bg)] p-4">
          <p className="text-sm font-semibold text-[color:var(--text-strong)]">Link Print Terpisah (wajib domain production)</p>
          <div className="mt-3 grid gap-2 text-sm text-[color:var(--muted-fg)]">
            <a href={absoluteAppUrl("/exports/shipments")} className="hover:text-[color:var(--brand-primary)]">
              {absoluteAppUrl("/exports/shipments")}
            </a>
            <a href={absoluteAppUrl("/exports/activity-log")} className="hover:text-[color:var(--brand-primary)]">
              {absoluteAppUrl("/exports/activity-log")}
            </a>
            <a href={absoluteAppUrl("/exports/flights?status=&query=&date=")} className="hover:text-[color:var(--brand-primary)]">
              {absoluteAppUrl("/exports/flights?status=&query=&date=")}
            </a>
            <a href={absoluteAppUrl("/exports/awb?awb=")} className="hover:text-[color:var(--brand-primary)]">
              {absoluteAppUrl("/exports/awb?awb=")}
            </a>
          </div>
        </div>
      </OpsPanel>
    </div>
  );
}
