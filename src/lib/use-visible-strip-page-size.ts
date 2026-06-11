"use client";

import { useEffect, useState, type RefObject } from "react";
import { resolveVisibleCount, subscribeViewportResize } from "@/lib/viewport-density";

type UseVisibleStripPageSizeOptions = {
  fallback?: number;
  min?: number;
  max?: number;
  gapPx?: number;
};

/** Horizontal strip: how many cards fit in the track width. */
export function useVisibleStripPageSize(
  containerRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  measureKey: number,
  itemSelector: string,
  options?: UseVisibleStripPageSizeOptions,
) {
  const fallback = options?.fallback ?? 3;
  const min = options?.min ?? 1;
  const max = options?.max ?? 10;
  const gapPx = options?.gapPx ?? 10;
  const [pageSize, setPageSize] = useState(fallback);

  useEffect(() => {
    if (!enabled) {
      setPageSize(fallback);
      return undefined;
    }

    const container = containerRef.current;
    if (!container) return undefined;

    const measure = () => {
      const count = resolveVisibleCount(container, itemSelector, {
        axis: "horizontal",
        gapPx,
        fallback,
        min,
        max,
      });
      setPageSize(count);
    };

    return subscribeViewportResize(container, measure);
  }, [containerRef, enabled, fallback, gapPx, itemSelector, max, measureKey, min]);

  return pageSize;
}