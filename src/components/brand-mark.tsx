"use client";

import { APP_NAME, APP_SUBTITLE } from "@/lib/constants";
import { cn } from "@/lib/format";
import { SkyHubLogo } from "./skyhub-logo";

type BrandMarkProps = {
  iconOnly?: boolean;
  title?: string;
  subtitle?: string;
  className?: string;
  tileClassName?: string;
  markClassName?: string;
  titleClassName?: string;
  subtitleClassName?: string;
};

export function BrandMark({
  iconOnly = false,
  title = APP_NAME,
  subtitle = APP_SUBTITLE,
  className,
  tileClassName,
  markClassName,
  titleClassName,
  subtitleClassName,
}: BrandMarkProps) {
  return (
    <div className={cn("flex min-w-0 items-center", iconOnly ? "justify-center" : "gap-3", className)}>
      <div
        className={cn(
          "flex h-16 w-16 shrink-0 items-center justify-center",
          tileClassName,
        )}
      >
        <SkyHubLogo className={cn("brandmark-logo h-full w-full", markClassName)} />
      </div>

      {!iconOnly ? (
        <div className="min-w-0">
          <p
            className={cn(
              "truncate font-[family:var(--font-heading)] text-[1.15rem] font-black tracking-[-0.03em] text-[color:var(--text-strong)]",
              titleClassName,
            )}
          >
            {title}
          </p>
          <p className={cn("mt-1 truncate text-xs text-[color:var(--muted-fg)]", subtitleClassName)}>{subtitle}</p>
        </div>
      ) : null}
    </div>
  );
}
