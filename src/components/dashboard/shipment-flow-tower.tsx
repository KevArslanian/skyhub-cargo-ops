import type { ShipmentFlowStage } from "@/lib/dashboard-types";

const LANE_TONES = [
  "dashboard-flow-primary",
  "dashboard-flow-info",
  "dashboard-flow-warning",
  "dashboard-flow-info",
  "dashboard-flow-success",
  "dashboard-flow-warning",
] as const;

const PIPELINE_TONES = [
  "dashboard-flow-primary",
  "dashboard-flow-info",
  "dashboard-flow-warning",
  "dashboard-flow-info",
  "dashboard-flow-success",
  "dashboard-flow-neutral",
] as const;

function bottleneckStage(stages: ShipmentFlowStage[]) {
  if (!stages.length) return null;
  return stages.reduce((top, stage) => (stage.count > top.count ? stage : top), stages[0]);
}

/** Alur pengiriman tower — mengisi tinggi panel kiri tanpa strip horizontal */
export function ShipmentFlowTower({
  stages,
  inFlowCount,
  totalCount,
}: {
  stages: ShipmentFlowStage[];
  inFlowCount: number;
  totalCount: number;
}) {
  const maxCount = Math.max(...stages.map((stage) => stage.count), 1);
  const peak = bottleneckStage(stages);

  return (
    <div className="dashboard-flow-tower min-h-0 flex-1">
      <div className="dashboard-flow-chart min-h-0 flex-1">
        <div className="dashboard-flow-focus">
          <span>Dalam alur</span>
          <strong className="tabular-nums">{inFlowCount}</strong>
          <small>
            dari <strong className="text-[color:var(--text-strong)]">{totalCount}</strong> manifest hari ini
          </small>
        </div>

        <ol className="dashboard-flow-lanes" aria-label="Tahapan alur pengiriman">
          {stages.map((stage, index) => (
            <li
              key={stage.id}
              className="dashboard-flow-lane"
              title={`${stage.hint}: ${stage.count} AWB (${stage.percent}%)`}
            >
              <div className="dashboard-flow-lane-header">
                <span>{stage.label}</span>
                <strong className="tabular-nums">{stage.count}</strong>
              </div>
              <div className="dashboard-flow-stack" aria-hidden="true">
                <div
                  className={`dashboard-flow-segment ${LANE_TONES[index % LANE_TONES.length]}`}
                  style={{ width: `${Math.max(stage.count > 0 ? 10 : 0, (stage.count / maxCount) * 100)}%` }}
                />
              </div>
              <p>
                {stage.count} AWB · {stage.percent}%
              </p>
            </li>
          ))}
        </ol>
      </div>

      <div className="dashboard-flow-tower-pipeline shrink-0">
        <div className="dashboard-flow-stack dashboard-flow-tower-pipeline-bar" aria-hidden="true">
          {stages.map((stage, index) =>
            stage.count > 0 ? (
              <div
                key={`pipe-${stage.id}`}
                className={`dashboard-flow-segment ${PIPELINE_TONES[index % PIPELINE_TONES.length]}`}
                style={{ width: `${(stage.count / maxCount) * 100}%` }}
                title={`${stage.label}: ${stage.count}`}
              />
            ) : null,
          )}
        </div>
        <p className="dashboard-flow-tower-pipeline-note">
          {peak && peak.count > 0 ? (
            <>
              Titik padat: <strong>{peak.label}</strong> ({peak.count} AWB)
            </>
          ) : (
            "Belum ada manifest aktif dalam alur."
          )}
        </p>
      </div>
    </div>
  );
}