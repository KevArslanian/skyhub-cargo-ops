"use client";

import { useEffect, useState, type RefObject } from "react";
import { resolveVisibleCount, subscribeViewportResize } from "@/lib/viewport-density";

type UseVisiblePanelPageSizeOptions = {
  fallback?: number;
  min?: number;
  max?: number;
  gapPx?: number;
};

/** Vertical panel list (non-table): how many items fit in scroll shell height. */
export function useVisiblePanelPageSize(
  containerRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  measureKey: number,
  itemSelector: string,
  options?: UseVisiblePanelPageSizeOptions,
) {
  const fallback = options?.fallback ?? 2;
  const min = options?.min ?? 1;
  const max = options?.max ?? 8;
  const gapPx = options?.gapPx ?? 8;
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
        axis: "vertical",
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