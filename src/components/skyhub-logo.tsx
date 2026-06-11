"use client";

import Image from "next/image";
import { cn } from "@/lib/format";

type SkyHubLogoProps = {
  className?: string;
  title?: string;
};

export function SkyHubLogo({ className, title = "SkyHub" }: SkyHubLogoProps) {
  return (
    <Image
      src="/skyhub-logo-icon-clean.png"
      alt={title}
      width={96}
      height={96}
      className={cn("block h-full w-full object-contain", className)}
      priority
    />
  );
}