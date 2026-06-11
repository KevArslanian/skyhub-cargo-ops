"use client";

import { useEffect, useState, type RefObject } from "react";

type UseVisibleTablePageSizeOptions = {
  /** Used before the table mounts or when height cannot be measured. */
  fallback?: number;
  min?: number;
  max?: number;
};

function countRowsFullyVisible(container: HTMLElement, table: HTMLTableElement | null) {
  const rows = table?.querySelectorAll("tbody tr");
  if (!rows?.length) return 0;

  const containerBottom = container.getBoundingClientRect().bottom;
  let fitting = 0;

  for (const row of rows) {
    if (row.getBoundingClientRect().bottom <= containerBottom + 1) {
      fitting += 1;
    } else {
      break;
    }
  }

  return fitting;
}

function estimateRowsFromHeight(container: HTMLElement, table: HTMLTableElement | null) {
  const thead = table?.querySelector("thead");
  const sampleRow = table?.querySelector("tbody tr");
  const headHeight = thead?.getBoundingClientRect().height ?? 0;
  const rowHeight = sampleRow?.getBoundingClientRect().height ?? 0;
  const available = container.clientHeight - headHeight;

  if (available <= 0 || rowHeight <= 0) return 0;
  return Math.floor(available / rowHeight);
}

/**
 * Derives a page size from how many table body rows fit inside a fixed-height scroll shell.
 * Prevents clipped rows from staying in the DOM and receiving clicks.
 */
export function useVisibleTablePageSize(
  containerRef: RefObject<HTMLElement | null>,
  tableRef: RefObject<HTMLTableElement | null>,
  enabled: boolean,
  measureKey: number,
  options?: UseVisibleTablePageSizeOptions,
) {
  const fallback = options?.fallback ?? 3;
  const min = options?.min ?? 1;
  const max = options?.max ?? 12;
  const [pageSize, setPageSize] = useState(fallback);

  useEffect(() => {
    if (!enabled) {
      setPageSize(fallback);
      return undefined;
    }

    const container = containerRef.current;
    if (!container) return undefined;

    const measure = () => {
      const table = tableRef.current;
      const visibleRows = countRowsFullyVisible(container, table);
      const estimatedRows = estimateRowsFromHeight(container, table);
      const raw = visibleRows > 0 ? visibleRows : estimatedRows;
      const rows = raw > 0 ? Math.max(min, Math.min(max, raw)) : fallback;
      setPageSize(rows);
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(container);
    if (tableRef.current) {
      observer.observe(tableRef.current);
    }

    return () => observer.disconnect();
  }, [containerRef, enabled, fallback, max, min, measureKey, tableRef]);

  return pageSize;
}