import Link from "next/link";
import { OpsLockedPage } from "@/components/ops-locked-page";
import { OpsPanel, PageHeader, SectionHeader, StatCard } from "@/components/ops-ui";
import { requireRole } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { getQueryDiagnostics } from "@/lib/query-diagnostics";

export const dynamic = "force-dynamic";

export default async function SeedPage() {
  const user = await requireUser();
  requireRole(user, ["admin"], "/dashboard");

  const diagnostics = await getQueryDiagnostics();

  return (
    <OpsLockedPage
      className="seed-viewport"
      header={
        <PageHeader
          eyebrow="Seed Database"
          title="Utilitas Seed"
          subtitle="Halaman utilitas untuk cek status hasil seed dan perintah resmi yang dipakai pada Neon."
        />
      }
      body={
        <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
          <OpsPanel className="shrink-0 p-5">
            <SectionHeader title="Perintah Seed" subtitle="Jalankan perintah ini dari terminal workspace project." />
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-[18px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted-2)]">Perintah Seed</p>
                <code className="mt-2 block text-sm text-[color:var(--text-strong)]">pnpm db:seed</code>
              </div>
              <div className="rounded-[18px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted-2)]">Cek Migrasi</p>
                <code className="mt-2 block text-sm text-[color:var(--text-strong)]">pnpm prisma migrate status</code>
              </div>
            </div>
            <p className="mt-4 text-sm text-[color:var(--muted-fg)]">
              Untuk hasil query setelah seed, buka{" "}
              <Link href="/query" className="text-[color:var(--brand-primary)] hover:underline">
                /query
              </Link>
              .
            </p>
          </OpsPanel>

          <OpsPanel className="min-h-0 flex-1 overflow-hidden p-5">
            <SectionHeader title="Snapshot Setelah Seed" subtitle="Ringkasan jumlah data utama di Neon." />
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <StatCard label="Pengguna" value={diagnostics.counts.user} note="Akun operator & admin." tone="primary" />
              <StatCard label="Penerbangan" value={diagnostics.counts.flight} note="Jadwal aktif di papan." tone="info" />
              <StatCard label="Pengiriman" value={diagnostics.counts.shipment} note="Manifest aktif tersimpan." tone="success" />
              <StatCard label="Log Pelacakan" value={diagnostics.counts.trackingLog} note="Riwayat pergerakan AWB." tone="warning" />
              <StatCard label="Catatan Aktivitas" value={diagnostics.counts.activityLog} note="Jejak audit operator." tone="info" />
              <StatCard label="KPI Sistem" value={diagnostics.counts.systemKpi} note="Agregat metrik global." tone="primary" />
            </div>
          </OpsPanel>
        </div>
      }
    />
  );
}