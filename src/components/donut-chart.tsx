"use client";

import { cn } from "@/lib/format";

export type DonutSegment = {
  label: string;
  value: number;
  color: string;
};

type DonutChartProps = {
  segments: DonutSegment[];
  total: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
};

export function DonutChart({ segments, total, size = 88, strokeWidth = 9, className }: DonutChartProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  let cumulativeOffset = 0;

  // Filter out zero-value segments and calculate their dash arrays
  const visibleSegments = segments.filter((s) => s.value > 0);
  const gapAngle = visibleSegments.length > 1 ? 2 : 0; // small 2° gap between segments
  const gapDash = (gapAngle / 360) * circumference;

  const totalUsable = circumference - gapDash * visibleSegments.length;
  const totalForCalc = total || visibleSegments.reduce((sum, s) => sum + s.value, 0);

  return (
    <div className={cn("relative inline-flex shrink-0 flex-col items-center", className)}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-label={`Donut chart: ${segments.map((s) => `${s.label} ${s.value}`).join(", ")}`}
      >
        {/* Background track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-[color:var(--panel-muted)]"
        />
        {/* Segments */}
        {visibleSegments.map((segment, i) => {
          const segmentLength = (segment.value / totalForCalc) * totalUsable;
          const offset = circumference - cumulativeOffset;
          cumulativeOffset += segmentLength + gapDash;

          return (
            <circle
              key={segment.label}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
              strokeDashoffset={offset}
              className="transition-[stroke-dasharray,stroke-dashoffset] duration-700 ease-out"
            />
          );
        })}
        {/* Center text */}
        <text
          x={center}
          y={center}
          textAnchor="middle"
          dominantBaseline="central"
          className="rotate-90 fill-[color:var(--text-strong)] font-[family:var(--font-heading)] text-[22px] font-black tracking-[-0.04em]"
        >
          {totalForCalc}
        </text>
      </svg>
    </div>
  );
}

type MiniDonutGroupProps = {
  charts: {
    title: string;
    total: number;
    segments: DonutSegment[];
    note?: string;
  }[];
  className?: string;
};

export function MiniDonutGroup({ charts, className }: MiniDonutGroupProps) {
  return (
    <div className={cn("flex flex-wrap items-start justify-center gap-6 xl:gap-8", className)}>
      {charts.map((chart) => (
        <div key={chart.title} className="flex items-center gap-4">
          <DonutChart segments={chart.segments} total={chart.total} size={80} strokeWidth={8} />
          <div className="min-w-0 max-w-[140px]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted-2)]">
              {chart.title}
            </p>
            <div className="mt-2 space-y-1.5">
              {chart.segments.map((seg) => (
                <div key={seg.label} className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: seg.color }}
                  />
                  <span className="truncate text-xs font-semibold text-[color:var(--text-strong)]">
                    {seg.value}
                  </span>
                  <span className="truncate text-[11px] text-[color:var(--muted-fg)]">{seg.label}</span>
                </div>
              ))}
            </div>
            {chart.note ? (
              <p className="mt-1.5 text-[10px] leading-4 text-[color:var(--muted-2)]">{chart.note}</p>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
