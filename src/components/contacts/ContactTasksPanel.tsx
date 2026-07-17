import { useMemo, useRef, useState } from "react";
import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/pro-regular-svg-icons";
import type { Contact, ContactTask } from "#/data/types";
import { ContactTaskCard } from "#/components/contacts/ContactTaskCard";
import { useContactUiPrefs } from "#/components/contacts/useContactUiPrefs";

/** A task plus its resolved completion state and completion order for sorting. */
interface TaskRow {
  task: ContactTask;
  done: boolean;
  /** Sequence in which the user completed it this session; -1 if not this session. */
  seq: number;
}

/**
 * Right column of the contact detail page: the contact's open tasks, aggregated
 * across their deals, each rendered as a {@link ContactTaskCard}.
 *
 * Completing an active task moves it out of the active list into the completed
 * set (most-recently-completed first). Completed tasks live behind a toggle in a
 * bar pinned to the bottom of the card; the bar hides entirely when there are no
 * completed tasks.
 */
export function ContactTasksPanel({
  contact: _contact,
  tasks,
  completedTasks,
}: {
  contact: Contact;
  tasks: ContactTask[];
  completedTasks: ContactTask[];
}) {
  // Persists across contacts (see useContactUiPrefs).
  const showCompleted = useContactUiPrefs((s) => s.showCompletedTasks);
  const setShowCompleted = useContactUiPrefs((s) => s.setShowCompletedTasks);
  // Per-session completion overrides, keyed by task id → { done, seq }. Seq
  // orders the completed list so the most recently checked task sorts first.
  const [overrides, setOverrides] = useState<
    Record<string, { done: boolean; seq: number }>
  >({});
  const seqRef = useRef(0);

  const toggle = (task: ContactTask, baseDone: boolean) => {
    const seq = seqRef.current++;
    setOverrides((prev) => {
      const currentlyDone = prev[task.id]?.done ?? baseDone;
      return { ...prev, [task.id]: { done: !currentlyDone, seq } };
    });
  };

  // Resolve every task's current done state from its base status + overrides.
  const rows: TaskRow[] = useMemo(() => {
    const base = [
      ...tasks.map((task) => ({ task, baseDone: false })),
      ...completedTasks.map((task) => ({ task, baseDone: true })),
    ];
    return base.map(({ task, baseDone }) => {
      const o = overrides[task.id];
      return { task, done: o ? o.done : baseDone, seq: o ? o.seq : -1 };
    });
  }, [tasks, completedTasks, overrides]);

  // Active tasks keep source order; completed tasks sort most-recently-completed
  // first (session completions by seq desc, then pre-existing by due date desc).
  const active = rows.filter((r) => !r.done);
  const completed = rows
    .filter((r) => r.done)
    .sort((a, b) => {
      if (a.seq !== b.seq) return b.seq - a.seq;
      return (b.task.date ?? "").localeCompare(a.task.date ?? "");
    });

  const hasCompleted = completed.length > 0;

  return (
    <Card className="shadow-sm d-flex flex-column h-100 overflow-hidden">
      <Card.Body className="d-flex flex-column gap-3 overflow-hidden flex-grow-1">
        <div className="d-flex align-items-center justify-content-between gap-2">
          <Card.Title
            className="fw-semibold d-inline-flex align-items-center gap-2 mb-0"
            style={{ fontSize: 20, lineHeight: "26px" }}
          >
            Tasks
            <Badge variant="secondary" appearance="muted">
              {active.length}
            </Badge>
          </Card.Title>
          <Button variant="ghost" size="icon-sm" aria-label="Add task">
            <FontAwesomeIcon icon={faPlus} />
          </Button>
        </div>

        <div className="d-flex flex-column gap-2 overflow-auto flex-grow-1">
          {active.length === 0 && !showCompleted ? (
            <span className="text-muted fs-small">
              No open tasks — AI queues them after your next call or email.
            </span>
          ) : (
            active.map((r) => (
              <ContactTaskCard
                key={r.task.id}
                task={r.task}
                done={false}
                onToggle={() => toggle(r.task, false)}
              />
            ))
          )}

          {showCompleted &&
            completed.map((r) => (
              <ContactTaskCard
                key={r.task.id}
                task={r.task}
                done
                onToggle={() => toggle(r.task, true)}
              />
            ))}
        </div>
      </Card.Body>

      {hasCompleted && (
        <div className="contact-tasks__completed-bar">
          <Button
            variant="ghost"
            className="contact-tasks__completed-toggle w-100"
            onClick={() => setShowCompleted(!showCompleted)}
          >
            {showCompleted
              ? "Hide Completed Tasks"
              : `Show ${completed.length} Completed Task${
                  completed.length === 1 ? "" : "s"
                }`}
          </Button>
        </div>
      )}
    </Card>
  );
}
