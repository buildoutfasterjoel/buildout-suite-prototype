import type { TaskView } from "#/data/types";
import { setTaskCompleted, updateDealTask } from "#/data/actions";
import { useContactSession } from "#/components/contacts/useContactSession";
import { toISODate } from "#/lib/isoDate";
import { offerUndo } from "#/lib/undo";

/**
 * The timeline row each completion wrote, keyed by task id, so an un-check
 * retracts exactly the row its own completion added rather than the newest one
 * on the contact.
 */
const completionRows = new Map<string, { contactId: string; logId: string }>();

/**
 * Put a completion on the linked contact's timeline.
 *
 * The contact page's own Tasks panel has always done this — checking a box
 * there writes a "Task completed" row. Nothing else did, so the same task
 * checked off from the Tasks page, the dashboard, or Otto's day plan ("Done")
 * left no trace on the record: the row simply vanished from the open list and
 * the timeline never mentioned it.
 *
 * Only completing is activity. Un-checking is a correction, and logging that
 * would leave a "Task completed" row for a task that isn't — so it retracts the
 * row instead.
 */
function logCompletion(task: TaskView, completed: boolean): void {
  // A deal task belongs to the deal; there is no person whose record it is.
  if (!task.contactId) return;
  if (completed) {
    const logId = useContactSession.getState().addLog(task.contactId, {
      kind: "task",
      body: task.title,
      date: toISODate(new Date()),
    });
    completionRows.set(task.id, { contactId: task.contactId, logId });
    return;
  }
  const row = completionRows.get(task.id);
  if (!row) return;
  completionRows.delete(task.id);
  useContactSession.getState().removeLog(row.contactId, row.logId);
}

/** Write a completion state through to whichever store backs the task. */
export function applyTaskCompleted(task: TaskView, completed: boolean): void {
  if (task.kind === "deal" && task.dealId) {
    updateDealTask(task.dealId, task.id, {
      status: completed ? "complete" : "open",
    });
  } else {
    setTaskCompleted(task.id, completed);
  }
  // Here rather than in `toggleTaskCompleted`, so the undo path below walks the
  // timeline row back with the checkbox instead of leaving it stranded.
  logCompletion(task, completed);
}

/**
 * Toggle a task from its checkbox. Completing offers an undo — the row leaves
 * the list the moment it's checked, so the toast is the only trace of what just
 * happened. Un-checking is itself the correction, so it stays silent.
 */
export function toggleTaskCompleted(task: TaskView): void {
  const completed = !task.completed;
  applyTaskCompleted(task, completed);
  if (!completed) return;
  offerUndo({
    title: "Task completed",
    description: task.title,
    onUndo: () => applyTaskCompleted(task, false),
  });
}
