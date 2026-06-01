import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "About Us",
  description: "Profil SkyHub Cargo Ops, kapabilitas platform, dan akses login operasional.",
};

export default function AboutUsLayout({ children }: { children: ReactNode }) {
  return children;
}
