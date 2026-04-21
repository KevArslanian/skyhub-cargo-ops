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
        eyebrow="Database Seed"
        title="Seed Utility"
        subtitle="Halaman utilitas untuk cek status hasil seed dan command resmi yang dipakai pada Neon."
      />

      <OpsPanel className="page-pane p-5">
        <SectionHeader title="Command Seed" subtitle="Jalankan command ini dari terminal workspace project." />
        <div className="mt-4 rounded-[18px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted-2)]">Seed Command</p>
          <code className="mt-2 block text-sm text-[color:var(--text-strong)]">pnpm db:seed</code>
        </div>
        <div className="mt-3 rounded-[18px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted-2)]">Migrate Check</p>
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
            <p className="text-[color:var(--muted-fg)]">User</p>
            <p className="mt-1 text-lg font-semibold text-[color:var(--text-strong)]">{diagnostics.counts.user}</p>
          </div>
          <div className="rounded-[18px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-4 text-sm">
            <p className="text-[color:var(--muted-fg)]">Flight</p>
            <p className="mt-1 text-lg font-semibold text-[color:var(--text-strong)]">{diagnostics.counts.flight}</p>
          </div>
          <div className="rounded-[18px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-4 text-sm">
            <p className="text-[color:var(--muted-fg)]">Shipment</p>
            <p className="mt-1 text-lg font-semibold text-[color:var(--text-strong)]">{diagnostics.counts.shipment}</p>
          </div>
          <div className="rounded-[18px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-4 text-sm">
            <p className="text-[color:var(--muted-fg)]">Tracking Log</p>
            <p className="mt-1 text-lg font-semibold text-[color:var(--text-strong)]">
              {diagnostics.counts.trackingLog}
            </p>
          </div>
          <div className="rounded-[18px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-4 text-sm">
            <p className="text-[color:var(--muted-fg)]">Activity Log</p>
            <p className="mt-1 text-lg font-semibold text-[color:var(--text-strong)]">
              {diagnostics.counts.activityLog}
            </p>
          </div>
          <div className="rounded-[18px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-4 text-sm">
            <p className="text-[color:var(--muted-fg)]">System KPI</p>
            <p className="mt-1 text-lg font-semibold text-[color:var(--text-strong)]">{diagnostics.counts.systemKpi}</p>
          </div>
        </div>
      </OpsPanel>
    </div>
  );
}
