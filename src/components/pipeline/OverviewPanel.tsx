import { Badge } from '@buildoutinc/blueprint-react/ui/Badge'
import type { PipelineStage } from './pipelineData'
import { formatValue } from './pipelineData'

interface OverviewPanelProps {
  stages: PipelineStage[]
  onStageSelect: (stageId: string) => void
}

export function OverviewPanel({ stages, onStageSelect }: OverviewPanelProps) {
  return (
    <div className="border-top">
      {stages.map((stage) => (
        <div key={stage.id} className="border-bottom">
          {/* Stage header — same style as SubStagePanel header bar */}
          <button
            className="d-flex align-items-center gap-3 px-5 py-3 w-100 border-0 text-start bg-storm-grey-50 pipeline-overview__stage-btn"
            onClick={() => onStageSelect(stage.id)}
          >
            <div
              className="rounded-circle flex-shrink-0"
              style={{ width: 10, height: 10, backgroundColor: stage.color }}
            />
            <span className="fw-semibold">
              {stage.label}
            </span>
            <Badge variant="secondary" appearance="muted">
              {stage.dealCount} deals
            </Badge>
            <span className="ms-auto text-muted fs-small">
              {formatValue(stage.totalValue)} pipeline value
            </span>
          </button>

          {/* Sub-stages as simple labeled pills */}
          <div className="px-5 py-2 d-flex flex-wrap gap-2 pb-3">
            {stage.subStages.map((ss) => (
              <span
                key={ss.id}
                className="d-inline-flex align-items-center gap-1 px-2 py-1 rounded fs-small"
                style={{
                  backgroundColor: ss.status === 'future' ? '#f3f4f6' : `${stage.color}12`,
                  color: ss.status === 'future' ? '#9ca3af' : '#374151',
                  border: `1px solid ${ss.status === 'future' ? '#e5e7eb' : `${stage.color}28`}`,
                }}
              >
                <span
                  className="rounded-circle flex-shrink-0"
                  style={{
                    width: 5,
                    height: 5,
                    display: 'inline-block',
                    backgroundColor:
                      ss.status === 'future'
                        ? '#d1d5db'
                        : ss.status === 'active'
                          ? stage.color
                          : `${stage.color}99`,
                  }}
                />
                {ss.label}
                {ss.dealCount > 0 && (
                  <Badge
                    variant="secondary"
                    appearance="muted"
                    className="ms-1 fs-xs"
                  >
                    {ss.dealCount}
                  </Badge>
                )}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
