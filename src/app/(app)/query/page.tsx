import { OpsPanel, PageHeader, SectionHeader, StatCard } from "@/components/ops-ui";
import { requireInternalUser } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { getQueryDiagnostics } from "@/lib/query-diagnostics";

export const dynamic = "force-dynamic";

export default async function QueryPage() {
  const user = await requireUser();
  requireInternalUser(user, user.role === "customer" ? "/awb-tracking" : "/dashboard");

  const diagnostics = await getQueryDiagnostics();

  return (
    <div className="page-workspace">
      <PageHeader
        eyebrow="Database Query"
        title="Query Check"
        subtitle="Ringkasan hasil query langsung dari database Neon untuk validasi tabel, relasi, dan distribusi data."
      />

      <div className="grid gap-4 xl:grid-cols-4">
        <StatCard label="Total User" value={diagnostics.counts.user} note="Jumlah akun pada sistem." tone="primary" />
        <StatCard label="Total Flight" value={diagnostics.counts.flight} note="Flight aktif pada board." tone="info" />
        <StatCard label="Total Shipment" value={diagnostics.counts.shipment} note="Shipment aktif yang tersimpan." tone="success" />
        <StatCard
          label="Total Tracking Log"
          value={diagnostics.counts.trackingLog}
          note="Log pergerakan shipment."
          tone="warning"
        />
      </div>

      <OpsPanel className="page-pane p-5">
        <SectionHeader
          title="Distribusi Role"
          subtitle={`Generated at ${new Date(diagnostics.generatedAt).toLocaleString("id-ID")}`}
        />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="text-left text-[color:var(--muted-fg)]">
              <tr>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {diagnostics.roleDistribution.map((item) => (
                <tr key={`${item.role}-${item.status}`} className="border-t border-[color:var(--border-soft)]">
                  <td className="px-3 py-2">{item.role}</td>
                  <td className="px-3 py-2">{item.status}</td>
                  <td className="px-3 py-2">{item.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </OpsPanel>

      <OpsPanel className="page-pane p-5">
        <SectionHeader title="Raw Query Output" subtitle="JSON hasil query siap dipakai untuk pengecekan cepat." />
        <pre className="mt-4 overflow-x-auto rounded-[20px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] p-4 text-xs leading-6 text-[color:var(--text-strong)]">
          {JSON.stringify(diagnostics, null, 2)}
        </pre>
      </OpsPanel>
    </div>
  );
}
