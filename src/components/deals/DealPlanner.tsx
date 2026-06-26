import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faTriangleExclamation,
  faPaperclip,
  faEllipsisVertical,
  faCheck,
} from "@fortawesome/pro-regular-svg-icons";
import type { Listing, DealTask } from "#/data/types";
import { ListingPageHeader } from "../listings/ListingPageHeader";
import { formatDate } from "./dealDisplay";

const STATUS_DOT: Record<DealTask["status"], string> = {
  open: "#94a3b8",
  complete: "#16a34a",
  overdue: "#dc2626",
};

function TaskRow({ task }: { task: DealTask }) {
  return (
    <div className="d-flex align-items-center gap-3 px-4 py-3 border-bottom">
      <span
        className="rounded-circle flex-shrink-0"
        style={{ width: 10, height: 10, backgroundColor: STATUS_DOT[task.status] }}
        title={task.status}
      />
      <div style={{ width: 200 }} className="flex-shrink-0">
        {task.relativeDue ? (
          <div className="fw-semibold">TBD</div>
        ) : (
          <div className="fw-semibold">{formatDate(task.date)}</div>
        )}
        {task.relativeDue && (
          <div className="text-muted" style={{ fontSize: 12 }}>
            {task.relativeDue}
          </div>
        )}
        {task.status === "overdue" && (
          <span className="text-danger" style={{ fontSize: 12 }}>
            <FontAwesomeIcon icon={faTriangleExclamation} /> Overdue
          </span>
        )}
      </div>
      <div className="flex-grow-1 text-truncate">{task.label}</div>
      <div style={{ width: 32 }} className="text-center flex-shrink-0">
        {task.hasAttachment && (
          <FontAwesomeIcon icon={faPaperclip} className="text-muted" />
        )}
      </div>
      <Avatar size="sm" className="flex-shrink-0">
        <Avatar.Fallback>{task.assigneeInitials}</Avatar.Fallback>
      </Avatar>
      <Button variant="ghost" size="icon-sm" aria-label="Task actions">
        <FontAwesomeIcon icon={faEllipsisVertical} />
      </Button>
    </div>
  );
}

function TaskGroup({ label, tasks }: { label: string; tasks: DealTask[] }) {
  if (tasks.length === 0) return null;
  return (
    <>
      <div className="px-4 py-2 bg-body-secondary fw-semibold" style={{ fontSize: 13 }}>
        {label}
      </div>
      {tasks.map((t) => (
        <TaskRow key={t.id} task={t} />
      ))}
    </>
  );
}

export function DealPlanner({ listing }: { listing: Listing }) {
  const today = new Date();
  const past = listing.tasks.filter((t) => t.date && new Date(t.date) < today);
  const future = listing.tasks.filter((t) => !(t.date && new Date(t.date) < today));

  return (
    <div className="d-flex flex-column gap-3 p-4">
      <ListingPageHeader
        title="Tasks"
        actions={
          <>
            <Button variant="ghost" size="sm">
              <FontAwesomeIcon icon={faPlus} />
              Add task
            </Button>
            <Button variant="ghost" size="sm">
              <FontAwesomeIcon icon={faPlus} />
              Add critical date
            </Button>
          </>
        }
      />
      <div className="bg-card border rounded" style={{ borderRadius: 6 }}>
        <div className="d-flex align-items-center gap-2 px-4 py-3 border-bottom">
          <Button variant="primary" size="sm">
            Bulk Edit
          </Button>
          <div className="ms-auto d-flex gap-2">
            <Select>
              <Select.Trigger size="sm" style={{ minWidth: 140 }}>
                <Select.Value placeholder="All Assignees" />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="all">All Assignees</Select.Item>
                <Select.Item value="me">Assigned to me</Select.Item>
              </Select.Content>
            </Select>
            <Select>
              <Select.Trigger size="sm" style={{ minWidth: 110 }}>
                <Select.Value placeholder="Status" />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="open">Open</Select.Item>
                <Select.Item value="complete">Complete</Select.Item>
                <Select.Item value="overdue">Overdue</Select.Item>
              </Select.Content>
            </Select>
          </div>
        </div>

        {listing.tasks.length === 0 ? (
          <Empty className="py-6">
            <Empty.Media>
              <FontAwesomeIcon icon={faCheck} aria-hidden />
            </Empty.Media>
            <Empty.Content>
              <Empty.Title>No tasks yet</Empty.Title>
              Tasks and critical dates for this deal will appear here.
            </Empty.Content>
          </Empty>
        ) : (
          <>
            <TaskGroup label="Past" tasks={past} />
            <TaskGroup label="Future" tasks={future} />
          </>
        )}
      </div>
    </div>
  );
}
