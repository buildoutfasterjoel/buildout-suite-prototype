import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Card, CardBody } from "@buildoutinc/blueprint-react/ui/Card";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRight } from "@fortawesome/pro-regular-svg-icons";
import type { TaskView } from "#/data/types";
import { useDataStore } from "#/data/dataStore";
import { listAllTasks } from "#/data/selectors";
import { setTaskCompleted, updateDealTask } from "#/data/actions";
import { useAddTask } from "#/data/useAddTask";
import { todayISO } from "#/components/contacts/contactDisplay";
import { TaskListRow } from "#/components/tasks/TaskListRow";
import { dueBucket } from "#/components/tasks/taskFilterModel";

/** Nulls-last ascending by due date. */
function byDue(a: TaskView, b: TaskView): number {
  if (!a.dueDate && !b.dueDate) return 0;
  if (!a.dueDate) return 1;
  if (!b.dueDate) return -1;
  return a.dueDate.localeCompare(b.dueDate);
}

const MAX_ROWS = 6;

/**
 * "What's due right now" card on the Suite home: the open tasks that are
 * overdue or due today, pulled live from the store and rendered with the same
 * task tile as the Tasks page and Contact Details.
 */
export function DashboardTasksSection() {
  // Re-render on any task/deal mutation.
  const tasksMap = useDataStore((s) => s.tasks);
  const listingsMap = useDataStore((s) => s.listings);
  const all = useMemo(() => listAllTasks(), [tasksMap, listingsMap]);
  const today = todayISO();

  const dueNow = useMemo(
    () =>
      all
        .filter((t) => {
          if (t.completed) return false;
          const bucket = dueBucket(t.dueDate, today);
          return bucket === "overdue" || bucket === "today";
        })
        .sort(byDue),
    [all, today],
  );
  const shown = dueNow.slice(0, MAX_ROWS);

  const toggleComplete = (t: TaskView) => {
    if (t.kind === "deal" && t.dealId) {
      updateDealTask(t.dealId, t.id, {
        status: t.completed ? "open" : "complete",
      });
    } else {
      setTaskCompleted(t.id, !t.completed);
    }
  };
  const openTask = (t: TaskView) => {
    if (t.kind === "deal" && t.dealId) {
      useAddTask.getState().openEditDeal(t.dealId, t.id);
    } else {
      useAddTask.getState().openEdit(t.id);
    }
  };

  return (
    <Card className="panel-card">
      <Card.Header className="d-flex align-items-center gap-2">
        <Card.Title className="fs-large">Tasks</Card.Title>
        <Badge variant="secondary" appearance="muted" className="fs-xs">
          {dueNow.length}
        </Badge>
        <Button
          variant="ghost"
          className="ms-auto"
          nativeButton={false}
          render={<Link to="/tasks" />}
        >
          See full Tasks page
          <FontAwesomeIcon icon={faArrowRight} />
        </Button>
      </Card.Header>

      <CardBody className="py-2">
        {shown.length === 0 ? (
          <p className="text-muted my-3 text-center">
            Nothing due today — you're all caught up.
          </p>
        ) : (
          shown.map((task) => (
            <TaskListRow
              key={task.id}
              task={task}
              onToggle={() => toggleComplete(task)}
              onOpen={() => openTask(task)}
            />
          ))
        )}
      </CardBody>
    </Card>
  );
}
