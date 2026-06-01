import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Query Database",
  description: "Diagnostik koneksi database, tabel, relasi, dan distribusi data.",
};

export default function QueryLayout({ children }: { children: ReactNode }) {
  return children;
}
