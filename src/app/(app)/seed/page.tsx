import Link from "next/link";
import { OpsPanel, PageHeader, SectionHeader } from "@/components/ops-ui";
import { requireInternalUser } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { getQueryDiagnostics } from "@/lib/query-diagnostics";

export const dynamic = "force-dynamic";

export default async function SeedPage() {
  const user = await requireUser();
  requireInternalUser(user, user.role === "customer" ? "/awb-tracking" : "/dashboard");

  const diagnostics = await getQueryDiagnostics();

  return (
    <div className="page-workspace">
      <PageHeader
        eyebrow="Seed Database"
        title="Utilitas Seed"
        subtitle="Halaman utilitas untuk cek status hasil seed dan perintah resmi yang dipakai pada Neon."
      />

      <OpsPanel className="page-pane p-5">
        <SectionHeader title="Perintah Seed" subtitle="Jalankan perintah ini dari terminal workspace project." />
        <div className="mt-4 rounded-[18px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted-2)]">Perintah Seed</p>
          <code className="mt-2 block text-sm text-[color:var(--text-strong)]">pnpm db:seed</code>
        </div>
        <div className="mt-3 rounded-[18px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted-2)]">Cek Migrasi</p>
          <code className="mt-2 block text-sm text-[color:var(--text-strong)]">pnpm prisma migrate status</code>
        </div>
        <p className="mt-4 text-sm text-[color:var(--muted-fg)]">
          Untuk hasil query setelah seed, buka{" "}
          <Link href="/query" className="text-[color:var(--brand-primary)] hover:underline">
            /query
          </Link>
          .
        </p>
      </OpsPanel>

      <OpsPanel className="page-pane p-5">
        <SectionHeader title="Snapshot Setelah Seed" subtitle="Ringkasan jumlah data saat ini di Neon." />
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-[18px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-4 text-sm">
            <p className="text-[color:var(--muted-fg)]">Pengguna</p>
            <p className="mt-1 text-lg font-semibold text-[color:var(--text-strong)]">{diagnostics.counts.user}</p>
          </div>
          <div className="rounded-[18px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-4 text-sm">
            <p className="text-[color:var(--muted-fg)]">Penerbangan</p>
            <p className="mt-1 text-lg font-semibold text-[color:var(--text-strong)]">{diagnostics.counts.flight}</p>
          </div>
          <div className="rounded-[18px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-4 text-sm">
            <p className="text-[color:var(--muted-fg)]">Pengiriman</p>
            <p className="mt-1 text-lg font-semibold text-[color:var(--text-strong)]">{diagnostics.counts.shipment}</p>
          </div>
          <div className="rounded-[18px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-4 text-sm">
            <p className="text-[color:var(--muted-fg)]">Log Pelacakan</p>
            <p className="mt-1 text-lg font-semibold text-[color:var(--text-strong)]">
              {diagnostics.counts.trackingLog}
            </p>
          </div>
          <div className="rounded-[18px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-4 text-sm">
            <p className="text-[color:var(--muted-fg)]">Catatan Aktivitas</p>
            <p className="mt-1 text-lg font-semibold text-[color:var(--text-strong)]">
              {diagnostics.counts.activityLog}
            </p>
          </div>
          <div className="rounded-[18px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-4 text-sm">
            <p className="text-[color:var(--muted-fg)]">KPI Sistem</p>
            <p className="mt-1 text-lg font-semibold text-[color:var(--text-strong)]">{diagnostics.counts.systemKpi}</p>
          </div>
          <div className="rounded-[18px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-4 text-sm">
            <p className="text-[color:var(--muted-fg)]">Kota</p>
            <p className="mt-1 text-lg font-semibold text-[color:var(--text-strong)]">{diagnostics.counts.city}</p>
          </div>
          <div className="rounded-[18px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-4 text-sm">
            <p className="text-[color:var(--muted-fg)]">Bandara</p>
            <p className="mt-1 text-lg font-semibold text-[color:var(--text-strong)]">{diagnostics.counts.airport}</p>
          </div>
          <div className="rounded-[18px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-4 text-sm">
            <p className="text-[color:var(--muted-fg)]">Pesawat</p>
            <p className="mt-1 text-lg font-semibold text-[color:var(--text-strong)]">{diagnostics.counts.aircraft}</p>
          </div>
          <div className="rounded-[18px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-4 text-sm">
            <p className="text-[color:var(--muted-fg)]">Komoditas</p>
            <p className="mt-1 text-lg font-semibold text-[color:var(--text-strong)]">{diagnostics.counts.commodity}</p>
          </div>
          <div className="rounded-[18px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-4 text-sm">
            <p className="text-[color:var(--muted-fg)]">Tarif</p>
            <p className="mt-1 text-lg font-semibold text-[color:var(--text-strong)]">{diagnostics.counts.tariff}</p>
          </div>
          <div className="rounded-[18px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-4 text-sm">
            <p className="text-[color:var(--muted-fg)]">Item Kargo</p>
            <p className="mt-1 text-lg font-semibold text-[color:var(--text-strong)]">{diagnostics.counts.cargoItem}</p>
          </div>
          <div className="rounded-[18px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-4 text-sm">
            <p className="text-[color:var(--muted-fg)]">Detail Pengiriman</p>
            <p className="mt-1 text-lg font-semibold text-[color:var(--text-strong)]">{diagnostics.counts.shipmentDetail}</p>
          </div>
          <div className="rounded-[18px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-4 text-sm">
            <p className="text-[color:var(--muted-fg)]">Item Pengiriman</p>
            <p className="mt-1 text-lg font-semibold text-[color:var(--text-strong)]">{diagnostics.counts.shipmentItem}</p>
          </div>
        </div>
      </OpsPanel>
    </div>
  );
}
