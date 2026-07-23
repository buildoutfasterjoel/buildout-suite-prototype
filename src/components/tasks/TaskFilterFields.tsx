import { Fragment, type ReactNode } from "react";
import { Checkbox } from "@buildoutinc/blueprint-react/ui/Checkbox";
import { RadioGroup } from "@buildoutinc/blueprint-react/ui/RadioGroup";
import { Separator } from "@buildoutinc/blueprint-react/ui/Separator";
import { Switch } from "@buildoutinc/blueprint-react/ui/Switch";
import {
  ASSIGNEE_OPTIONS,
  DUE_OPTIONS,
  SOURCE_OPTIONS,
  TYPE_OPTIONS,
  type TaskFilterState,
} from "#/components/tasks/taskFilterModel";

interface TaskFilterFieldsProps {
  filters: TaskFilterState;
  onChange: (next: TaskFilterState) => void;
  /** Optional "search filters" query; when set, hides non-matching groups. */
  query?: string;
}

/** Immutable toggle for a multi-select set. */
function toggled<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function groupMatches(query: string, title: string, labels: string[]): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  if (title.toLowerCase().includes(q)) return true;
  return labels.some((l) => l.toLowerCase().includes(q));
}

function CheckRow({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="contact-filters__row d-flex align-items-center gap-2 mb-0 px-2 py-1 rounded-3">
      <Checkbox checked={checked} onCheckedChange={onToggle} aria-label={label} />
      <span>{label}</span>
    </label>
  );
}

export function TaskFilterFields({
  filters,
  onChange,
  query = "",
}: TaskFilterFieldsProps) {
  const set = (patch: Partial<TaskFilterState>) =>
    onChange({ ...filters, ...patch });

  const show = {
    source: groupMatches(query, "Source", SOURCE_OPTIONS.map((o) => o.label)),
    type: groupMatches(query, "Type", TYPE_OPTIONS.map((o) => o.label)),
    assignee: groupMatches(query, "Assignee", ASSIGNEE_OPTIONS.map((o) => o.label)),
    due: groupMatches(query, "Due Date", DUE_OPTIONS.map((o) => o.label)),
    completed: groupMatches(query, "Completed Tasks", []),
  };

  const sections: { key: string; visible: boolean; node: ReactNode }[] = [
    {
      key: "source",
      visible: show.source,
      node: (
        <div className="d-flex flex-column gap-2">
          <span className="fw-bold">Source</span>
          <div className="contact-filters__grid">
            {SOURCE_OPTIONS.map((o) => (
              <CheckRow
                key={o.value}
                label={o.label}
                checked={filters.sources.has(o.value)}
                onToggle={() => set({ sources: toggled(filters.sources, o.value) })}
              />
            ))}
          </div>
        </div>
      ),
    },
    {
      key: "type",
      visible: show.type,
      node: (
        <div className="d-flex flex-column gap-2">
          <span className="fw-bold">Type</span>
          <div className="contact-filters__grid">
            {TYPE_OPTIONS.map((o) => (
              <CheckRow
                key={o.value}
                label={o.label}
                checked={filters.types.has(o.value)}
                onToggle={() => set({ types: toggled(filters.types, o.value) })}
              />
            ))}
          </div>
        </div>
      ),
    },
    {
      key: "assignee",
      visible: show.assignee,
      node: (
        <div className="d-flex flex-column gap-2">
          <span className="fw-bold">Assignee</span>
          <div className="contact-filters__grid">
            {ASSIGNEE_OPTIONS.map((o) => (
              <CheckRow
                key={o.value}
                label={o.label}
                checked={filters.assignees.has(o.value)}
                onToggle={() =>
                  set({ assignees: toggled(filters.assignees, o.value) })
                }
              />
            ))}
          </div>
        </div>
      ),
    },
    {
      key: "due",
      visible: show.due,
      node: (
        <div className="d-flex flex-column gap-2">
          <span className="fw-bold">Due Date</span>
          <RadioGroup
            value={filters.due}
            onValueChange={(v) => set({ due: v as TaskFilterState["due"] })}
            className="d-flex flex-column gap-1"
          >
            {DUE_OPTIONS.map((o) => (
              <label
                key={o.key}
                className="contact-filters__row d-flex align-items-center gap-2 mb-0 px-2 py-1 rounded-3"
              >
                <RadioGroup.Item value={o.key} />
                <span>{o.label}</span>
              </label>
            ))}
          </RadioGroup>
        </div>
      ),
    },
    {
      key: "completed",
      visible: show.completed,
      node: (
        <label className="d-flex align-items-center gap-2 mb-0">
          <Switch
            checked={filters.showCompleted}
            onCheckedChange={(c) => set({ showCompleted: c })}
            aria-label="Show completed tasks"
          />
          <span className="fw-semibold">Show completed tasks</span>
        </label>
      ),
    },
  ];

  const visible = sections.filter((s) => s.visible);

  return (
    <div className="d-flex flex-column gap-4">
      {visible.map((s, i) => (
        <Fragment key={s.key}>
          {s.node}
          {i < visible.length - 1 && <Separator />}
        </Fragment>
      ))}
    </div>
  );
}
