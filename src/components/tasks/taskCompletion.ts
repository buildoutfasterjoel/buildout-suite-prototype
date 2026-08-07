import type { TaskView } from "#/data/types";
import { setTaskCompleted, updateDealTask } from "#/data/actions";
import { offerUndo } from "#/lib/undo";

/** Write a completion state through to whichever store backs the task. */
export function applyTaskCompleted(task: TaskView, completed: boolean): void {
  if (task.kind === "deal" && task.dealId) {
    updateDealTask(task.dealId, task.id, {
      status: completed ? "complete" : "open",
    });
  } else {
    setTaskCompleted(task.id, completed);
  }
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
