import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ABOUT_SCRUB_POSTER, ABOUT_SCRUB_WEBM_LITE } from "@/lib/about-media-constants";

export const metadata: Metadata = {
  title: "Portal Resmi Kargo Udara",
  description: "Portal publik SkyHub: cek resi AWB tanpa login dan akses masuk operator ke Pusat Kendali bandara.",
};

export default function AboutUsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <link rel="preload" as="image" href={ABOUT_SCRUB_POSTER} />
      <link rel="prefetch" as="video" href={ABOUT_SCRUB_WEBM_LITE} />
      {children}
    </>
  );
}