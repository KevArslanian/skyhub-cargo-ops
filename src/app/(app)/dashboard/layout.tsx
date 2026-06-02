import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Pusat Kendali",
  description: "Pusat kendali operasional pengiriman, penerbangan, peringatan, dan aktivitas SkyHub.",
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return children;
}
