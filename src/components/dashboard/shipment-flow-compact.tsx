import type { ShipmentFlowStage } from "@/lib/dashboard-types";

const PRIMARY_STAGE_LABELS = ["Diterima", "Sortasi", "Muat"];

/** Alur ringkas — 3 bar horizontal seperti referensi dashboard */
export function ShipmentFlowCompact({
  stages,
  inFlowCount,
  totalCount,
}: {
  stages: ShipmentFlowStage[];
  inFlowCount: number;
  totalCount: number;
}) {
  const primaryStages = stages.filter((stage) => PRIMARY_STAGE_LABELS.includes(stage.label));
  const visibleStages = primaryStages.length ? primaryStages : stages.slice(0, 3);
  const maxCount = Math.max(...visibleStages.map((stage) => stage.count), 1);

  return (
    <div className="dashboard-flow-compact-panel flex min-h-0 flex-1 flex-col justify-between gap-3">
      <p className="dashboard-flow-meta shrink-0 text-[12px] text-[color:var(--muted-fg)]">
        <strong className="text-[color:var(--text-strong)]">{inFlowCount}</strong> /{" "}
        <strong className="text-[color:var(--text-strong)]">{totalCount}</strong> manifest dalam alur
      </p>

      <ol className="dashboard-flow-compact-bars flex min-h-0 flex-1 flex-col justify-center gap-3">
        {visibleStages.map((stage) => (
          <li key={stage.id} className="dashboard-flow-compact-bar-row" title={`${stage.hint}: ${stage.count} AWB`}>
            <div className="dashboard-flow-compact-bar-head">
              <span className="dashboard-flow-compact-bar-label">{stage.label}</span>
              <span className="dashboard-flow-compact-bar-meta tabular-nums">
                {stage.count} AWB · {stage.percent}%
              </span>
            </div>
            <div className="dashboard-flow-bar" aria-hidden="true">
              <div
                className="dashboard-flow-bar-fill"
                style={{ width: `${Math.max(stage.count > 0 ? 8 : 0, (stage.count / maxCount) * 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}