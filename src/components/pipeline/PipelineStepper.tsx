import { Badge } from '@buildoutinc/blueprint-react/ui/Badge'
import type { PipelineStage } from './pipelineData'
import { formatValue } from './pipelineData'

interface PipelineStepperProps {
  stages: PipelineStage[]
  selectedStageId: string | null
  onStageSelect: (stageId: string) => void
}

export function PipelineStepper({ stages, selectedStageId, onStageSelect }: PipelineStepperProps) {
  return (
    <div className="d-flex gap-2">
      {stages.map((stage) => {
        const isSelected = stage.id === selectedStageId

        return (
          <button
            key={stage.id}
            className="pipeline-stage-card flex-fill border rounded-2 p-3 text-start"
            style={{
              backgroundColor: isSelected ? '#f1f5f9' : '#fff',
              boxShadow: isSelected ? '0 0 0 1px var(--bs-primary)' : undefined,
            }}
            onClick={() => onStageSelect(stage.id)}
            aria-pressed={isSelected}
            aria-label={`${stage.label}: ${stage.dealCount} deals`}
          >
            <div className="d-flex align-items-center justify-content-between mb-2">
              <Badge variant="outline" appearance="muted" className="fs-xs">
                {stage.dealCount} deals
              </Badge>
              <span
                className="rounded-circle d-flex align-items-center justify-content-center fw-semibold text-muted"
                style={{ width: 20, height: 20, fontSize: 10, backgroundColor: '#f1f5f9' }}
              >
                {stage.number}
              </span>
            </div>
            <span className="fw-semibold d-block">
              {stage.label}
            </span>
            <span className="fs-xs text-muted d-block mt-1">
              {formatValue(stage.totalValue)}
            </span>
          </button>
        )
      })}
    </div>
  )
}
