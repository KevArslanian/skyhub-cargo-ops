import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Export Flight",
  description: "Cetak dan export data flight SkyHub.",
};

export default function ExportFlightsLayout({ children }: { children: ReactNode }) {
  return children;
}
