import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faAlarmExclamation,
  faHandshake,
  faSparkles,
  faCheck,
} from "@fortawesome/pro-regular-svg-icons";
import type { ContactTask } from "#/data/types";
import { shouldIgnoreRowClick } from "#/components/contacts/rowClick";
import { todayISO } from "#/components/contacts/contactDisplay";
import {
  isAiSuggested,
  taskDueLabel,
  taskTypeLabel,
} from "#/components/contacts/taskDisplay";

/**
 * A single task in the contact detail page's Tasks column, matching the Figma
 * "Task" component. The tile is inset (horizontal padding) so a gray hover
 * background reads as a card. Layout:
 *  - top row: completion checkbox, the title, and the assignee avatar;
 *  - bottom row: badges (AI sparkle if AI-created, a text type label, and an
 *    outlined deal badge when the source is a deal) with the due date pushed to
 *    the right — muted with no icon normally, red + bold with an alarm icon when
 *    overdue.
 *
 * Self-contained until Blueprint ships a Task component. Completion is
 * controlled by the parent panel, so `done`/`onToggle` come in as props.
 */
export function ContactTaskCard({
  task,
  done,
  onToggle,
  onOpen,
}: {
  task: ContactTask;
  done: boolean;
  onToggle: () => void;
  /** When provided, clicking the tile (outside its controls) opens the task. */
  onOpen?: () => void;
}) {
  const due = taskDueLabel(task.date);
  // Overdue purely by date: an incomplete task whose due date is before today.
  const isOverdue = !done && !!task.date && task.date < todayISO();
  const typeLabel = taskTypeLabel(task);
  const showSparkle = isAiSuggested(task);

  return (
    <div
      className={`contact-task-card${done ? " contact-task-card--done" : ""}${
        onOpen ? " contact-task-card--interactive" : ""
      }`}
      role={onOpen ? "button" : undefined}
      onClick={
        onOpen
          ? (e) => {
              // Let the checkbox behave normally.
              if (!shouldIgnoreRowClick(e)) onOpen();
            }
          : undefined
      }
    >
      <div className="contact-task-card__inner">
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

        <div className="contact-task-card__content">
          {/* Top row: title + assignee avatar */}
          <div className="contact-task-card__titlerow">
            <span className="contact-task-card__label">{task.label}</span>
            {/* Assignee avatar — only when the contact is shared with others. */}
            {task.showAssignee && (
              <Tooltip>
                <Tooltip.Trigger
                  render={
                    <Avatar
                      size="sm"
                      className="contact-task-card__avatar"
                      style={{ width: 18, height: 18 }}
                    >
                      {task.assigneeAvatarUrl && (
                        <Avatar.Image
                          src={task.assigneeAvatarUrl}
                          alt={task.assigneeName ?? task.assigneeInitials}
                        />
                      )}
                      <Avatar.Fallback style={{ fontSize: 8 }}>
                        {task.assigneeInitials}
                      </Avatar.Fallback>
                    </Avatar>
                  }
                />
                <Tooltip.Content>
                  Assigned to {task.assigneeName ?? task.assigneeInitials}
                </Tooltip.Content>
              </Tooltip>
            )}
          </div>

          {/* Bottom row: badges + due date */}
          <div className="contact-task-card__meta">
            <div className="contact-task-card__badges">
              {showSparkle && (
                <span
                  className="contact-task-card__badge contact-task-card__badge--ai"
                  aria-label="AI suggested"
                  title="AI suggested"
                >
                  <FontAwesomeIcon icon={faSparkles} />
                </span>
              )}
              {typeLabel && (
                <span className="contact-task-card__badge contact-task-card__badge--type">
                  {typeLabel}
                </span>
              )}
              {task.dealId && (
                <span
                  className="contact-task-card__badge contact-task-card__badge--deal"
                  title={task.dealName}
                >
                  <FontAwesomeIcon icon={faHandshake} />
                  <span className="text-truncate">{task.dealName}</span>
                </span>
              )}
            </div>

            {due && (
              <span
                className={`contact-task-card__due${
                  isOverdue ? " contact-task-card__due--overdue" : ""
                }`}
              >
                {isOverdue && <FontAwesomeIcon icon={faAlarmExclamation} />}
                {due}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
