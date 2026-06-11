import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Buku Pengiriman",
  description: "Kelola pengiriman, manifest aktif, dokumen, status, dan tarif pengiriman.",
};

export default function ShipmentLedgerLayout({ children }: { children: ReactNode }) {
  return children;
}
