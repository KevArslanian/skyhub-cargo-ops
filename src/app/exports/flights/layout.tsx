import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Cetak Manajemen Pesawat",
  description: "Penampil cetak jadwal dan assignment pesawat SkyHub.",
};

export default function ExportFlightsLayout({ children }: { children: ReactNode }) {
  return children;
}
