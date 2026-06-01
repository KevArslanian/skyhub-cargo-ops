import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Export Shipment",
  description: "Cetak dan export data shipment SkyHub.",
};

export default function ExportShipmentsLayout({ children }: { children: ReactNode }) {
  return children;
}
