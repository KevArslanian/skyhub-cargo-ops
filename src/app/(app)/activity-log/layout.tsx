import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Catatan Aktivitas",
  description: "Audit aktivitas pengguna, perubahan data, dan kejadian operasional.",
};

export default function ActivityLogLayout({ children }: { children: ReactNode }) {
  return children;
}
