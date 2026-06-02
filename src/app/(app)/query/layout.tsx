import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Pemeriksaan Database",
  description: "Diagnostik koneksi basis data, tabel, relasi, dan distribusi data.",
};

export default function QueryLayout({ children }: { children: ReactNode }) {
  return children;
}
