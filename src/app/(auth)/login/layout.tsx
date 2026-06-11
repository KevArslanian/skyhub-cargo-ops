import type { Metadata } from "next";
import type { ReactNode } from "react";
import { LoginProviders } from "./login-providers";

export const metadata: Metadata = {
  title: "Masuk",
  description: "Halaman masuk peran internal untuk administrator dan staf operasional SkyHub.",
};

export default function LoginLayout({ children }: { children: ReactNode }) {
  return <LoginProviders>{children}</LoginProviders>;
}
