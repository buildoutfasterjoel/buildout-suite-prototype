import { Link } from "@tanstack/react-router";
import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCalendar,
  faHandshake,
  faSparkles,
  faCheck,
} from "@fortawesome/pro-regular-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import type { ContactTask } from "#/data/types";
import { shouldIgnoreRowClick } from "#/components/contacts/rowClick";
import {
  TASK_TYPE_META,
  GENERIC_TASK_ICON,
  deriveTaskType,
  isAiSuggested,
  taskDueLabel,
} from "#/components/contacts/taskDisplay";

/**
 * A single open task in the contact detail page's Tasks column, matching the
 * Figma "Task" component: a completion checkbox, the task label, a due-date and
 * source (deal) meta row, and — on the right — the assignee avatar stacked over
 * an optional AI-suggested sparkle and the task-type badge.
 *
 * This is a local, self-contained stand-in: Blueprint doesn't ship a Task
 * component yet. Keep the markup contained here so it can be swapped for the
 * design-system component wholesale once it lands.
 *
 * Completion is controlled by the parent panel (which moves completed tasks to
 * its collapsible "completed" section), so `done`/`onToggle` come in as props.
 */
export function ContactTaskCard({
  task,
  done,
  onToggle,
}: {
  task: ContactTask;
  done: boolean;
  onToggle: () => void;
}) {
  const due = taskDueLabel(task.date);
  const isOverdue = task.status === "overdue";
  const type = deriveTaskType(task.label);
  const typeMeta = type ? TASK_TYPE_META[type] : null;
  const typeIcon = typeMeta?.icon ?? GENERIC_TASK_ICON;
  const typeLabel = typeMeta?.label ?? "Task";
  const showSparkle = isAiSuggested(task);

  return (
    <div className={`contact-task-card${done ? " contact-task-card--done" : ""}`}>
      {/* Completion checkbox (circular, per design) */}
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? "Mark task incomplete" : "Mark task complete"}
        className="contact-task-card__check"
        onClick={onToggle}
      >
        {done && <FontAwesomeIcon icon={faCheck} />}
      </button>

      {/* Task info + author */}
      <div className="d-flex flex-grow-1 gap-2" style={{ minWidth: 0 }}>
        <div className="d-flex flex-column flex-grow-1 gap-1" style={{ minWidth: 0 }}>
          <div className="contact-task-card__label">{task.label}</div>

          <div className="d-flex align-items-center gap-2" style={{ minWidth: 0 }}>
            {due && (
              <span
                className={`contact-task-card__meta${
                  isOverdue ? " contact-task-card__meta--overdue" : ""
                }`}
              >
                <FontAwesomeIcon icon={faCalendar} />
                {due}
              </span>
            )}
            {task.dealId && (
              <Link
                to="/listings/$listingId"
                params={{ listingId: task.dealId }}
                className="contact-task-card__source"
                title={task.dealName}
                onClick={(e) => {
                  if (shouldIgnoreRowClick(e)) e.stopPropagation();
                }}
              >
                <FontAwesomeIcon icon={faHandshake} />
                <span className="text-truncate">{task.dealName}</span>
              </Link>
            )}
          </div>
        </div>

        {/* Author avatar + type badges */}
        <div className="d-flex flex-column align-items-end gap-1 flex-shrink-0">
          <Avatar size="sm" style={{ width: 18, height: 18 }}>
            <Avatar.Fallback style={{ fontSize: 8 }}>
              {task.assigneeInitials}
            </Avatar.Fallback>
          </Avatar>
          {showSparkle && (
            <TaskBadge
              icon={faSparkles}
              label="AI suggested"
              bg="#f9f5ff"
              color="#360764"
            />
          )}
          <TaskBadge icon={typeIcon} label={typeLabel} bg="#f6f7f9" color="#22262f" />
        </div>
      </div>
    </div>
  );
}

/** A small icon-only chip used for the AI-suggested and task-type indicators. */
function TaskBadge({
  icon,
  label,
  bg,
  color,
}: {
  icon: IconDefinition;
  label: string;
  bg: string;
  color: string;
}) {
  return (
    <span
      className="contact-task-card__badge"
      style={{ backgroundColor: bg, color }}
      aria-label={label}
      title={label}
    >
      <FontAwesomeIcon icon={icon} />
    </span>
  );
}
