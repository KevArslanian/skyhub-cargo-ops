import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Login",
  description: "Halaman login role internal untuk admin dan staff operasional SkyHub.",
};

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children;
}
