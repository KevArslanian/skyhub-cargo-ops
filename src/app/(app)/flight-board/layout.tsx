import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Papan Penerbangan",
  description: "Manajemen penerbangan, batas terima kargo, jadwal berangkat, dan manifest penerbangan.",
};

export default function FlightBoardLayout({ children }: { children: ReactNode }) {
  return children;
}
