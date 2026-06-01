import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Alert Center",
  description: "Pusat exception, SLA, risiko cutoff, dan eskalasi operasional.",
};

export default function AlertsLayout({ children }: { children: ReactNode }) {
  return children;
}
