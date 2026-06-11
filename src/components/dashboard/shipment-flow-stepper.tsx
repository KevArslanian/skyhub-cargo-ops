import type { ShipmentFlowStage } from "@/lib/dashboard-types";

/** Alur pengiriman — horizontal di desktop, vertikal di mobile */
export function ShipmentFlowStepper({
  stages,
  inFlowCount,
  totalCount,
}: {
  stages: ShipmentFlowStage[];
  inFlowCount: number;
  totalCount: number;
}) {
  const maxCount = Math.max(...stages.map((s) => s.count), 1);

  return (
    <div className="dashboard-flow-stepper dashboard-flow-stepper--legacy min-h-0">
      <p className="dashboard-flow-meta mb-3 text-[12px] text-[color:var(--muted-fg)]">
        <strong className="text-[color:var(--text-strong)]">{inFlowCount}</strong> /{" "}
        <strong className="text-[color:var(--text-strong)]">{totalCount}</strong> manifest dalam alur
      </p>
      <ol className="dashboard-flow-track">
        {stages.map((stage, index) => (
          <li key={stage.id} className="dashboard-flow-stage" title={`${stage.hint}: ${stage.count} AWB (${stage.percent}%)`}>
            <div className="dashboard-flow-stage-head">
              <span className="dashboard-flow-stage-index" aria-hidden="true">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="dashboard-flow-stage-label">{stage.label}</p>
                <p className="dashboard-flow-stage-sub">
                  {stage.count} AWB · {stage.percent}%
                </p>
              </div>
              <strong className="dashboard-flow-stage-count tabular-nums">{stage.count}</strong>
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