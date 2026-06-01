import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Seed Data",
  description: "Utilitas seed dan pengecekan data awal SkyHub.",
};

export default function SeedLayout({ children }: { children: ReactNode }) {
  return children;
}
