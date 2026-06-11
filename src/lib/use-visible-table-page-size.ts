"use client";

import { useEffect, useState, type RefObject } from "react";
import { subscribeViewportResize } from "@/lib/viewport-density";

type UseVisibleTablePageSizeOptions = {
  fallback?: number;
  min?: number;
  max?: number;
  footerPx?: number;
  chromePx?: number;
  measureContainerRef?: RefObject<HTMLElement | null>;
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

function getRowMetrics(table: HTMLTableElement | null) {
  const thead = table?.querySelector("thead");
  const sampleRow = table?.querySelector("tbody tr");
  const headHeight = thead?.getBoundingClientRect().height ?? 0;
  const rowHeight = sampleRow?.getBoundingClientRect().height ?? 0;
  return { headHeight, rowHeight };
}

function estimateRowsFromHeight(
  containerHeight: number,
  table: HTMLTableElement | null,
  footerPx = 0,
  chromePx = 0,
) {
  const { headHeight, rowHeight } = getRowMetrics(table);
  const available = containerHeight - headHeight - footerPx - chromePx;

  if (available <= 0 || rowHeight <= 0) return 0;
  return Math.floor(available / rowHeight);
}

function estimateRowsFromViewport(
  table: HTMLTableElement | null,
  footerPx = 0,
  chromePx = 0,
) {
  if (typeof window === "undefined") return 0;

  const { headHeight, rowHeight } = getRowMetrics(table);
  const available = window.innerHeight - headHeight - footerPx - chromePx;

  if (available <= 0 || rowHeight <= 0) return 0;
  return Math.floor(available / rowHeight);
}

function estimateRowsFromPanelLayout(
  panel: HTMLElement,
  scrollContainer: HTMLElement,
  table: HTMLTableElement | null,
  footerPx = 0,
) {
  const { headHeight, rowHeight } = getRowMetrics(table);
  if (rowHeight <= 0) return 0;

  const panelTop = panel.getBoundingClientRect().top;
  const scrollTop = scrollContainer.getBoundingClientRect().top;
  const chromeAboveTable = Math.max(0, scrollTop - panelTop);
  const available = panel.clientHeight - chromeAboveTable - headHeight - footerPx;

  if (available <= 0) return 0;
  return Math.floor(available / rowHeight);
}

function scrollContainerIsStretched(scrollContainer: HTMLElement, table: HTMLTableElement | null) {
  const { headHeight } = getRowMetrics(table);
  const tbody = table?.querySelector("tbody");
  const bodyHeight = tbody?.getBoundingClientRect().height ?? 0;
  const contentHeight = headHeight + bodyHeight;
  return scrollContainer.clientHeight > contentHeight + 12;
}

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
  const footerPx = options?.footerPx ?? 0;
  const chromePx = options?.chromePx ?? 0;
  const measureContainerRef = options?.measureContainerRef;
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
      const measureContainer = measureContainerRef?.current ?? container;
      const containerHeight = Math.max(measureContainer.clientHeight, container.clientHeight);
      const panelRows =
        measureContainerRef?.current && container !== measureContainerRef.current
          ? estimateRowsFromPanelLayout(measureContainerRef.current, container, table, footerPx)
          : 0;
      const estimatedRows = estimateRowsFromHeight(containerHeight, table, footerPx, chromePx);
      const viewportRows = estimateRowsFromViewport(table, footerPx, chromePx);
      const visibleRows =
        table && scrollContainerIsStretched(container, table)
          ? countRowsFullyVisible(container, table)
          : 0;
      const raw = Math.max(panelRows, estimatedRows, viewportRows, visibleRows);
      const rows = raw > 0 ? Math.max(min, Math.min(max, raw)) : fallback;
      setPageSize(rows);
    };

    const targets = [tableRef.current, measureContainerRef?.current ?? null];
    return subscribeViewportResize(container, measure, targets);
  }, [
    chromePx,
    containerRef,
    enabled,
    fallback,
    footerPx,
    max,
    measureContainerRef,
    measureKey,
    min,
    tableRef,
  ]);

  return pageSize;
}