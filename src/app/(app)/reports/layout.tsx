import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Reports",
  description: "Ringkasan laporan dan export data operasional SkyHub.",
};

export default function ReportsLayout({ children }: { children: ReactNode }) {
  return children;
}
