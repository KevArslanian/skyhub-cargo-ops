import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Export AWB",
  description: "Cetak ringkasan Airway Bill dan timeline shipment.",
};

export default function ExportAwbLayout({ children }: { children: ReactNode }) {
  return children;
}
