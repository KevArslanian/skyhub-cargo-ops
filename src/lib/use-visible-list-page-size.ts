"use client";

import { useEffect, useState, type RefObject } from "react";
import { resolveVisibleCount, subscribeViewportResize } from "@/lib/viewport-density";

type UseVisibleListPageSizeOptions = {
  fallback?: number;
  min?: number;
  max?: number;
  gapPx?: number;
  headSelector?: string;
  footerPx?: number;
};

/** Vertical list: how many rows fit in the container height. */
export function useVisibleListPageSize(
  containerRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  measureKey: number,
  itemSelector: string,
  options?: UseVisibleListPageSizeOptions,
) {
  const fallback = options?.fallback ?? 3;
  const min = options?.min ?? 1;
  const max = options?.max ?? 8;
  const gapPx = options?.gapPx ?? 6;
  const headSelector = options?.headSelector;
  const footerPx = options?.footerPx ?? 0;
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
        headSelector,
        footerPx,
        fallback,
        min,
        max,
      });
      setPageSize(count);
    };

    return subscribeViewportResize(container, measure);
  }, [containerRef, enabled, fallback, footerPx, gapPx, headSelector, itemSelector, max, measureKey, min]);

  return pageSize;
}