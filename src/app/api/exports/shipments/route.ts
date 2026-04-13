import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { listShipments } from "@/lib/data";

function toCsv(rows: Array<Array<string | number | null>>) {
  return rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`)
        .join(","),
    )
    .join("\n");
}

export async function GET(request: Request) {
  await requireUser();
  const { searchParams } = new URL(request.url);
  const data = await listShipments({
    query: searchParams.get("query") || undefined,
    status: searchParams.get("status") || undefined,
    flight: searchParams.get("flight") || undefined,
    sortBy: searchParams.get("sortBy") || undefined,
  });

  const csv = toCsv([
    ["AWB", "Komoditas", "Rute", "Pieces", "Weight", "Status", "Flight", "Updated"],
    ...data.shipments.map((shipment) => [
      shipment.awb,
      shipment.commodity,
      `${shipment.origin} → ${shipment.destination}`,
      shipment.pieces,
      shipment.weightKg,
      shipment.statusLabel,
      shipment.flightNumber ?? "-",
      shipment.updatedAt,
    ]),
  ]);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="shipment-ledger.csv"',
    },
  });
}
