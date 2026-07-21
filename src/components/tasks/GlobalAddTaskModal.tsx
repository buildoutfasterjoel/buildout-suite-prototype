import { AddTaskModal } from "#/components/tasks/AddTaskModal";
import { createTask } from "#/data/actions";
import { useAddTask } from "#/data/useAddTask";
import { notify } from "#/lib/notify";

/** Format a Date as a local ISO `YYYY-MM-DD` (no UTC shift), matching stored dates. */
function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** The single, app-wide Add Task modal, driven by the useAddTask store. */
export function GlobalAddTaskModal() {
  const open = useAddTask((s) => s.open);
  const contactId = useAddTask((s) => s.contactId);
  const close = useAddTask((s) => s.close);

  return (
    <AddTaskModal
      open={open}
      defaultContactId={contactId}
      onOpenChange={(o) => {
        if (!o) close();
      }}
      onSave={(draft) => {
        createTask({
          name: draft.name,
          assigneeId: draft.assigneeId,
          dueDate: draft.dueDate ? toISODate(draft.dueDate) : null,
          type: draft.type,
          source: draft.source,
          contactId: draft.contactId,
          notes: draft.notes,
          reminders: draft.reminders.map(toISODate),
          followUpDate: draft.followUpDate ? toISODate(draft.followUpDate) : null,
          requireAttachments: draft.requireAttachments,
        });
        notify({ title: "Task added", description: draft.name });
      }}
    />
  );
}
