import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Pusat Peringatan",
  description: "Pusat pengecualian, batas tindak lanjut, risiko batas terima, dan eskalasi operasional.",
};

export default function AlertsLayout({ children }: { children: ReactNode }) {
  return children;
}
