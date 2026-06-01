import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Ringkasan operasional shipment, flight, alert, dan aktivitas SkyHub.",
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return children;
}
