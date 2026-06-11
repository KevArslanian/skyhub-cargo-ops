export type VideoPerfTier = "lite" | "standard" | "smooth";

/** Stable tier for SSR + first client paint — must match server and hydration. */
export const SSR_VIDEO_PERF_TIER: VideoPerfTier = "standard";

type NavigatorWithHints = Navigator & {
  connection?: { saveData?: boolean };
  deviceMemory?: number;
};

export function detectVideoPerfTier(): VideoPerfTier {
  if (typeof window === "undefined") {
    return SSR_VIDEO_PERF_TIER;
  }

  const nav = navigator as NavigatorWithHints;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const saveData = Boolean(nav.connection?.saveData);
  const mobile = window.matchMedia("(max-width: 900px)").matches;
  const cores = nav.hardwareConcurrency ?? 4;
  const memoryGb = nav.deviceMemory ?? 4;

  if (reducedMotion || saveData || mobile || cores <= 4 || memoryGb <= 4) {
    return "lite";
  }

  if (cores >= 8 && window.innerWidth >= 1024) {
    return "smooth";
  }

  return "standard";
}

export const ABOUT_SCROLL_SEGMENTS = 14;

export const ABOUT_SMOOTH_SCRUB_THROTTLE_MS = 60;