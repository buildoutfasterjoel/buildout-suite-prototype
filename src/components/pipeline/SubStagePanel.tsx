import { Badge } from '@buildoutinc/blueprint-react/ui/Badge'
import { Tabs } from '@buildoutinc/blueprint-react/ui/Tabs'
import { List } from '@buildoutinc/blueprint-react/ui/List'
import { Avatar } from '@buildoutinc/blueprint-react/ui/Avatar'
import { Empty, EmptyTitle, EmptyContent } from '@buildoutinc/blueprint-react/ui/Empty'
import type { PipelineStage, MockDeal } from './pipelineData'
import { formatValue } from './pipelineData'

interface SubStagePanelProps {
  stage: PipelineStage
  deals: MockDeal[]
  selectedSubStageId: string
  onSubStageSelect: (id: string) => void
  onStageClick?: () => void
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function DealList({ deals }: { deals: MockDeal[] }) {
  if (deals.length === 0) {
    return (
      <div className="py-5 text-center">
        <Empty variant="inline">
          <EmptyTitle>No deals in this stage</EmptyTitle>
          <EmptyContent>Deals will appear here as they move into this stage.</EmptyContent>
        </Empty>
      </div>
    )
  }

  return (
    <List flush>
      {deals.map((deal) => (
        <List.Item key={deal.id} asAction>
          <List.ItemContent>
            <List.ItemTitle>{deal.propertyName}</List.ItemTitle>
            <List.ItemDescription>
              <span className="me-2">{deal.address}</span>
              <Badge variant="outline" className="fs-xs">
                {deal.propertyType}
              </Badge>
            </List.ItemDescription>
          </List.ItemContent>
          <List.ItemActions>
            <div className="d-flex align-items-center gap-3">
              <Badge
                variant="secondary"
                appearance="muted"
                className="fs-xs"
                title="Days in stage"
              >
                {deal.daysInStage}d
              </Badge>
              <Avatar size="sm">
                <Avatar.Fallback>{getInitials(deal.assignedTo)}</Avatar.Fallback>
              </Avatar>
              <span
                className="fw-semibold text-end"
                style={{ minWidth: 64 }}
              >
                {formatValue(deal.askingPrice)}
              </span>
            </div>
          </List.ItemActions>
        </List.Item>
      ))}
    </List>
  )
}

export function SubStagePanel({
  stage,
  deals,
  selectedSubStageId,
  onSubStageSelect,
  onStageClick,
}: SubStagePanelProps) {
  return (
    <div className="pipeline-substage-panel border-top">
      {/* Stage header bar — clickable in overview mode */}
      <div
        className={`px-5 py-3 d-flex align-items-center gap-3 border-bottom bg-storm-grey-50${onStageClick ? ' pipeline-stage-header' : ''}`}
        style={{ cursor: onStageClick ? 'pointer' : 'default' }}
        onClick={onStageClick}
        role={onStageClick ? 'button' : undefined}
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
      </div>

      {/* Tabs + deal list */}
      <div className="px-5 pt-4 pb-1">
        <Tabs
          value={selectedSubStageId}
          onValueChange={(v) => {
            if (v !== null) onSubStageSelect(v)
          }}
        >
          <Tabs.List variant="pills">
            {stage.subStages.map((ss) => (
              <Tabs.Tab key={ss.id} value={ss.id}>
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
              </Tabs.Tab>
            ))}
          </Tabs.List>
          <Tabs.Content className="mt-3">
            {stage.subStages.map((ss) => (
              <Tabs.Panel key={ss.id} value={ss.id}>
                <DealList deals={deals.filter((d) => d.subStageId === ss.id)} />
              </Tabs.Panel>
            ))}
          </Tabs.Content>
        </Tabs>
      </div>
    </div>
  )
}
