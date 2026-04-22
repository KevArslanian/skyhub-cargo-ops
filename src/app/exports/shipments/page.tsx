import Script from "next/script";
import { requireUser } from "@/lib/auth";
import { listShipments } from "@/lib/data";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ShipmentsPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ query?: string; status?: string; flight?: string; sortBy?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const data = await listShipments(user, params);

  return (
    <div className="mx-auto max-w-6xl bg-white p-8 text-black">
      <Script id="print-shipments">{`window.addEventListener("load", () => window.print(), { once: true });`}</Script>
      <h1 className="font-[family:var(--font-heading)] text-3xl font-bold">Shipment Ledger Export</h1>
      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr>
            {["AWB", "Komoditas", "Rute", "Status", "Flight", "Updated"].map((header) => (
              <th key={header} className="border-b border-slate-300 px-3 py-2 text-left">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.shipments.map((shipment) => (
            <tr key={shipment.id}>
              <td className="border-b border-slate-200 px-3 py-2">{shipment.awb}</td>
              <td className="border-b border-slate-200 px-3 py-2">{shipment.commodity}</td>
              <td className="border-b border-slate-200 px-3 py-2">{shipment.origin} → {shipment.destination}</td>
              <td className="border-b border-slate-200 px-3 py-2">{shipment.statusLabel}</td>
              <td className="border-b border-slate-200 px-3 py-2">{shipment.flightNumber || "-"}</td>
              <td className="border-b border-slate-200 px-3 py-2">{formatDateTime(shipment.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
