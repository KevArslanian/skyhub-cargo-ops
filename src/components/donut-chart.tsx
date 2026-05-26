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

  // Filter out zero-value segments and calculate their dash arrays
  const visibleSegments = segments.filter((s) => s.value > 0);
  const gapAngle = visibleSegments.length > 1 ? 2 : 0; // small 2° gap between segments
  const gapDash = (gapAngle / 360) * circumference;

  const totalUsable = circumference - gapDash * visibleSegments.length;
  const totalForCalc = total || visibleSegments.reduce((sum, s) => sum + s.value, 0);
  const renderedSegments = visibleSegments.reduce<Array<DonutSegment & { dashLength: number; dashOffset: number }>>(
    (acc, segment) => {
      const cumulativeOffset = acc.reduce((sum, item) => sum + item.dashLength + gapDash, 0);
      const dashLength = (segment.value / totalForCalc) * totalUsable;
      return [
        ...acc,
        {
          ...segment,
          dashLength,
          dashOffset: circumference - cumulativeOffset,
        },
      ];
    },
    [],
  );

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
        {renderedSegments.map((segment) => (
          <circle
            key={segment.label}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={segment.color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${segment.dashLength} ${circumference - segment.dashLength}`}
            strokeDashoffset={segment.dashOffset}
            className="transition-[stroke-dasharray,stroke-dashoffset] duration-700 ease-out"
          />
        ))}
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
    <div className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:h-[138px]", className)}>
      {charts.map((chart) => (
        <div key={chart.title} className="flex min-w-0 flex-col items-center gap-3 rounded-[14px] border border-[color:var(--border-soft)] bg-[color:var(--panel-muted)]/60 px-3 py-3 min-h-[138px] xl:h-[138px] xl:flex-row xl:items-center xl:gap-2 xl:px-2">
          <DonutChart segments={chart.segments} total={chart.total} size={112} strokeWidth={14} />
          <div className="min-w-0 flex-1 w-full xl:w-auto">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[color:var(--muted-2)]">
              {chart.title}
            </p>
            <div className="mt-2 space-y-1">
              {chart.segments.map((seg) => (
                <div key={seg.label} className="flex min-w-0 items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: seg.color }}
                  />
                  <span className="text-[12px] font-bold text-[color:var(--text-strong)] tabular-nums">
                    {seg.value}
                  </span>
                  <span className="break-words text-[12px] leading-[18px] text-[color:var(--muted-fg)]">{seg.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
