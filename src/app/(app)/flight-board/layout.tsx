import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Manajemen Pesawat",
  description: "Manajemen pesawat, jadwal keberangkatan, kapasitas, dan assignment flight operasional.",
};

export default function FlightBoardLayout({ children }: { children: ReactNode }) {
  return children;
}
