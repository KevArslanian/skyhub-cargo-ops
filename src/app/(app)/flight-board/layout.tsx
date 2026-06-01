import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Papan Penerbangan",
  description: "Manajemen flight, cutoff cargo, jadwal berangkat, dan manifest flight.",
};

export default function FlightBoardLayout({ children }: { children: ReactNode }) {
  return children;
}
