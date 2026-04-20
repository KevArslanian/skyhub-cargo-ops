import Script from "next/script";
import { requireUser } from "@/lib/auth";
import { requireInternalUser } from "@/lib/access";
import { listActivityLogs } from "@/lib/data";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ActivityLogPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ query?: string; action?: string; userId?: string }>;
}) {
  const user = await requireUser();
  requireInternalUser(user);
  const params = await searchParams;
  const data = await listActivityLogs(user, params);

  const filterSummary = [
    params.query ? `Query: ${params.query}` : null,
    params.action ? `Aksi: ${params.action}` : null,
    params.userId ? `User: ${params.userId}` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  return (
    <div className="print-shell mx-auto max-w-6xl overflow-x-hidden bg-white p-8 text-black">
      <Script id="print-activity-log">{`window.addEventListener("load", () => window.print(), { once: true });`}</Script>

      <style>{`
        @media print {
          body {
            background: #fff !important;
            color: #0b1d33 !important;
          }

          .print-shell {
            max-width: none !important;
            padding: 0 !important;
          }

          .print-table-wrap {
            overflow: visible !important;
          }

          .print-table {
            min-width: 0 !important;
            width: 100% !important;
          }

          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
          tr, td, th { page-break-inside: avoid; }
        }
      `}</style>

      <header className="rounded-[18px] border border-slate-200 bg-slate-50 px-5 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#003d9b]">SkyHub Print Center</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-[#0b1d33]">Log Aktivitas Operasional</h1>
        <p className="mt-2 text-sm text-slate-600">Dicetak pada {formatDateTime(new Date().toISOString())}</p>
        <p className="mt-2 text-xs text-slate-500">{filterSummary || "Tanpa filter tambahan"}</p>
      </header>

      <section className="print-table-wrap mt-5 w-full max-w-full overflow-x-auto overflow-y-hidden rounded-[18px] border border-slate-200">
        <table className="print-table min-w-[1120px] w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-100 text-slate-700">
              {["Waktu", "Pengguna", "Aksi", "Target", "Deskripsi", "Level"].map((header) => (
                <th key={header} className="border-b border-slate-200 px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em]">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.logs.map((log) => (
              <tr key={log.id} className="odd:bg-white even:bg-slate-50/45">
                <td className="border-b border-slate-200 px-3 py-2 align-top whitespace-nowrap">{formatDateTime(log.createdAt)}</td>
                <td className="border-b border-slate-200 px-3 py-2 align-top break-words">{log.userName}</td>
                <td className="border-b border-slate-200 px-3 py-2 align-top break-words font-semibold text-[#0b1d33]">{log.action}</td>
                <td className="border-b border-slate-200 px-3 py-2 align-top break-all font-mono text-xs text-[#003d9b]">{log.targetLabel}</td>
                <td className="border-b border-slate-200 px-3 py-2 align-top break-words">{log.description}</td>
                <td className="border-b border-slate-200 px-3 py-2 align-top uppercase whitespace-nowrap">{log.level}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
