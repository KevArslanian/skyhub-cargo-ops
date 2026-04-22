import { requireUser } from "@/lib/auth";
import { getShipmentByAwb } from "@/lib/data";
import { formatDateTime, formatWeight } from "@/lib/format";
import { buildPrintDocumentCode, type PrintChipTone } from "@deltaoga/skyhub-print-center";
import { PrintCenterLayout } from "@deltaoga/skyhub-print-center/layout";

export const dynamic = "force-dynamic";

function getShipmentTone(status: string): PrintChipTone {
  if (status === "hold") return "warning";
  if (status === "arrived") return "success";
  if (status === "loaded_to_aircraft" || status === "departed") return "info";
  return "neutral";
}

export default async function AwbPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ awb?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const printedAt = new Date();
  const awb = params.awb?.trim() || "";
  const shipment = awb ? await getShipmentByAwb(user, awb) : null;

  const summaryChips = shipment
    ? [
        { label: shipment.statusLabel, tone: getShipmentTone(shipment.status) },
        { label: `Dokumen ${shipment.docStatus}`, tone: "info" as const },
        { label: `Readiness ${shipment.readiness}`, tone: "neutral" as const },
        { label: shipment.flightNumber || "Tanpa Flight", tone: "neutral" as const },
      ]
    : [{ label: "AWB tidak ditemukan", tone: "warning" as const }];

  return (
    <PrintCenterLayout
      scriptId="print-awb"
      documentTitle={shipment ? `AWB ${shipment.awb}` : "AWB Tracking"}
      documentSubtitle="Dokumen Pelacakan AWB"
      printedAtLabel={formatDateTime(printedAt.toISOString())}
      filterSummary={awb ? `AWB: ${awb}` : "AWB belum diberikan"}
      summaryTitle={shipment ? "Ringkasan Shipment" : "Status Permintaan"}
      summarySubtitle={
        shipment
          ? `${shipment.origin} -> ${shipment.destination} • ${shipment.commodity}`
          : "Masukkan query `?awb=XXX-XXXXXXXX` untuk mencetak dokumen tracking AWB."
      }
      summaryChips={summaryChips}
      documentCode={buildPrintDocumentCode("AWB", printedAt)}
    >
      {shipment ? (
        <>
          <section className="grid gap-3 border-t border-slate-200 bg-white px-8 py-5 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Shipper</p>
              <p className="mt-1 font-semibold text-slate-900">{shipment.shipper}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Consignee</p>
              <p className="mt-1 font-semibold text-slate-900">{shipment.consignee}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Kargo</p>
              <p className="mt-1 font-semibold text-slate-900">
                {shipment.pieces} pcs • {formatWeight(shipment.weightKg)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Update Terakhir</p>
              <p className="mt-1 font-semibold text-slate-900">{formatDateTime(shipment.updatedAt)}</p>
            </div>
          </section>

          <section className="print-table-wrap">
            <table className="print-table min-w-[980px]">
              <thead>
                <tr>
                  {["Waktu", "Event", "Lokasi", "Aktor", "Keterangan"].map((header) => (
                    <th key={header}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shipment.trackingLogs.length ? (
                  shipment.trackingLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="whitespace-nowrap font-mono text-xs text-slate-500">{formatDateTime(log.createdAt)}</td>
                      <td className="whitespace-nowrap">
                        <span className={`print-badge print-badge-${getShipmentTone(log.status)}`}>{log.label}</span>
                      </td>
                      <td>{log.location}</td>
                      <td>{log.actorName || "Sistem"}</td>
                      <td>{log.message}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                      Belum ada timeline tracking untuk AWB ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </>
      ) : (
        <section className="border-t border-slate-200 bg-white px-8 py-12 text-center text-sm text-slate-600">
          Data AWB belum tersedia untuk dicetak.
        </section>
      )}
    </PrintCenterLayout>
  );
}
