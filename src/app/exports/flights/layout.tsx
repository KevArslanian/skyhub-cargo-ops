import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Cetak Manifest Penerbangan",
  description: "Penampil cetak data penerbangan SkyHub.",
};

export default function ExportFlightsLayout({ children }: { children: ReactNode }) {
  return children;
}
