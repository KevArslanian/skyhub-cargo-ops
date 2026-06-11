"use client";

import { useEffect, useState, type RefObject } from "react";
import { resolveVisibleCount, subscribeViewportResize } from "@/lib/viewport-density";

type UseVisibleCardPageSizeOptions = {
  fallback?: number;
  min?: number;
  max?: number;
  gapPx?: number;
};

export function useVisibleCardPageSize(
  containerRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  measureKey: number,
  itemSelector: string,
  options?: UseVisibleCardPageSizeOptions,
) {
  const fallback = options?.fallback ?? 3;
  const min = options?.min ?? 1;
  const max = options?.max ?? 10;
  const gapPx = options?.gapPx ?? 12;
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