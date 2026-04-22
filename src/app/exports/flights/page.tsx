import { requireUser } from "@/lib/auth";
import { requireInternalUser } from "@/lib/access";
import { getFlightBoardData } from "@/lib/data";
import { formatDateTime } from "@/lib/format";
import { buildPrintDocumentCode, type PrintChipTone } from "@deltaoga/skyhub-print-center";
import { PrintCenterLayout } from "@deltaoga/skyhub-print-center/layout";

export const dynamic = "force-dynamic";

function getFlightTone(status: string): PrintChipTone {
  if (status === "on_time") return "success";
  if (status === "delayed") return "warning";
  if (status === "departed") return "info";
  return "neutral";
}

export default async function FlightsPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; query?: string; date?: string }>;
}) {
  const user = await requireUser();
  requireInternalUser(user);
  const params = await searchParams;
  const printedAt = new Date();

  const board = await getFlightBoardData(user, {
    status: params.status || undefined,
    query: params.query || undefined,
  });

  const dateFilter = params.date?.trim() || "";
  const flights = dateFilter
    ? board.flights.filter((flight) => flight.departureTime.slice(0, 10) === dateFilter)
    : board.flights;

  const onTimeCount = flights.filter((flight) => flight.status === "on_time").length;
  const delayedCount = flights.filter((flight) => flight.status === "delayed").length;
  const departedCount = flights.filter((flight) => flight.status === "departed").length;

  const filterSummary = [
    params.query ? `Query: ${params.query}` : null,
    params.status ? `Status: ${params.status}` : null,
    dateFilter ? `Tanggal: ${dateFilter}` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  return (
    <PrintCenterLayout
      scriptId="print-flights"
      documentTitle="Manifest Flight"
      documentSubtitle="Laporan Flight Operasional"
      printedAtLabel={formatDateTime(printedAt.toISOString())}
      filterSummary={filterSummary}
      summaryTitle={`Ringkasan • ${flights.length} flight`}
      summarySubtitle="Distribusi status flight berdasarkan filter aktif."
      summaryChips={[
        { label: `${onTimeCount} ON TIME`, tone: "success" },
        { label: `${delayedCount} DELAYED`, tone: "warning" },
        { label: `${departedCount} DEPARTED`, tone: "info" },
      ]}
      documentCode={buildPrintDocumentCode("FLIGHTS", printedAt)}
    >
      <section className="print-table-wrap">
        <table className="print-table min-w-[1220px]">
          <thead>
            <tr>
              {["Flight", "Rute", "Cutoff", "Berangkat", "Tiba", "Gate", "Status", "Shipment"].map((header) => (
                <th key={header}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {flights.length ? (
              flights.map((flight) => (
                <tr key={flight.id}>
                  <td className="whitespace-nowrap font-mono text-xs font-semibold text-[#1d4ed8]">{flight.flightNumber}</td>
                  <td className="whitespace-nowrap">{flight.route}</td>
                  <td className="whitespace-nowrap">{formatDateTime(flight.cargoCutoffTime)}</td>
                  <td className="whitespace-nowrap">{formatDateTime(flight.departureTime)}</td>
                  <td className="whitespace-nowrap">{formatDateTime(flight.arrivalTime)}</td>
                  <td className="whitespace-nowrap">{flight.gate || "-"}</td>
                  <td>
                    <span className={`print-badge print-badge-${getFlightTone(flight.status)}`}>{flight.statusLabel}</span>
                  </td>
                  <td className="whitespace-nowrap">{flight.shipments.length}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-500">
                  Tidak ada data flight untuk filter ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </PrintCenterLayout>
  );
}
