import Script from "next/script";
import { requireUser } from "@/lib/auth";
import { listActivityLogs } from "@/lib/data";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ActivityLogPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ query?: string; action?: string; userId?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const data = await listActivityLogs(user, params);

  return (
    <div className="mx-auto max-w-6xl bg-white p-8 text-black">
      <Script id="print-activity-log">{`window.addEventListener("load", () => window.print(), { once: true });`}</Script>
      <h1 className="font-[family:var(--font-heading)] text-3xl font-bold">Activity Log Export</h1>
      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr>
            {["Timestamp", "User", "Action", "Target", "Description", "Level"].map((header) => (
              <th key={header} className="border-b border-slate-300 px-3 py-2 text-left">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.logs.map((log) => (
            <tr key={log.id}>
              <td className="border-b border-slate-200 px-3 py-2">{formatDateTime(log.createdAt)}</td>
              <td className="border-b border-slate-200 px-3 py-2">{log.userName}</td>
              <td className="border-b border-slate-200 px-3 py-2">{log.action}</td>
              <td className="border-b border-slate-200 px-3 py-2">{log.targetLabel}</td>
              <td className="border-b border-slate-200 px-3 py-2">{log.description}</td>
              <td className="border-b border-slate-200 px-3 py-2">{log.level}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
