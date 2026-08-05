import { Link } from "@tanstack/react-router";
import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faAlarmExclamation, faSparkles } from "@fortawesome/pro-regular-svg-icons";
import type { ContactTask } from "#/data/types";
import { getListing } from "#/data/store";
import { dealCardLinkProps } from "#/components/deals/dealCardLink";
import { shouldIgnoreRowClick } from "#/components/contacts/rowClick";
import { todayISO } from "#/components/contacts/contactDisplay";
import { TaskCheckbox } from "#/components/tasks/TaskCheckbox";
import {
  AI_TASK_BADGE_LABEL,
  TASK_TYPE_ICONS,
  TASK_TYPE_LABELS,
  taskDueLabel,
  taskTypeKey,
} from "#/components/contacts/taskDisplay";

/**
 * A single task in the contact detail page's Tasks column, matching the Figma
 * "Task" component. The tile is inset (horizontal padding) so a gray hover
 * background reads as a card. Layout:
 *  - top row: completion checkbox, the title, and the assignee avatar;
 *  - bottom row: badges (AI sparkle if AI-created, an icon-only type badge, and
 *    a ghost link to the associated deal) with the due date pushed to the right
 *    — muted with no icon normally, red + bold with an alarm icon when overdue.
 *
 * The type badge is icon-only here (the Tasks page shows icon + label) and the
 * deal reads as a hyperlink rather than a chip, keeping this narrow column
 * legible.
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
  // Overdue purely by date. A completed task keeps the alarm icon but drops the
  // red — "this was overdue when you finished it", not a live warning.
  const isOverdue = !!task.date && task.date < todayISO();
  const type = taskTypeKey(task);
  // A space deal has no page of its own, so the badge links wherever
  // `dealCardLinkProps` sends it (the building's roster, for a space).
  const dealListing = task.dealId ? getListing(task.dealId) : undefined;

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
        <TaskCheckbox checked={done} onToggle={onToggle} />

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
              {task.createdByAi && (
                <Tooltip>
                  <Tooltip.Trigger
                    render={
                      <span
                        className="contact-task-card__badge contact-task-card__badge--ai"
                        aria-label={AI_TASK_BADGE_LABEL}
                      >
                        <FontAwesomeIcon icon={faSparkles} />
                      </span>
                    }
                  />
                  <Tooltip.Content>{AI_TASK_BADGE_LABEL}</Tooltip.Content>
                </Tooltip>
              )}
              {type && (
                <Tooltip>
                  <Tooltip.Trigger
                    render={
                      <span className="contact-task-card__badge contact-task-card__badge--type contact-task-card__badge--icon">
                        <FontAwesomeIcon icon={TASK_TYPE_ICONS[type]} />
                      </span>
                    }
                  />
                  <Tooltip.Content>{TASK_TYPE_LABELS[type]}</Tooltip.Content>
                </Tooltip>
              )}
              {dealListing && (
                <Link
                  {...dealCardLinkProps(dealListing)}
                  className="contact-task-card__badge contact-task-card__badge--ghost"
                  title={task.dealName}
                >
                  <span className="text-truncate">{task.dealName}</span>
                </Link>
              )}
            </div>

            {due && (
              <span
                className={`contact-task-card__due${
                  isOverdue
                    ? done
                      ? " contact-task-card__due--was-overdue"
                      : " contact-task-card__due--overdue"
                    : ""
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
