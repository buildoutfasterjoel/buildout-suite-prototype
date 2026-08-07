import { Link } from "@tanstack/react-router";
import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faAlarmExclamation,
  faHandshake,
  faSparkles,
  faUser,
} from "@fortawesome/pro-regular-svg-icons";
import type { TaskView } from "#/data/types";
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
  type TaskTypeKey,
} from "#/components/contacts/taskDisplay";

/**
 * A task row on the Tasks page — the same inset "card" tile as the contact
 * detail column, but always showing the assignee and a source badge for the
 * deal or contact the task hangs off. Clicking opens the task; the checkbox
 * toggles completion. Reuses the `.contact-task-card` styles.
 *
 * This page has room to spell things out, so the type badge carries its icon
 * *and* label (the contact column shows icon only). Everything else is turned
 * down instead: the assignee is an avatar with its name in a tooltip, and the
 * source badge is the muted outline variant rather than the contact column's
 * accent ghost — here the association is secondary metadata, so at this density
 * a column of blue links pulls the eye off the task titles.
 *
 * Both variants share one hover (underline + accent) so "this is a link" is
 * learned once across surfaces — see the association-badge block in main.scss.
 */
export function TaskListRow({
  task,
  onToggle,
  onOpen,
}: {
  task: TaskView;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const due = taskDueLabel(task.dueDate);
  // Overdue purely by date. A completed task keeps the alarm icon but drops the
  // red — "this was overdue when you finished it", not a live warning.
  const isOverdue = !!task.dueDate && task.dueDate < todayISO();
  const type = task.type as TaskTypeKey | null;
  const typeLabel = type ? TASK_TYPE_LABELS[type] : null;

  // Where the source chip goes. Deals route through `dealCardLinkProps`, which
  // resolves a space to its own page, nested under its building, rather than
  // assuming the deal's. Falls back to a plain chip if the record is gone — a
  // dangling badge beats a dead link.
  const sourceListing =
    task.sourceKind === "deal" && task.dealId ? getListing(task.dealId) : undefined;
  const sourceLink = sourceListing
    ? dealCardLinkProps(sourceListing)
    : task.sourceKind === "contact" && task.contactId
      ? ({
          to: "/backoffice/contacts/$contactId",
          params: { contactId: task.contactId },
        } as const)
      : null;

  const sourceBadge = task.sourceKind !== "none" && (
    <>
      <FontAwesomeIcon icon={task.sourceKind === "deal" ? faHandshake : faUser} />
      <span className="text-truncate">{task.sourceLabel}</span>
    </>
  );

  return (
    <div
      className={`contact-task-card contact-task-card--interactive${
        task.completed ? " contact-task-card--done" : ""
      }`}
      role="button"
      onClick={(e) => {
        if (!shouldIgnoreRowClick(e)) onOpen();
      }}
    >
      <div className="contact-task-card__inner">
        <TaskCheckbox checked={task.completed} onToggle={onToggle} />

        <div className="contact-task-card__content">
          {/* Top row: title + assignee avatar (name lives in its tooltip) */}
          <div className="contact-task-card__titlerow">
            <span className="contact-task-card__label">{task.title}</span>
            <Tooltip>
              <Tooltip.Trigger
                render={
                  <Avatar size="sm" className="contact-task-card__avatar">
                    {task.assigneeAvatarUrl && (
                      <Avatar.Image
                        src={task.assigneeAvatarUrl}
                        alt={task.assigneeName}
                      />
                    )}
                    <Avatar.Fallback>{task.assigneeInitials}</Avatar.Fallback>
                  </Avatar>
                }
              />
              <Tooltip.Content>Assigned to {task.assigneeName}</Tooltip.Content>
            </Tooltip>
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
              {type && typeLabel && (
                <span className="contact-task-card__badge contact-task-card__badge--type">
                  <FontAwesomeIcon icon={TASK_TYPE_ICONS[type]} />
                  {typeLabel}
                </span>
              )}
              {sourceBadge &&
                (sourceLink ? (
                  <Link
                    {...sourceLink}
                    className="contact-task-card__badge contact-task-card__badge--source-muted"
                    title={task.sourceLabel}
                  >
                    {sourceBadge}
                  </Link>
                ) : (
                  <span
                    className="contact-task-card__badge contact-task-card__badge--source-muted"
                    title={task.sourceLabel}
                  >
                    {sourceBadge}
                  </span>
                ))}
            </div>

            {due && (
              <span
                className={`contact-task-card__due${
                  isOverdue
                    ? task.completed
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
