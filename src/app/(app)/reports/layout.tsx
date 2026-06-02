import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Laporan",
  description: "Ringkasan laporan dan ekspor data operasional SkyHub.",
};

export default function ReportsLayout({ children }: { children: ReactNode }) {
  return children;
}
