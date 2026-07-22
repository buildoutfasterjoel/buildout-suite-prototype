import { useMemo, useRef, useState } from "react";
import { Accordion } from "@buildoutinc/blueprint-react/ui/Accordion";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/pro-regular-svg-icons";
import type { Contact, ContactTask } from "#/data/types";
import { ContactSection } from "#/components/contacts/ContactSection";
import { ContactTaskCard } from "#/components/contacts/ContactTaskCard";
import { useContactUiPrefs } from "#/components/contacts/useContactUiPrefs";
import { useAddTask } from "#/data/useAddTask";

/** A task plus its resolved completion state and completion order for sorting. */
interface TaskRow {
  task: ContactTask;
  done: boolean;
  /** Sequence in which the user completed it this session; -1 if not this session. */
  seq: number;
}

/**
 * Right column of the contact detail page: the contact's open tasks, aggregated
 * across their deals, in a collapsible section that matches the left overview
 * column's accordions (chevron header + count, an "Add" action).
 *
 * Completing an active task moves it out of the active list into the completed
 * set (most-recently-completed first). Completed tasks are revealed inline below
 * the open tasks via a "Show N Completed Tasks" toggle — the same pattern the
 * Deals section uses for past deals.
 */
export function ContactTasksPanel({
  contact,
  tasks,
  completedTasks,
}: {
  contact: Contact;
  tasks: ContactTask[];
  completedTasks: ContactTask[];
}) {
  // Section collapse + completed-reveal persist across contacts (useContactUiPrefs).
  const tasksOpen = useContactUiPrefs((s) => s.tasksOpen);
  const setTasksOpen = useContactUiPrefs((s) => s.setTasksOpen);
  const showCompleted = useContactUiPrefs((s) => s.showCompletedTasks);
  const setShowCompleted = useContactUiPrefs((s) => s.setShowCompletedTasks);
  const legacyAccordions = useContactUiPrefs((s) => s.legacyAccordions);
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

  // Open a task in the Edit modal — standalone tasks edit via the task store,
  // deal-derived tasks edit against their deal. Returns undefined (not clickable)
  // for anything that can't be opened.
  const openTask = (task: ContactTask): (() => void) | undefined => {
    if (task.editable) return () => useAddTask.getState().openEdit(task.id);
    if (task.dealId) {
      const dealId = task.dealId;
      return () => useAddTask.getState().openEditDeal(dealId, task.id);
    }
    return undefined;
  };

  return (
    <Card className="contact-panel-card overflow-hidden">
      <Accordion
        className={`contact-overview-accordion contact-overview-accordion--white${
          legacyAccordions ? " contact-overview-accordion--legacy" : ""
        }`}
        multiple
        value={tasksOpen ? ["tasks"] : []}
        onValueChange={(v) => setTasksOpen(v.includes("tasks"))}
      >
        <ContactSection
          value="tasks"
          label="Tasks"
          count={active.length}
          primaryCount
          action={
            <Button
              variant="ghost"
              appearance="muted"
              size="icon"
              aria-label="Add task"
              onClick={() => useAddTask.getState().openFor(contact.id)}
            >
              <FontAwesomeIcon icon={faPlus} />
            </Button>
          }
        >
          <div className="d-flex flex-column">
            {active.length === 0 ? (
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
                  onOpen={openTask(r.task)}
                />
              ))
            )}

            {completed.length > 0 && (
              <Button
                variant="ghost"
                className="w-100"
                onClick={() => setShowCompleted(!showCompleted)}
              >
                {showCompleted
                  ? "Hide Completed Tasks"
                  : `Show ${completed.length} Completed Task${
                      completed.length === 1 ? "" : "s"
                    }`}
              </Button>
            )}

            {showCompleted &&
              completed.map((r) => (
                <ContactTaskCard
                  key={r.task.id}
                  task={r.task}
                  done
                  onToggle={() => toggle(r.task, true)}
                  onOpen={openTask(r.task)}
                />
              ))}
          </div>
        </ContactSection>
      </Accordion>
    </Card>
  );
}
