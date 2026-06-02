import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Cetak Catatan Aktivitas",
  description: "Penampil cetak audit aktivitas SkyHub.",
};

export default function ExportActivityLogLayout({ children }: { children: ReactNode }) {
  return children;
}
