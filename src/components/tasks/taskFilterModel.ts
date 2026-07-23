import type { TaskView } from "#/data/types";
import { CURRENT_USER, TEAMMATES } from "#/data/teammates";
import { TASK_TYPE_LABELS, type TaskTypeKey } from "#/components/contacts/taskDisplay";

/**
 * Filter model + predicate for the Tasks page Filters flyout. JSX-free so the
 * matching logic stays unit-testable, mirroring `contactFilterModel.ts`.
 */

/** Due-date buckets, computed from a task's due date relative to "today". */
export type DueBucket = "any" | "overdue" | "today" | "future" | "none";

export const DUE_OPTIONS: { key: DueBucket; label: string }[] = [
  { key: "any", label: "Any" },
  { key: "overdue", label: "Overdue" },
  { key: "today", label: "Today" },
  { key: "future", label: "Future" },
  { key: "none", label: "No Date" },
];

export const SOURCE_OPTIONS: { value: TaskView["sourceKind"]; label: string }[] = [
  { value: "deal", label: "Deal" },
  { value: "contact", label: "Contact" },
];

/** The task types offered in the filter (the scoped set, excluding "None"). */
export const TYPE_OPTIONS: { value: TaskTypeKey; label: string }[] = (
  Object.keys(TASK_TYPE_LABELS) as TaskTypeKey[]
).map((k) => ({ value: k, label: TASK_TYPE_LABELS[k] }));

/** The assignee roster for the Assignee filter, current user first. */
export const ASSIGNEE_OPTIONS = [
  CURRENT_USER,
  ...TEAMMATES.filter((t) => t.id !== CURRENT_USER.id),
].map((m) => ({
  value: m.id,
  label: m.id === CURRENT_USER.id ? `${m.name} (you)` : m.name,
}));

const ASSIGNEE_NAME = new Map(ASSIGNEE_OPTIONS.map((o) => [o.value, o.label]));

export interface TaskFilterState {
  /** Multi-select (empty = no filter). */
  sources: Set<string>;
  types: Set<string>;
  assignees: Set<string>;
  /** Single-select due-date bucket. */
  due: DueBucket;
  /** Include completed tasks (shown in their own section / mixed into the list). */
  showCompleted: boolean;
}

export function emptyTaskFilters(): TaskFilterState {
  return {
    sources: new Set(),
    types: new Set(),
    assignees: new Set(),
    due: "any",
    showCompleted: false,
  };
}

/** Which bucket a due date falls into, relative to `today` (ISO YYYY-MM-DD). */
export function dueBucket(
  dueDate: string | null,
  today: string,
): Exclude<DueBucket, "any"> {
  if (!dueDate) return "none";
  if (dueDate < today) return "overdue";
  if (dueDate === today) return "today";
  return "future";
}

/** True when the task passes every active filter. Completion is gated here too. */
export function matchesTaskFilters(
  t: TaskView,
  f: TaskFilterState,
  today: string,
): boolean {
  if (!f.showCompleted && t.completed) return false;
  if (f.sources.size && !f.sources.has(t.sourceKind)) return false;
  if (f.types.size && (!t.type || !f.types.has(t.type))) return false;
  if (f.assignees.size && !f.assignees.has(t.assigneeId)) return false;
  if (f.due !== "any" && dueBucket(t.dueDate, today) !== f.due) return false;
  return true;
}

/** One removable pill per active filter. Drives the pills row and the count. */
export interface TaskFilterChip {
  key: string;
  label: string;
  clear: (f: TaskFilterState) => TaskFilterState;
}

function withoutSetValue<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  next.delete(value);
  return next;
}

export function taskFilterChips(f: TaskFilterState): TaskFilterChip[] {
  const chips: TaskFilterChip[] = [];
  for (const v of f.sources) {
    const label = SOURCE_OPTIONS.find((o) => o.value === v)?.label ?? v;
    chips.push({
      key: `source:${v}`,
      label: `Source: ${label}`,
      clear: (s) => ({ ...s, sources: withoutSetValue(s.sources, v) }),
    });
  }
  for (const v of f.types) {
    const label = TASK_TYPE_LABELS[v as TaskTypeKey] ?? v;
    chips.push({
      key: `type:${v}`,
      label: `Type: ${label}`,
      clear: (s) => ({ ...s, types: withoutSetValue(s.types, v) }),
    });
  }
  for (const v of f.assignees) {
    chips.push({
      key: `assignee:${v}`,
      label: `Assignee: ${ASSIGNEE_NAME.get(v) ?? v}`,
      clear: (s) => ({ ...s, assignees: withoutSetValue(s.assignees, v) }),
    });
  }
  if (f.due !== "any") {
    const label = DUE_OPTIONS.find((o) => o.key === f.due)?.label ?? f.due;
    chips.push({
      key: "due",
      label: `Due: ${label}`,
      clear: (s) => ({ ...s, due: "any" }),
    });
  }
  if (f.showCompleted) {
    chips.push({
      key: "showCompleted",
      label: "Completed tasks shown",
      clear: (s) => ({ ...s, showCompleted: false }),
    });
  }
  return chips;
}

export function countActiveTaskFilters(f: TaskFilterState): number {
  return taskFilterChips(f).length;
}
