"use client";

import { useCallback, useId, useRef, useState } from "react";
import { formatDashboardIdr } from "@/lib/dashboard-view-model";
import type { RevenueBucket } from "@/lib/dashboard-types";

const CHART_COLOR = "hsl(142, 72%, 35%)";
const GRID_COLOR = "rgba(148, 163, 184, 0.15)";

export function RevenueAreaChart({ buckets, compact = false }: { buckets: RevenueBucket[]; compact?: boolean }) {
  const width = 480;
  const height = compact ? 148 : 220;
  const padding = compact
    ? { top: 10, right: 12, bottom: 24, left: 48 }
    : { top: 16, right: 16, bottom: 32, left: 56 };
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const gradientId = useId();

  const maxValue = Math.max(...buckets.map((b) => b.value), 1);
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const stepX = buckets.length > 1 ? plotWidth / (buckets.length - 1) : 0;

  const points = buckets.map((item, index) => {
    const x = padding.left + index * stepX;
    const y = padding.top + plotHeight - (item.value / maxValue) * plotHeight;
    return { ...item, x, y, index };
  });

  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");
  const area = points.length
    ? `${padding.left},${height - padding.bottom} ${polyline} ${width - padding.right},${height - padding.bottom}`
    : "";

  const yTicks = [0, 0.33, 0.66, 1].map((ratio) => ({
    ratio,
    value: Math.round(maxValue * ratio),
    y: padding.top + plotHeight - ratio * plotHeight,
  }));

  const activeIndex =
    hoveredIndex ??
    (points.some((p) => p.value > 0) ? points.reduce((best, p) => (p.value > best.value ? p : best), points[0]).index : null);
  const activePoint = activeIndex === null ? null : points[activeIndex];

  const resolveIndex = useCallback(
    (clientX: number) => {
      const node = chartRef.current;
      if (!node || buckets.length === 0) return null;
      const rect = node.getBoundingClientRect();
      const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
      const xInViewBox = padding.left + ratio * plotWidth;
      let nearest = 0;
      let nearestDistance = Number.POSITIVE_INFINITY;
      for (const point of points) {
        const distance = Math.abs(point.x - xInViewBox);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = point.index;
        }
      }
      return nearest;
    },
    [buckets.length, plotWidth, points, padding.left],
  );

  const handlePointer = useCallback(
    (clientX: number) => setHoveredIndex(resolveIndex(clientX)),
    [resolveIndex],
  );

  return (
    <div className="dashboard-revenue-chart flex min-h-0 flex-1 flex-col">
      <div
        ref={chartRef}
        className="dashboard-revenue-chart-plot relative min-h-0 min-w-0 flex-1"
        onMouseLeave={() => setHoveredIndex(null)}
        onMouseMove={(e) => handlePointer(e.clientX)}
        onTouchStart={(e) => {
          const t = e.touches[0];
          if (t) handlePointer(t.clientX);
        }}
        onTouchMove={(e) => {
          const t = e.touches[0];
          if (t) handlePointer(t.clientX);
        }}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          className="dashboard-revenue-chart-svg h-full min-h-[min(180px,28vh)] w-full flex-1"
          role="img"
          aria-label="Grafik pendapatan harian per blok jam"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLOR} stopOpacity="0.22" />
              <stop offset="100%" stopColor={CHART_COLOR} stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {yTicks.map((tick) => (
            <g key={tick.ratio}>
              <line x1={padding.left} x2={width - padding.right} y1={tick.y} y2={tick.y} stroke={GRID_COLOR} strokeWidth="1" />
              <text x={padding.left - 8} y={tick.y + 4} textAnchor="end" className="fill-[color:var(--muted-fg)]" fontSize="10" fontWeight="600">
                {tick.value > 0 ? formatDashboardIdr(tick.value, true) : "0"}
              </text>
            </g>
          ))}

          <line
            x1={padding.left}
            y1={height - padding.bottom}
            x2={width - padding.right}
            y2={height - padding.bottom}
            stroke="rgba(148,163,184,0.35)"
            strokeWidth="1.5"
          />

          {area ? <polygon points={area} fill={`url(#${gradientId})`} /> : null}
          <polyline points={polyline} fill="none" stroke={CHART_COLOR} strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" />

          {activePoint ? (
            <line
              x1={activePoint.x}
              x2={activePoint.x}
              y1={padding.top}
              y2={height - padding.bottom}
              stroke={CHART_COLOR}
              strokeOpacity="0.3"
              strokeDasharray="4 4"
            />
          ) : null}

          {points.map((point) => (
            <circle
              key={point.id}
              cx={point.x}
              cy={point.y}
              r={point.index === activeIndex ? 5.5 : 3.5}
              fill={CHART_COLOR}
              stroke={point.index === activeIndex ? "white" : "none"}
              strokeWidth={2}
            />
          ))}

          {buckets.map((bucket, index) => (
            <text
              key={bucket.id}
              x={padding.left + index * stepX}
              y={height - 10}
              textAnchor="middle"
              className="fill-[color:var(--muted-fg)]"
              fontSize="10"
              fontWeight="700"
            >
              {bucket.label}
            </text>
          ))}
        </svg>
      </div>

      {activePoint ? (
        <div className="dashboard-revenue-chart-tooltip mt-2 shrink-0 rounded-[10px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)]/60 px-3 py-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-[11px]">
            <p className="font-bold text-[color:var(--text-strong)]">Jam {activePoint.label}</p>
            <p className="font-extrabold tabular-nums" style={{ color: CHART_COLOR }}>
              {formatDashboardIdr(activePoint.value)}
            </p>
          </div>
          <p className="mt-0.5 text-[10px] text-[color:var(--muted-fg)]">
            {activePoint.awbCount} AWB · rata-rata {activePoint.awbCount > 0 ? formatDashboardIdr(activePoint.avgPerAwb) : "—"} / AWB
          </p>
        </div>
      ) : (
        <p className="dashboard-revenue-chart-hint mt-2 shrink-0 text-center text-[10px] text-[color:var(--muted-fg)]">
          Arahkan kursor ke grafik untuk detail per blok jam
        </p>
      )}
    </div>
  );
}