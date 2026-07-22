import { AddTaskModal, type NewTaskDraft } from "#/components/tasks/AddTaskModal";
import {
  createTask,
  deleteDealTask,
  deleteTask,
  updateDealTask,
  updateTask,
} from "#/data/actions";
import { useDataStore } from "#/data/dataStore";
import { CURRENT_USER, TEAMMATES } from "#/data/teammates";
import type { Task } from "#/data/types";
import { useAddTask } from "#/data/useAddTask";
import { notify } from "#/lib/notify";

const ROSTER = [CURRENT_USER, ...TEAMMATES];
/** Resolve assignee initials → teammate id (falls back to the current user). */
const idByInitials = (initials: string) =>
  ROSTER.find((m) => m.initials === initials)?.id ?? CURRENT_USER.id;

/** Format a Date as a local ISO `YYYY-MM-DD` (no UTC shift), matching stored dates. */
function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Map a modal draft to the create/update action input (dates → ISO strings). */
function toInput(draft: NewTaskDraft) {
  return {
    name: draft.name,
    assigneeId: draft.assigneeId,
    dueDate: draft.dueDate ? toISODate(draft.dueDate) : null,
    type: draft.type,
    source: draft.source,
    contactId: draft.contactId,
    dealId: draft.dealId,
    notes: draft.notes,
    reminders: draft.reminders.map(toISODate),
    followUpDate: draft.followUpDate ? toISODate(draft.followUpDate) : null,
    requireAttachments: draft.requireAttachments,
  };
}

/** The single, app-wide Task modal (create + edit), driven by the useAddTask store. */
export function GlobalAddTaskModal() {
  const open = useAddTask((s) => s.open);
  const contactId = useAddTask((s) => s.contactId);
  const taskId = useAddTask((s) => s.taskId);
  const dealId = useAddTask((s) => s.dealId);
  const close = useAddTask((s) => s.close);
  // Subscribe to both maps so the edited task resolves and stays current.
  const tasks = useDataStore((s) => s.tasks);
  const listings = useDataStore((s) => s.listings);

  // Resolve the task being edited. Standalone tasks come from the store; a
  // deal-derived task is adapted from its deal's planner list into Task shape.
  const isDealEdit = taskId != null && dealId != null;
  const dealTask = isDealEdit
    ? listings.get(dealId)?.tasks.find((t) => t.id === taskId) ?? null
    : null;
  const task: Task | null = isDealEdit
    ? dealTask
      ? {
          id: dealTask.id,
          name: dealTask.label,
          assigneeId: idByInitials(dealTask.assigneeInitials),
          assigneeInitials: dealTask.assigneeInitials,
          dueDate: dealTask.date,
          type: null,
          source: "deal",
          contactId: null,
          dealId,
          notes: "",
          reminders: [],
          followUpDate: null,
          requireAttachments: dealTask.hasAttachment,
          status: dealTask.status,
          createdAt: "",
        }
      : null
    : taskId
      ? tasks.get(taskId) ?? null
      : null;

  return (
    <AddTaskModal
      open={open}
      defaultContactId={contactId}
      task={task}
      onOpenChange={(o) => {
        if (!o) close();
      }}
      onSave={(draft) => {
        createTask(toInput(draft));
        notify({ title: "Task added", description: draft.name });
      }}
      onUpdate={(draft) => {
        if (isDealEdit && dealId && taskId) {
          // Deal tasks only carry a subset of fields; persist what maps back.
          // Assignee is preserved as-is — deal tasks use their own initials
          // (e.g. "KN") that don't map to the teammate roster, so we don't
          // clobber it from the id-based picker.
          updateDealTask(dealId, taskId, {
            label: draft.name,
            date: draft.dueDate ? toISODate(draft.dueDate) : null,
            hasAttachment: draft.requireAttachments,
          });
        } else if (task) {
          updateTask(task.id, toInput(draft));
        }
        notify({ title: "Task updated", description: draft.name });
      }}
      onDelete={() => {
        if (isDealEdit && dealId && taskId) {
          deleteDealTask(dealId, taskId);
        } else if (task) {
          deleteTask(task.id);
        }
        if (task) notify({ title: "Task deleted", description: task.name });
      }}
    />
  );
}
