import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Dasbor",
  description: "Ringkasan operasional pengiriman, penerbangan, peringatan, dan aktivitas SkyHub.",
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return children;
}
