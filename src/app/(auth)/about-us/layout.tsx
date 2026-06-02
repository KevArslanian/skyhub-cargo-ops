import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Tentang Kami",
  description: "Profil SkyHub Cargo Ops, kapabilitas platform, dan akses masuk operasional.",
};

export default function AboutUsLayout({ children }: { children: ReactNode }) {
  return children;
}
