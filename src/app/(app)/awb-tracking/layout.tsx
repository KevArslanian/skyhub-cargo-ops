import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Pelacakan AWB",
  description: "Halaman tracking Airway Bill dengan timeline status shipment.",
};

export default function AwbTrackingLayout({ children }: { children: ReactNode }) {
  return children;
}
