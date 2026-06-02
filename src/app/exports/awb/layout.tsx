import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Cetak AWB",
  description: "Penampil cetak ringkasan Airway Bill dan linimasa pengiriman.",
};

export default function ExportAwbLayout({ children }: { children: ReactNode }) {
  return children;
}
