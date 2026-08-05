import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Accordion } from "@buildoutinc/blueprint-react/ui/Accordion";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { ButtonGroup } from "@buildoutinc/blueprint-react/ui/ButtonGroup";
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
import { useTaskUiPrefs } from "#/components/tasks/useTaskUiPrefs";
import {
  countActiveTaskFilters,
  dueSection,
  emptyTaskFilters,
  endOfWeekISO,
  matchesTaskFilters,
} from "#/components/tasks/taskFilterModel";

export const Route = createFileRoute("/_shell/tasks/")({
  component: TasksPage,
  head: () => ({ meta: [{ title: "Tasks | Buildout Suite" }] }),
});

const PAGE_SIZE = 10;

/** Rows shown in a truncated section before the "Show all …" button. */
const COLLAPSED_ROWS = 3;

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

  // Search, filters, and view persist across navigation (kept in a store).
  const search = useTaskUiPrefs((s) => s.search);
  const setSearch = useTaskUiPrefs((s) => s.setSearch);
  const filters = useTaskUiPrefs((s) => s.filters);
  const setFilters = useTaskUiPrefs((s) => s.setFilters);
  const view = useTaskUiPrefs((s) => s.view);
  const setView = useTaskUiPrefs((s) => s.setView);
  const collapsedSections = useTaskUiPrefs((s) => s.collapsedSections);
  const setSectionOpen = useTaskUiPrefs((s) => s.setSectionOpen);
  const [showFilters, setShowFilters] = useState(false);
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

  // Grouped view partitions. "This Week" is the remainder of the current
  // calendar week (after today); anything later falls through to Future.
  const groups = useMemo(() => {
    const weekEnd = endOfWeekISO(today);
    const open = filtered.filter((t) => !t.completed);
    const inSection = (key: string) =>
      open.filter((t) => dueSection(t.dueDate, today, weekEnd) === key).sort(byDue);
    return {
      overdue: inSection("overdue"),
      today: inSection("today"),
      week: inSection("week"),
      future: inSection("future"),
      none: inSection("none"),
      completed: filtered.filter((t) => t.completed).sort(byDue),
    };
  }, [filtered, today]);

  const sections: {
    key: string;
    title: string;
    tone: "default" | "overdue";
    /** Truncate to 3 rows with a "Show all …" reveal; the label is the due status. */
    truncateLabel?: string;
    tasks: TaskView[];
  }[] = [
    {
      key: "overdue",
      title: "Overdue",
      tone: "overdue" as const,
      truncateLabel: "overdue",
      tasks: groups.overdue,
    },
    { key: "today", title: "Today", tone: "default" as const, tasks: groups.today },
    { key: "week", title: "This Week", tone: "default" as const, tasks: groups.week },
    {
      key: "future",
      title: "Future",
      tone: "default" as const,
      truncateLabel: "future",
      tasks: groups.future,
    },
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

  // The list view is a fixed-height column so its rows scroll internally and
  // pagination stays pinned. The grouped view just lets the page scroll, so its
  // section cards size to their content instead of bunching up. In that view
  // the page padding sits INSIDE the scroll container (on an inner wrapper), so
  // rows scrolling past the sticky section headers are clipped at the very top
  // edge instead of peeking through the padding strip above them.
  const isList = view === "list";

  // Title + toolbar + filters. Its own card in the grouped view (where each
  // section is also a card); the head of the single card in the list view.
  const toolbar = (
    <>
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
                    <DropdownMenu.Item>Import Tasks</DropdownMenu.Item>
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
                <ButtonGroup aria-label="View switcher" className="ms-auto">
                  <Tooltip>
                    <Tooltip.Trigger
                      render={
                        <Button
                          variant="outline"
                          size="icon"
                          className={view === "grouped" ? "active" : ""}
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
                          variant="outline"
                          size="icon"
                          className={view === "list" ? "active" : ""}
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
                </ButtonGroup>
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
    </>
  );

  const empty = (
              <Empty className="py-6">
                <Empty.Media>
                  <FontAwesomeIcon icon={faListCheck} />
                </Empty.Media>
                <Empty.Content>
                  <Empty.Title>No tasks found</Empty.Title>
                  Try clearing filters or search, or add a new task.
                </Empty.Content>
              </Empty>
  );

  // Grouped: a stack of cards — the toolbar, then one per section — matching
  // the contact detail page, where each panel is its own card.
  if (!isList) {
    return (
      <div className="h-100 overflow-auto">
        <div
          className="p-4 mx-auto w-100 d-flex flex-column gap-3"
          style={{ maxWidth: "48rem" }}
        >
          <Card className="panel-card">
            <Card.Body className="d-flex flex-column gap-4">{toolbar}</Card.Body>
          </Card>

          {filtered.length === 0 ? (
            <Card className="panel-card">
              <Card.Body>{empty}</Card.Body>
            </Card>
          ) : (
            sections.map((s) => (
              <TaskGroup
                key={s.key}
                title={s.title}
                tone={s.tone}
                tasks={s.tasks}
                truncateLabel={s.truncateLabel}
                open={!collapsedSections[s.key]}
                onOpenChange={(open) => setSectionOpen(s.key, open)}
                onToggle={toggleComplete}
                onOpen={openTask}
              />
            ))
          )}
        </div>
      </div>
    );
  }

  // List: one card, since the rows are a single continuous surface whose
  // scrolling is bounded so the pagination stays pinned under them.
  return (
    <div className="h-100 overflow-hidden p-4 d-flex">
      <Card
        className="panel-card mx-auto w-100 flex-grow-1 d-flex flex-column overflow-hidden"
        style={{ maxWidth: "48rem" }}
      >
        <Card.Body className="d-flex flex-column gap-4 overflow-hidden">
            {toolbar}

            {filtered.length === 0 ? (
              empty
            ) : (
              // The rows scroll inside a bounded box so pagination stays visible.
              <div className="d-flex flex-column gap-3 flex-grow-1 overflow-hidden">
                <div className="border rounded-3 overflow-auto flex-grow-1">
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
  );
}

/**
 * A collapsible section for the grouped view — its own card, the same way each
 * panel on the contact detail page is. Uses Blueprint's Accordion so the
 * chevron matches the Contact Details accordions; the title matches their
 * 20px / 26px sizing. The header sticks to the top of the scrolling page while
 * the section's rows pass under it.
 *
 * Open/collapsed lives in `useTaskUiPrefs` (persists across navigation); the
 * `truncateLabel` reveal is local state, so it resets when the page unmounts.
 */
function TaskGroup({
  title,
  tone,
  tasks,
  truncateLabel,
  open,
  onOpenChange,
  onToggle,
  onOpen,
}: {
  title: string;
  tone: "default" | "overdue";
  tasks: TaskView[];
  truncateLabel?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToggle: (t: TaskView) => void;
  onOpen: (t: TaskView) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const truncated =
    !!truncateLabel && !showAll && tasks.length > COLLAPSED_ROWS;
  const visible = truncated ? tasks.slice(0, COLLAPSED_ROWS) : tasks;
  return (
    <Card className="panel-card">
    <Accordion
      multiple
      value={open ? ["open"] : []}
      onValueChange={(value) => onOpenChange(value.includes("open"))}
      className="tasks-group"
    >
      <Accordion.Item value="open">
        <Accordion.Trigger>
          <span className="d-flex align-items-center gap-2">
            <span
              className="fw-semibold"
              style={{ fontSize: 20, lineHeight: "26px" }}
            >
              {title}
            </span>
            <span
              className="tasks-group__count"
              data-tone={tone === "overdue" ? "overdue" : "default"}
            >
              {tasks.length}
            </span>
          </span>
        </Accordion.Trigger>
        <Accordion.Content>
          <div className="px-3">
            {visible.map((t) => (
              <TaskListRow
                key={t.id}
                task={t}
                onToggle={() => onToggle(t)}
                onOpen={() => onOpen(t)}
              />
            ))}
          </div>
          {truncated && (
            <div className="px-3 py-2 border-top">
              <Button variant="ghost" onClick={() => setShowAll(true)}>
                Show all {tasks.length} {truncateLabel} tasks
              </Button>
            </div>
          )}
        </Accordion.Content>
      </Accordion.Item>
    </Accordion>
    </Card>
  );
}
