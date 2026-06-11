"use client";

import { useRef } from "react";
import { OpsPanel, SectionHeader, StatCard } from "@/components/ops-ui";
import { useVisibleTablePageSize } from "@/lib/use-visible-table-page-size";

type QueryDiagnosticsPayload = Awaited<ReturnType<typeof import("@/lib/query-diagnostics").getQueryDiagnostics>>;

export function QueryDiagnosticsView({ diagnostics }: { diagnostics: QueryDiagnosticsPayload }) {
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const tableRef = useRef<HTMLTableElement | null>(null);
  const rows = diagnostics.roleDistribution;

  const rowPageSize = useVisibleTablePageSize(
    tableScrollRef,
    tableRef,
    rows.length > 0,
    rows.length,
    { fallback: 4, min: 1, max: rows.length || 8 },
  );
  const visibleRows = rows.slice(0, Math.min(rows.length, rowPageSize));

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <div className="grid shrink-0 grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        <StatCard label="Total Pengguna" value={diagnostics.counts.user} note="Jumlah akun pada sistem." tone="primary" />
        <StatCard label="Total Penerbangan" value={diagnostics.counts.flight} note="Penerbangan aktif pada papan." tone="info" />
        <StatCard label="Total Pengiriman" value={diagnostics.counts.shipment} note="Pengiriman aktif yang tersimpan." tone="success" />
        <StatCard
          label="Total Log Pelacakan"
          value={diagnostics.counts.trackingLog}
          note="Catatan pergerakan pengiriman."
          tone="warning"
        />
      </div>

      <OpsPanel className="flex min-h-0 flex-1 flex-col overflow-hidden p-5">
        <SectionHeader
          title="Distribusi Peran"
          subtitle={`Dibuat pada ${new Date(diagnostics.generatedAt).toLocaleString("id-ID")}`}
        />
        <div
          ref={tableScrollRef}
          className="query-diagnostics-table-scroll mt-4 min-h-0 flex-1 table-shell overflow-hidden"
        >
          <table ref={tableRef} className="data-table">
            <thead>
              <tr>
                <th>Peran</th>
                <th>Status</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((item) => (
                <tr key={`${item.role}-${item.status}`}>
                  <td className="font-semibold text-[color:var(--text-strong)]">{item.role}</td>
                  <td>{item.status}</td>
                  <td className="font-mono">{item.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </OpsPanel>

      <details className="hidden shrink-0 rounded-[18px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-4 py-3 sm:block">
        <summary className="cursor-pointer text-sm font-semibold text-[color:var(--text-strong)]">Data mentah (JSON)</summary>
        <pre className="mt-3 max-h-[4.5rem] overflow-hidden rounded-[16px] border border-[color:var(--border-soft)] bg-[color:var(--panel-bg)] p-3 text-xs leading-6 text-[color:var(--text-strong)]">
          {JSON.stringify(diagnostics, null, 2)}
        </pre>
      </details>
    </div>
  );
}