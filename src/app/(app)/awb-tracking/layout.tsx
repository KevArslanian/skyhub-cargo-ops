import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Pelacakan AWB",
  description: "Halaman pelacakan Airway Bill dengan linimasa status pengiriman.",
};

export default function AwbTrackingLayout({ children }: { children: ReactNode }) {
  return children;
}
