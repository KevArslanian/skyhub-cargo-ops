import { requireUser } from "@/lib/auth";
import { canExportReports, requireInternalUser } from "@/lib/access";
import { redirect } from "next/navigation";
import { getFlightBoardData } from "@/lib/data";
import { formatDateTime } from "@/lib/format";
import { AutoPrintReport } from "@/components/auto-print-report";
import { PrintCenterLayout } from "@/components/print-center-layout";
import { buildPrintDocumentCode, type PrintChipTone } from "@deltaoga/skyhub-print-center";

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
  if (!canExportReports(user)) redirect("/dashboard");
  const params = await searchParams;
  const printedAt = new Date();
  const dateFilter = params.date?.trim() || "";
  const board = await getFlightBoardData(user, {
    status: params.status || undefined,
    query: params.query || undefined,
    date: dateFilter || undefined,
    pageSize: 50,
  });
  const flights = board.flights;

  const onTimeCount = flights.filter((flight) => flight.status === "on_time").length;
  const delayedCount = flights.filter((flight) => flight.status === "delayed").length;
  const departedCount = flights.filter((flight) => flight.status === "departed").length;

  const filterSummary = [
    params.query ? `Kata kunci: ${params.query}` : null,
    params.status ? `Status: ${params.status}` : null,
    dateFilter ? `Tanggal: ${dateFilter}` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  return (
    <>
      <AutoPrintReport />
      <PrintCenterLayout
      scriptId="print-flights"
      documentTitle="Manifest Penerbangan"
      documentSubtitle="Laporan Penerbangan Operasional"
      printedAtLabel={formatDateTime(printedAt.toISOString())}
      filterSummary={filterSummary}
      summaryTitle={`Ringkasan • ${flights.length} penerbangan`}
      summarySubtitle="Distribusi status penerbangan berdasarkan filter aktif."
      summaryChips={[
        { label: `${onTimeCount} TERJADWAL`, tone: "success" },
        { label: `${delayedCount} TERLAMBAT`, tone: "warning" },
        { label: `${departedCount} BERANGKAT`, tone: "info" },
      ]}
      documentCode={buildPrintDocumentCode("FLIGHTS", printedAt)}
    >
      <section className="print-table-wrap">
        <table className="print-table min-w-[1220px]">
          <thead>
            <tr>
              {["Penerbangan", "Rute", "Batas Terima", "Berangkat", "Tiba", "Gate", "Status", "Pengiriman"].map((header) => (
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
                  Tidak ada data penerbangan untuk filter ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
      </PrintCenterLayout>
    </>
  );
}
