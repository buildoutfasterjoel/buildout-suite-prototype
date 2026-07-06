import { Card, CardBody } from "@buildoutinc/blueprint-react/ui/Card";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { List } from "@buildoutinc/blueprint-react/ui/List";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRight,
  faEllipsisVertical,
} from "@fortawesome/pro-regular-svg-icons";
import { DASHBOARD_TASKS, type DashboardTask } from "./dashboardData";

function TaskRow({ task }: { task: DashboardTask }) {
  return (
    <List.Item>
      <List.ItemContent className="d-flex flex-column gap-1 flex-fill">
        <div className="d-flex align-items-center gap-2">
          {task.urgency === "overdue" ? (
            <Badge
              variant="secondary"
              className="fs-xs border-danger text-danger bg-danger-subtle"
            >
              {task.daysOverdue}D OVERDUE
            </Badge>
          ) : (
            <Badge variant="outline" appearance="muted" className="fs-xs">
              TODAY
            </Badge>
          )}
          <Badge variant="outline" className="fs-xs">
            {task.entityType.toUpperCase()}
          </Badge>
        </div>
        <List.ItemTitle className="fw-semibold">{task.title}</List.ItemTitle>
        <List.ItemDescription>
          {task.contactName} · {task.company}
        </List.ItemDescription>
      </List.ItemContent>
      <List.ItemActions>
        <Button variant="ghost" size="icon-sm" aria-label="Task actions">
          <FontAwesomeIcon icon={faEllipsisVertical} />
        </Button>
      </List.ItemActions>
    </List.Item>
  );
}

export function DashboardTasksSection() {
  return (
    <Card className="shadow-sm">
      <Card.Header className="d-flex align-items-center gap-2">
        <Card.Title className="fs-large">Tasks</Card.Title>
        <Badge variant="secondary" appearance="muted" className="fs-xs">
          {DASHBOARD_TASKS.length}
        </Badge>
        {/* No standalone /tasks route exists yet, so this button is disabled. */}
        <Button
          variant="ghost"
          className="ms-auto"
          disabled
          title="No standalone Tasks page yet"
        >
          See full Tasks page
          <FontAwesomeIcon icon={faArrowRight} />
        </Button>
      </Card.Header>

      <CardBody className="p-0">
        <List flush>
          {DASHBOARD_TASKS.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </List>
      </CardBody>
    </Card>
  );
}
