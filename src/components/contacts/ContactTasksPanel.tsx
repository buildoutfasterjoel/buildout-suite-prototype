import { useMemo, useRef, useState } from "react";
import { Accordion } from "@buildoutinc/blueprint-react/ui/Accordion";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/pro-regular-svg-icons";
import type { Contact, ContactTask } from "#/data/types";
import { ContactSection } from "#/components/contacts/ContactSection";
import { ContactTaskCard } from "#/components/contacts/ContactTaskCard";
import { useContactUiPrefs } from "#/components/contacts/useContactUiPrefs";
import { useAddTask } from "#/data/useAddTask";
import { useContactSession } from "#/components/contacts/useContactSession";
import { offerUndo } from "#/lib/undo";
import { todayISO } from "#/components/contacts/contactDisplay";
import type { ComposedDraft } from "#/components/contacts/ContactComposeModule";

/**
 * The section header's "+". Icon-only, so the tooltip carries the meaning.
 * Exported because the narrow "tabs" layout hangs it off the tab strip instead —
 * there the strip is the header, so that's where the action belongs.
 */
export function AddTaskAction({ contactId }: { contactId: string }) {
  return (
    <Tooltip>
      <Tooltip.Trigger
        render={
          <Button
            variant="ghost"
            appearance="muted"
            size="icon-sm"
            aria-label="Create New Task"
            onClick={() => useAddTask.getState().openFor(contactId)}
          >
            <FontAwesomeIcon icon={faPlus} />
          </Button>
        }
      />
      <Tooltip.Content>Create New Task</Tooltip.Content>
    </Tooltip>
  );
}

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
  onLog,
  bare = false,
}: {
  contact: Contact;
  tasks: ContactTask[];
  completedTasks: ContactTask[];
  /**
   * Logs the completion to the timeline. Checking a task off is real activity.
   * Returns the activity's id so an undo can pull the row back out again.
   */
  onLog?: (draft: ComposedDraft) => string | void;
  /** Drop the card + collapsible header — used as the body of a tab. */
  bare?: boolean;
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
    const currentlyDone = overrides[task.id]?.done ?? baseDone;
    // Logged outside the state updater on purpose: React invokes updaters twice
    // in development, so a side-effect in there posts the activity twice.
    // Only completing is activity — un-checking is a correction, and logging that
    // would leave a "Task completed" row for a task that isn't.
    const logId = currentlyDone
      ? undefined
      : onLog?.({ kind: "task", body: task.label, date: todayISO() });
    setOverrides((prev) => ({
      ...prev,
      [task.id]: { done: !(prev[task.id]?.done ?? baseDone), seq },
    }));
    if (currentlyDone) return;
    // Undo has to walk back both halves of the completion: the checkbox and the
    // timeline row it wrote.
    offerUndo({
      title: "Task completed",
      description: task.label,
      onUndo: () => {
        setOverrides((prev) => ({
          ...prev,
          [task.id]: { done: false, seq: seqRef.current++ },
        }));
        if (logId) useContactSession.getState().removeLog(contact.id, logId);
      },
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

  // Active tasks sort by due date ascending — overdue and due-soonest first,
  // tasks with no date last. Completed tasks sort most-recently-completed first
  // (session completions by seq desc, then pre-existing by due date desc).
  const active = rows
    .filter((r) => !r.done)
    .sort((a, b) => {
      const da = a.task.date;
      const db = b.task.date;
      if (!da && !db) return 0;
      if (!da) return 1; // undated → after dated
      if (!db) return -1;
      return da.localeCompare(db); // ISO dates sort chronologically as strings
    });
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

  const body = (
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
  );

  // Inside a tab the tab strip already names the section, carries the count and
  // hosts the Add action, so the card, the collapse and the header all come off.
  if (bare) {
    return <div className="contact-tasks-bare">{body}</div>;
  }

  return (
    <Card className="panel-card overflow-hidden">
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
          action={<AddTaskAction contactId={contact.id} />}
        >
          {body}
        </ContactSection>
      </Accordion>
    </Card>
  );
}
