import { useState } from "react";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";
import { Progress } from "@buildoutinc/blueprint-react/ui/Progress";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheck,
  faCalendar,
  faPhone,
  faEnvelope,
  faNoteSticky,
  faClockRotateLeft,
  faCirclePlus,
  faArrowRotateRight,
} from "@fortawesome/pro-regular-svg-icons";
import type { DealHistoryEntry, DealTask, Listing, ListingStage } from "#/data/types";
import { STATUS_COLORS } from "#/components/properties/propertyDisplay";
import { ListingPageHeader } from "../listings/ListingPageHeader";
import { cn } from "@buildoutinc/blueprint-react/lib/utils";

const SPINE = "#e2e8f0";

/** "3 AUG, 2026" — the compact planner date style. */
export function formatPlannerDate(iso: string | null): string {
  if (!iso) return "TBD";
  const d = new Date(iso);
  const mon = d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }).toUpperCase();
  return `${d.getUTCDate()} ${mon}, ${d.getUTCFullYear()}`;
}

/** `iso` shifted by `days`, as a full ISO timestamp. */
function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

const STAGE_START_LABEL: Record<ListingStage, string> = {
  proposal: "Listing executed",
  active: "Listing went live",
  "under-contract": "Contract executed",
  closed: "Contract executed",
  inactive: "Listing withdrawn",
};

/**
 * When did the listing enter its current stage? Reads the most recent
 * history entry that transitioned *into* the current stage; falls back to
 * `createdAt` (true for `proposal`, and a safe default otherwise).
 */
export function stageStartDate(
  history: DealHistoryEntry[],
  status: ListingStage,
  createdAt: string,
): string {
  const entry = history.slice().reverse().find((h) => h.toStage === status);
  return entry?.timestamp ?? createdAt;
}

/**
 * The timeline's closing marker for the current stage, or `null` when the
 * stage has no forward milestone (e.g. an inactive listing just... stops).
 */
export function endMilestone(
  status: ListingStage,
  start: string,
  closeDate: string | null,
): { label: string; date: string } | null {
  switch (status) {
    case "proposal":
      return { label: "Listing expires", date: addDays(start, 180) };
    case "active":
      return { label: "Listing agreement renews", date: addDays(start, 180) };
    case "under-contract":
      return { label: "Target closing", date: addDays(start, 45) };
    case "closed":
      return { label: "Closed", date: closeDate ?? addDays(start, 45) };
    case "inactive":
      return null;
  }
}

/** Borderless section with a rail-style h6 heading (+ optional action). */
function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="d-flex align-items-center justify-content-between gap-2 mb-3">
        <h6 className="mb-0">{title}</h6>
        {action}
      </div>
      {children}
    </section>
  );
}

type SpinePosition = "start" | "middle" | "end";

/** A row on the planner timeline: a marker in the gutter, connected by the spine. */
function PlannerRow({
  marker,
  spine,
  right,
  children,
}: {
  marker: React.ReactNode;
  spine: SpinePosition;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="position-relative d-flex align-items-center gap-3 py-3">
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: 15,
          width: 2,
          background: SPINE,
          top: spine === "start" ? "50%" : 0,
          bottom: spine === "end" ? "50%" : 0,
        }}
      />
      <span
        className="flex-shrink-0 d-flex justify-content-center"
        style={{ width: 32, position: "relative" }}
      >
        {marker}
      </span>
      <div className="flex-grow-1" style={{ minWidth: 0 }}>
        {children}
      </div>
      {right}
    </div>
  );
}

function MilestoneMarker({ accent }: { accent: string }) {
  const tile = `color-mix(in srgb, ${accent} 12%, var(--bs-card-bg, #fff))`;
  return (
    <span
      className="d-inline-flex align-items-center justify-content-center rounded"
      style={{ width: 32, height: 32, backgroundColor: tile, color: accent }}
    >
      <FontAwesomeIcon icon={faCalendar} />
    </span>
  );
}

function TaskMarker({
  complete,
  onToggle,
}: {
  complete: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={complete ? "Mark task incomplete" : "Mark task complete"}
      className="btn btn-link p-0 border-0"
      style={{ lineHeight: 0 }}
    >
      <span
        className={cn('d-inline-flex align-items-center justify-content-center border border-2 rounded-3', {
          'text-bg-accent': complete,
          'bg-card': !complete,
        })}
        style={{
          width: 22,
          height: 22,
          color: "#fff",
          fontSize: 11,
        }}
      >
        {complete && <FontAwesomeIcon icon={faCheck} />}
      </span>
    </button>
  );
}

function Milestone({
  label,
  date,
  spine,
  accent,
}: {
  label: string;
  date: string | null;
  spine: SpinePosition;
  accent: string;
}) {
  return (
    <PlannerRow marker={<MilestoneMarker accent={accent} />} spine={spine}>
      <div className="fw-semibold">{label}</div>
      <div className="fw-semibold" style={{ fontSize: 13, color: accent }}>
        {formatPlannerDate(date)}
      </div>
    </PlannerRow>
  );
}

function TaskRow({ task, onToggle }: { task: DealTask; onToggle: () => void }) {
  const complete = task.status === "complete";
  const showReview = task.autoGenerated && complete;

  return (
    <PlannerRow
      spine="middle"
      marker={<TaskMarker complete={complete} onToggle={onToggle} />}
      right={
        showReview ? (
          <Button variant="outline" size="sm" className="flex-shrink-0">
            Review
          </Button>
        ) : (
          <Avatar size="sm" className="flex-shrink-0">
            <Avatar.Fallback>{task.assigneeInitials}</Avatar.Fallback>
          </Avatar>
        )
      }
    >
      <div className="fw-semibold">{task.label}</div>
      {task.detail && (
        <div className="text-muted" style={{ fontSize: 13 }}>
          {task.detail}
        </div>
      )}
      {!complete && task.date && (
        <div className="text-muted" style={{ fontSize: 13 }}>
          {formatPlannerDate(task.date)}
          {task.relativeDue ? ` · ${task.relativeDue}` : ""}
        </div>
      )}
    </PlannerRow>
  );
}

function Planner({ listing }: { listing: Listing }) {
  const [tasks, setTasks] = useState<DealTask[]>(listing.tasks);
  const accent = STATUS_COLORS[listing.status];

  const done = tasks.filter((t) => t.status === "complete").length;
  const total = tasks.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const toggle = (id: string) =>
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, status: t.status === "complete" ? "open" : "complete" }
          : t,
      ),
    );

  const start = stageStartDate(listing.history, listing.status, listing.createdAt);
  const end = endMilestone(listing.status, start, listing.voucher.closeDate);

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-2">
        <span className="fw-semibold">
          {done} of {total} tasks done
        </span>
        <span className="fw-semibold" style={{ color: accent }}>
          {pct}%
        </span>
      </div>
      <Progress value={pct} />

      <div className="mt-3">
        <Milestone
          label={STAGE_START_LABEL[listing.status]}
          date={start}
          spine="start"
          accent={accent}
        />
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} onToggle={() => toggle(t.id)} />
        ))}
        {end && (
          <Milestone label={end.label} date={end.date} spine="end" accent={accent} />
        )}
      </div>
    </>
  );
}

function Activity() {
  return (
    <Section title="Activity Timeline">
      <div className="d-flex gap-2 mb-3">
        <Button variant="outline" size="sm">
          <FontAwesomeIcon icon={faPhone} />
          Log call
        </Button>
        <Button variant="outline" size="sm">
          <FontAwesomeIcon icon={faEnvelope} />
          Log email
        </Button>
        <Button variant="outline" size="sm">
          <FontAwesomeIcon icon={faNoteSticky} />
          Add note
        </Button>
      </div>
      <Empty className="py-4">
        <Empty.Media>
          <FontAwesomeIcon icon={faClockRotateLeft} aria-hidden />
        </Empty.Media>
        <Empty.Content>
          <Empty.Title>No activity logged yet</Empty.Title>
          Log a call, email, or note above.
        </Empty.Content>
      </Empty>
    </Section>
  );
}

function HeaderActions({ listing }: { listing: Listing }) {
  if (listing.status === "inactive") {
    return (
      <Button variant="primary">
        <FontAwesomeIcon icon={faArrowRotateRight} />
        Relist
      </Button>
    );
  }
  return (
    <div className="d-flex align-items-center gap-1">
      <Button variant="ghost">
        <FontAwesomeIcon icon={faCirclePlus} />
        Add task
      </Button>
      <Button variant="ghost">
        <FontAwesomeIcon icon={faCirclePlus} />
        Add critical date
      </Button>
    </div>
  );
}

/**
 * The "Today" tab: an action-oriented planner (progress bar + milestone
 * timeline) plus an activity timeline — always the first thing a broker sees
 * for a listing, regardless of its stage. Content (milestones, tasks, header
 * actions) adapts to `listing.status`; the shape stays constant. Files and
 * deal facts live in the persistent right rail; sections here are separated
 * by whitespace rather than card borders, since the page already sits inside
 * the detail card.
 */
export function TodayPlanner({ listing }: { listing: Listing }) {
  return (
    <div className="d-flex flex-column gap-5 p-4">
      <ListingPageHeader title="Planner" actions={<HeaderActions listing={listing} />} />
      <Planner listing={listing} />
      <Activity />
    </div>
  );
}
