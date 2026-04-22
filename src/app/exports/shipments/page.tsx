import { requireUser } from "@/lib/auth";
import { requireInternalUser } from "@/lib/access";
import { listShipments } from "@/lib/data";
import { formatDateTime } from "@/lib/format";
import { buildPrintDocumentCode, type PrintChipTone } from "@deltaoga/skyhub-print-center";
import { PrintCenterLayout } from "@deltaoga/skyhub-print-center/layout";

export const dynamic = "force-dynamic";

function getShipmentTone(status: string): PrintChipTone {
  if (status === "hold") return "warning";
  if (status === "arrived") return "success";
  if (status === "loaded_to_aircraft" || status === "departed") return "info";
  return "neutral";
}

export default async function ShipmentsPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ query?: string; status?: string; flight?: string; sortBy?: string }>;
}) {
  const user = await requireUser();
  requireInternalUser(user);
  const params = await searchParams;
  const data = await listShipments(user, params);
  const printedAt = new Date();

  const filterSummary = [
    params.query ? `Query: ${params.query}` : null,
    params.status ? `Status: ${params.status}` : null,
    params.flight ? `Flight: ${params.flight}` : null,
    params.sortBy ? `Urut: ${params.sortBy}` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  const statusCounters = data.shipments.reduce<Map<string, number>>((map, shipment) => {
    map.set(shipment.statusLabel, (map.get(shipment.statusLabel) || 0) + 1);
    return map;
  }, new Map<string, number>());

  const distributionChips = Array.from(statusCounters.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 4)
    .map(([label, count]) => ({ label: `${count} ${label}`, tone: "neutral" as const }));

  return (
    <PrintCenterLayout
      scriptId="print-shipments"
      documentTitle="Ledger Shipment"
      documentSubtitle="Manifest Shipment Operasional"
      printedAtLabel={formatDateTime(printedAt.toISOString())}
      filterSummary={filterSummary}
      summaryTitle={`Ringkasan • ${data.shipments.length} shipment`}
      summarySubtitle="Distribusi status shipment pada filter aktif."
      summaryChips={[
        { label: `${data.shipments.length} Total`, tone: "info" },
        ...distributionChips,
      ]}
      documentCode={buildPrintDocumentCode("SHIPMENTS", printedAt)}
    >
      <section className="print-table-wrap">
        <table className="print-table min-w-[980px]">
          <thead>
            <tr>
              {["AWB", "Komoditas", "Rute", "Status", "Flight", "Update"].map((header) => (
                <th key={header}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.shipments.length ? (
              data.shipments.map((shipment) => (
                <tr key={shipment.id}>
                  <td className="whitespace-nowrap font-mono text-xs font-semibold text-[#1d4ed8]">{shipment.awb}</td>
                  <td>{shipment.commodity}</td>
                  <td className="whitespace-nowrap">{shipment.origin}{" -> "}{shipment.destination}</td>
                  <td>
                    <span className={`print-badge print-badge-${getShipmentTone(shipment.status)}`}>{shipment.statusLabel}</span>
                  </td>
                  <td className="whitespace-nowrap">{shipment.flightNumber || "-"}</td>
                  <td className="whitespace-nowrap">{formatDateTime(shipment.updatedAt)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                  Tidak ada data shipment untuk filter ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </PrintCenterLayout>
  );
}
