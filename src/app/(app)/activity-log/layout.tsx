import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Log Aktivitas",
  description: "Audit aktivitas pengguna, perubahan data, dan event operasional.",
};

export default function ActivityLogLayout({ children }: { children: ReactNode }) {
  return children;
}
