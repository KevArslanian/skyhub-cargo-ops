import { requireUser } from "@/lib/auth";
import { requireInternalUser } from "@/lib/access";
import { listActivityLogs } from "@/lib/data";
import { formatDateTime } from "@/lib/format";
import { buildPrintDocumentCode, type PrintChipTone } from "@deltaoga/skyhub-print-center";
import { PrintCenterLayout } from "@deltaoga/skyhub-print-center/layout";

export const dynamic = "force-dynamic";

function getLogTone(level: string): PrintChipTone {
  if (level === "success") return "success";
  if (level === "warning") return "warning";
  if (level === "error") return "danger";
  if (level === "info") return "info";
  return "neutral";
}

export default async function ActivityLogPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ query?: string; action?: string; userId?: string }>;
}) {
  const user = await requireUser();
  requireInternalUser(user);
  const params = await searchParams;
  const data = await listActivityLogs(user, params);
  const printedAt = new Date();

  const filterSummary = [
    params.query ? `Query: ${params.query}` : null,
    params.action ? `Aksi: ${params.action}` : null,
    params.userId ? `User: ${params.userId}` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  const levelCounters = data.logs.reduce(
    (acc, log) => {
      if (log.level === "success") acc.success += 1;
      else if (log.level === "info") acc.info += 1;
      else if (log.level === "warning") acc.warning += 1;
      else if (log.level === "error") acc.error += 1;
      return acc;
    },
    { success: 0, info: 0, warning: 0, error: 0 },
  );

  return (
    <PrintCenterLayout
      scriptId="print-activity-log"
      documentTitle="Log Aktivitas Operasional"
      documentSubtitle="Audit Trail Aktivitas Pengguna"
      printedAtLabel={formatDateTime(printedAt.toISOString())}
      filterSummary={filterSummary}
      summaryTitle={`Ringkasan • ${data.logs.length} entri`}
      summarySubtitle="Distribusi level aktivitas pada filter aktif."
      summaryChips={[
        { label: `${levelCounters.success} SUCCESS`, tone: "success" },
        { label: `${levelCounters.info} INFO`, tone: "info" },
        { label: `${levelCounters.warning} WARNING`, tone: "warning" },
        { label: `${levelCounters.error} ERROR`, tone: "danger" },
      ]}
      documentCode={buildPrintDocumentCode("ACTIVITY-LOG", printedAt)}
    >
      <section className="print-table-wrap">
        <table className="print-table min-w-[1120px]">
          <thead>
            <tr>
              {["Waktu", "Pengguna", "Aksi", "Target", "Deskripsi", "Level"].map((header) => (
                <th key={header}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.logs.length ? (
              data.logs.map((log) => (
                <tr key={log.id}>
                  <td className="whitespace-nowrap font-mono text-xs text-slate-500">{formatDateTime(log.createdAt)}</td>
                  <td className="font-semibold text-slate-800">{log.userName}</td>
                  <td className="font-semibold text-slate-900">{log.action}</td>
                  <td className="font-mono text-xs text-[#1d4ed8]">{log.targetLabel}</td>
                  <td>{log.description}</td>
                  <td>
                    <span className={`print-badge print-badge-${getLogTone(log.level)}`}>{log.level}</span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                  Tidak ada log aktivitas untuk filter ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </PrintCenterLayout>
  );
}
