import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Ledger Shipment",
  description: "CRUD shipment, manifest aktif, dokumen, status, dan tarif pengiriman.",
};

export default function ShipmentLedgerLayout({ children }: { children: ReactNode }) {
  return children;
}
