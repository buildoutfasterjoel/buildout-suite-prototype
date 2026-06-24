import { useState } from "react";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
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
  const [message, setMessage] = useState("");

  const today = new Date();
  const past = listing.tasks.filter((t) => t.date && new Date(t.date) < today);
  const future = listing.tasks.filter((t) => !(t.date && new Date(t.date) < today));

  return (
    <div className="p-4">
      <div className="row g-4">
        {/* Planner */}
        <div className="col-lg-8">
          <div className="bg-card border rounded" style={{ borderRadius: 6 }}>
            <div className="d-flex align-items-center gap-2 px-4 py-3 border-bottom">
              <h2 className="fs-6 fw-semibold mb-0 flex-grow-1">Planner</h2>
              <Button variant="ghost" size="sm">
                <FontAwesomeIcon icon={faPlus} />
                Add task
              </Button>
              <Button variant="ghost" size="sm">
                <FontAwesomeIcon icon={faPlus} />
                Add critical date
              </Button>
            </div>
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

        {/* Messages */}
        <div className="col-lg-4">
          <div
            className="bg-card border rounded d-flex flex-column"
            style={{ borderRadius: 6, minHeight: 420 }}
          >
            <div className="px-4 py-3 border-bottom">
              <h2 className="fs-6 fw-semibold mb-0">Messages</h2>
            </div>
            <div className="flex-grow-1 p-4 d-flex flex-column gap-3 overflow-auto">
              {listing.messages.length === 0 ? (
                <p className="text-muted text-center mt-4 mb-0">
                  No messages yet.
                </p>
              ) : (
                listing.messages.map((m) => (
                  <div key={m.id}>
                    <div className="d-flex align-items-center gap-2 mb-1">
                      <Avatar size="sm">
                        <Avatar.Fallback>
                          {m.author
                            .split(" ")
                            .map((p) => p[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </Avatar.Fallback>
                      </Avatar>
                      <span className="fw-semibold" style={{ fontSize: 13 }}>
                        {m.author}
                      </span>
                    </div>
                    <p className="mb-0" style={{ fontSize: 13 }}>
                      {m.text}
                    </p>
                  </div>
                ))
              )}
            </div>
            <div className="p-3 border-top d-flex gap-2">
              <Input
                placeholder="Type Message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <Button variant="primary" onClick={() => setMessage("")}>
                Send
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
