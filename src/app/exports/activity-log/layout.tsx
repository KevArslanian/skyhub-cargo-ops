import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Export Log Aktivitas",
  description: "Cetak dan export audit aktivitas SkyHub.",
};

export default function ExportActivityLogLayout({ children }: { children: ReactNode }) {
  return children;
}
