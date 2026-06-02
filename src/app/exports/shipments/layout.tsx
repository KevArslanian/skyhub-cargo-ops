import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Cetak Buku Pengiriman",
  description: "Penampil cetak data pengiriman SkyHub.",
};

export default function ExportShipmentsLayout({ children }: { children: ReactNode }) {
  return children;
}
