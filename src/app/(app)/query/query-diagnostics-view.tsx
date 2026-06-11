"use client";

import { useState } from "react";
import { OpsPanel, PaginationBar, SectionHeader, StatCard } from "@/components/ops-ui";
import { OPS_LIST_PAGE_SIZE } from "@/lib/constants";

type QueryDiagnosticsPayload = Awaited<ReturnType<typeof import("@/lib/query-diagnostics").getQueryDiagnostics>>;

export function QueryDiagnosticsView({ diagnostics }: { diagnostics: QueryDiagnosticsPayload }) {
  const [page, setPage] = useState(1);
  const rows = diagnostics.roleDistribution;
  const totalPages = Math.max(1, Math.ceil(rows.length / OPS_LIST_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * OPS_LIST_PAGE_SIZE;
  const pagedRows = rows.slice(pageStart, pageStart + OPS_LIST_PAGE_SIZE);
  const visibleStart = rows.length ? pageStart + 1 : 0;
  const visibleEnd = Math.min(pageStart + pagedRows.length, rows.length);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <div className="grid shrink-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
        <div className="mt-4 table-shell overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Peran</th>
                <th>Status</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((item) => (
                <tr key={`${item.role}-${item.status}`}>
                  <td className="font-semibold text-[color:var(--text-strong)]">{item.role}</td>
                  <td>{item.status}</td>
                  <td className="font-mono">{item.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length > OPS_LIST_PAGE_SIZE ? (
          <div className="mt-4 shrink-0">
            <PaginationBar
              page={currentPage}
              totalPages={totalPages}
              visibleStart={visibleStart}
              visibleEnd={visibleEnd}
              totalItems={rows.length}
              onPageChange={setPage}
              label="Baris"
            />
          </div>
        ) : null}
      </OpsPanel>

      <details className="shrink-0 rounded-[18px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)] px-4 py-3">
        <summary className="cursor-pointer text-sm font-semibold text-[color:var(--text-strong)]">Data mentah (JSON)</summary>
        <pre className="mt-3 max-h-[4.5rem] overflow-hidden rounded-[16px] border border-[color:var(--border-soft)] bg-[color:var(--panel-bg)] p-3 text-xs leading-6 text-[color:var(--text-strong)]">
          {JSON.stringify(diagnostics, null, 2)}
        </pre>
      </details>
    </div>
  );
}