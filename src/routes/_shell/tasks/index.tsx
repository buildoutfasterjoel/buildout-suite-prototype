import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { DropdownMenu } from "@buildoutinc/blueprint-react/ui/DropdownMenu";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { Pagination } from "@buildoutinc/blueprint-react/ui/Pagination";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCaretDown,
  faChevronDown,
  faChevronRight,
  faFilter,
  faLayerGroup,
  faList,
  faListCheck,
  faMagnifyingGlass,
  faPlus,
} from "@fortawesome/pro-regular-svg-icons";
import type { TaskView } from "#/data/types";
import { useDataStore } from "#/data/dataStore";
import { listAllTasks } from "#/data/selectors";
import { setTaskCompleted, updateDealTask } from "#/data/actions";
import { useAddTask } from "#/data/useAddTask";
import { todayISO } from "#/components/contacts/contactDisplay";
import { TaskListRow } from "#/components/tasks/TaskListRow";
import { TaskFilters } from "#/components/tasks/TaskFilters";
import { TaskFilterBar } from "#/components/tasks/TaskFilterBar";
import {
  countActiveTaskFilters,
  dueBucket,
  emptyTaskFilters,
  matchesTaskFilters,
  type TaskFilterState,
} from "#/components/tasks/taskFilterModel";

export const Route = createFileRoute("/_shell/tasks/")({
  component: TasksPage,
  head: () => ({ meta: [{ title: "Tasks | Buildout Suite" }] }),
});

const PAGE_SIZE = 10;

/** Nulls-last ascending by due date. */
function byDue(a: TaskView, b: TaskView): number {
  if (!a.dueDate && !b.dueDate) return 0;
  if (!a.dueDate) return 1;
  if (!b.dueDate) return -1;
  return a.dueDate.localeCompare(b.dueDate);
}

/** Compact page list: 1 … (current-1 current current+1) … last, with ellipses. */
function pageWindow(current: number, total: number): (number | "…")[] {
  if (total <= 7)
    return Array.from({ length: total }, (_, i) => i + 1);
  const items: (number | "…")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) items.push("…");
  for (let i = start; i <= end; i++) items.push(i);
  if (end < total - 1) items.push("…");
  items.push(total);
  return items;
}

function TasksPage() {
  // Re-render on any task/deal mutation.
  const tasksMap = useDataStore((s) => s.tasks);
  const listingsMap = useDataStore((s) => s.listings);
  const all = useMemo(() => listAllTasks(), [tasksMap, listingsMap]);
  const today = todayISO();

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<TaskFilterState>(emptyTaskFilters());
  const [showFilters, setShowFilters] = useState(false);
  const [view, setView] = useState<"grouped" | "list">("grouped");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((t) => {
      if (!matchesTaskFilters(t, filters, today)) return false;
      if (
        q &&
        !`${t.title} ${t.assigneeName} ${t.sourceLabel}`
          .toLowerCase()
          .includes(q)
      )
        return false;
      return true;
    });
  }, [all, filters, search, today]);

  useEffect(() => {
    setPage(1);
  }, [search, filters, view]);

  const activeFilterCount = countActiveTaskFilters(filters);
  const openCount = filtered.filter((t) => !t.completed).length;

  const toggleComplete = (t: TaskView) => {
    if (t.kind === "deal" && t.dealId) {
      updateDealTask(t.dealId, t.id, {
        status: t.completed ? "open" : "complete",
      });
    } else {
      setTaskCompleted(t.id, !t.completed);
    }
  };
  const openTask = (t: TaskView) => {
    if (t.kind === "deal" && t.dealId) {
      useAddTask.getState().openEditDeal(t.dealId, t.id);
    } else {
      useAddTask.getState().openEdit(t.id);
    }
  };

  // Grouped view partitions.
  const groups = useMemo(() => {
    const open = filtered.filter((t) => !t.completed);
    return {
      overdue: open
        .filter((t) => dueBucket(t.dueDate, today) === "overdue")
        .sort(byDue),
      today: open
        .filter((t) => dueBucket(t.dueDate, today) === "today")
        .sort(byDue),
      future: open
        .filter((t) => dueBucket(t.dueDate, today) === "future")
        .sort(byDue),
      none: open.filter((t) => !t.dueDate),
      completed: filtered.filter((t) => t.completed).sort(byDue),
    };
  }, [filtered, today]);

  const sections: {
    key: string;
    title: string;
    tone: "default" | "overdue";
    tasks: TaskView[];
  }[] = [
    { key: "overdue", title: "Overdue", tone: "overdue" as const, tasks: groups.overdue },
    { key: "today", title: "Today", tone: "default" as const, tasks: groups.today },
    { key: "future", title: "Future", tone: "default" as const, tasks: groups.future },
    { key: "none", title: "No Date", tone: "default" as const, tasks: groups.none },
    {
      key: "completed",
      title: "Completed",
      tone: "default" as const,
      tasks: groups.completed,
    },
  ].filter((s) => s.tasks.length > 0);

  // List view.
  const sorted = useMemo(() => [...filtered].sort(byDue), [filtered]);
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const paged = sorted.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <div className="h-100 overflow-auto p-4">
      <div className="mx-auto w-100" style={{ maxWidth: "56rem" }}>
        <Card>
          <Card.Body className="d-flex flex-column gap-4">
            {/* Header */}
            <div className="d-flex align-items-start gap-3">
              <div className="flex-grow-1">
                <h1 className="fs-4 fw-bold mb-1">Tasks</h1>
                <p className="text-muted mb-0">
                  All of your tasks across contacts and deals in one place.
                </p>
              </div>
              <div className="d-flex">
                <Button
                  variant="primary"
                  className="rounded-end-0"
                  onClick={() => useAddTask.getState().openFor()}
                >
                  <FontAwesomeIcon icon={faPlus} />
                  Add Task
                </Button>
                <DropdownMenu>
                  <DropdownMenu.Trigger
                    render={
                      <Button
                        variant="primary"
                        size="icon"
                        aria-label="More add options"
                        className="rounded-start-0 border-start-0"
                      >
                        <FontAwesomeIcon icon={faCaretDown} />
                      </Button>
                    }
                  />
                  <DropdownMenu.Content align="end">
                    <DropdownMenu.Item
                      onClick={() => useAddTask.getState().openFor()}
                    >
                      New Task
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu>
              </div>
            </div>

            {/* Toolbar */}
            <div className="d-flex flex-column gap-3">
              <div className="d-flex align-items-center gap-3 flex-wrap">
                <div style={{ minWidth: 280 }}>
                  <InputGroup>
                    <InputGroup.Addon>
                      <FontAwesomeIcon icon={faMagnifyingGlass} />
                    </InputGroup.Addon>
                    <Input
                      type="search"
                      placeholder="Search by task, contact, or deal"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </InputGroup>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setShowFilters((v) => !v)}
                  aria-pressed={showFilters}
                >
                  <FontAwesomeIcon icon={faFilter} />
                  Filters
                  {activeFilterCount > 0 && ` (${activeFilterCount})`}
                </Button>
                <span className="text-muted">
                  <span className="fw-semibold text-body">{openCount}</span> open
                  {openCount === 1 ? " task" : " tasks"}
                </span>

                {/* View toggle */}
                <div className="ms-auto d-flex align-items-center gap-1">
                  <Tooltip>
                    <Tooltip.Trigger
                      render={
                        <Button
                          variant={view === "grouped" ? "secondary" : "outline"}
                          size="icon"
                          aria-label="Grouped view"
                          aria-pressed={view === "grouped"}
                          onClick={() => setView("grouped")}
                        >
                          <FontAwesomeIcon icon={faLayerGroup} />
                        </Button>
                      }
                    />
                    <Tooltip.Content>Grouped by due date</Tooltip.Content>
                  </Tooltip>
                  <Tooltip>
                    <Tooltip.Trigger
                      render={
                        <Button
                          variant={view === "list" ? "secondary" : "outline"}
                          size="icon"
                          aria-label="List view"
                          aria-pressed={view === "list"}
                          onClick={() => setView("list")}
                        >
                          <FontAwesomeIcon icon={faList} />
                        </Button>
                      }
                    />
                    <Tooltip.Content>List view</Tooltip.Content>
                  </Tooltip>
                </div>
              </div>

              <TaskFilterBar
                filters={filters}
                onChange={setFilters}
                onClear={() => setFilters(emptyTaskFilters())}
              />
            </div>

            <TaskFilters
              open={showFilters}
              onOpenChange={setShowFilters}
              filters={filters}
              onChange={setFilters}
            />

            {/* Content */}
            {filtered.length === 0 ? (
              <Empty className="py-6">
                <Empty.Media>
                  <FontAwesomeIcon icon={faListCheck} />
                </Empty.Media>
                <Empty.Content>
                  <Empty.Title>No tasks found</Empty.Title>
                  Try clearing filters or search, or add a new task.
                </Empty.Content>
              </Empty>
            ) : view === "grouped" ? (
              <div className="d-flex flex-column gap-4">
                {sections.map((s) => (
                  <TaskGroup
                    key={s.key}
                    title={s.title}
                    tone={s.tone}
                    tasks={s.tasks}
                    onToggle={toggleComplete}
                    onOpen={openTask}
                  />
                ))}
              </div>
            ) : (
              <div className="d-flex flex-column gap-3">
                <div className="border rounded-3 overflow-hidden">
                  <div className="px-3">
                    {paged.map((t) => (
                      <TaskListRow
                        key={t.id}
                        task={t}
                        onToggle={() => toggleComplete(t)}
                        onOpen={() => openTask(t)}
                      />
                    ))}
                  </div>
                </div>
                {pageCount > 1 && (
                  <Pagination className="d-flex justify-content-center">
                    <Pagination.Content>
                      <Pagination.Item>
                        <Pagination.Previous
                          href="#"
                          aria-disabled={current === 1}
                          onClick={(e) => {
                            e.preventDefault();
                            setPage((p) => Math.max(1, p - 1));
                          }}
                        />
                      </Pagination.Item>
                      {pageWindow(current, pageCount).map((item, i) =>
                        item === "…" ? (
                          <Pagination.Item key={`gap-${i}`}>
                            <span className="px-2 text-muted" aria-hidden>
                              …
                            </span>
                          </Pagination.Item>
                        ) : (
                          <Pagination.Item key={item}>
                            <Pagination.Link
                              href="#"
                              isActive={item === current}
                              onClick={(e) => {
                                e.preventDefault();
                                setPage(item);
                              }}
                            >
                              {item}
                            </Pagination.Link>
                          </Pagination.Item>
                        ),
                      )}
                      <Pagination.Item>
                        <Pagination.Next
                          href="#"
                          aria-disabled={current === pageCount}
                          onClick={(e) => {
                            e.preventDefault();
                            setPage((p) => Math.min(pageCount, p + 1));
                          }}
                        />
                      </Pagination.Item>
                    </Pagination.Content>
                  </Pagination>
                )}
              </div>
            )}
          </Card.Body>
        </Card>
      </div>
    </div>
  );
}

/** A collapsible section for the grouped view. */
function TaskGroup({
  title,
  tone,
  tasks,
  onToggle,
  onOpen,
}: {
  title: string;
  tone: "default" | "overdue";
  tasks: TaskView[];
  onToggle: (t: TaskView) => void;
  onOpen: (t: TaskView) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border rounded-3 overflow-hidden">
      <button
        type="button"
        className={`tasks-group__header w-100 d-flex align-items-center gap-2 px-3 py-3${
          open ? " border-bottom" : ""
        }`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <FontAwesomeIcon
          icon={open ? faChevronDown : faChevronRight}
          className="text-muted"
        />
        <span className="fs-5 fw-semibold">{title}</span>
        <span
          className="tasks-group__count"
          data-tone={tone === "overdue" ? "overdue" : "default"}
        >
          {tasks.length}
        </span>
      </button>
      {open && (
        <div className="px-3">
          {tasks.map((t) => (
            <TaskListRow
              key={t.id}
              task={t}
              onToggle={() => onToggle(t)}
              onOpen={() => onOpen(t)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
