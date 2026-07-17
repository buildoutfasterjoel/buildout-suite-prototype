import { useMemo, useState } from "react";
import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPhone,
  faEnvelope,
  faNoteSticky,
  faCalendar,
  faBinoculars,
  faHandshake,
  faFlag,
} from "@fortawesome/pro-regular-svg-icons";
import { faSparkles } from "@fortawesome/pro-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import type { Contact, DealSummary } from "#/data/types";
import {
  ContactComposeModule,
  type ComposedDraft,
} from "#/components/contacts/ContactComposeModule";
import {
  buildActivity,
  buildBriefing,
  buildLastTouch,
  medDate,
  COMPOSE_TIMELINE_TITLE,
  type ComposeKind,
  type ComposedActivity,
} from "#/components/contacts/contactDisplay";

type ActivityFilter = "all" | "calls" | "emails" | "notes";

/** Timeline avatar: icon + circle color (CSS-var hex) per logged kind. */
const KIND_VISUAL: Record<ComposeKind, { icon: IconDefinition; color: string }> = {
  note: { icon: faNoteSticky, color: "var(--color-purple-heart-500, #9f55f7)" },
  call: { icon: faPhone, color: "var(--color-mountain-meadow-500, #00bc7d)" },
  email: { icon: faEnvelope, color: "var(--color-buildout-blue-500, #3f86f2)" },
  meeting: { icon: faCalendar, color: "var(--color-harvest-gold-500, #fd9a00)" },
  tour: { icon: faBinoculars, color: "var(--color-seagull-500, #17a2b8)" },
};

const FILTER_KIND: Record<Exclude<ActivityFilter, "all">, ComposeKind> = {
  calls: "call",
  emails: "email",
  notes: "note",
};

/** A circular icon badge used for every timeline row. */
function TimelineIcon({
  icon,
  color,
}: {
  icon: IconDefinition;
  color?: string;
}) {
  return (
    <span
      className="d-inline-flex align-items-center justify-content-center text-white flex-shrink-0 rounded-circle"
      style={{ width: 32, height: 32, background: color ?? "#8495ac" }}
    >
      <FontAwesomeIcon icon={icon} />
    </span>
  );
}

export function ContactEngagementPanel({
  contact,
  deals,
  logged,
  onLog,
  onStartCall,
}: {
  contact: Contact;
  deals: DealSummary[];
  /** Activities logged this session (owned by the page), newest first. */
  logged: ComposedActivity[];
  onLog: (draft: ComposedDraft) => void;
  onStartCall: (phone: string) => void;
}) {
  const [filter, setFilter] = useState<ActivityFilter>("all");

  const activity = useMemo(() => buildActivity(contact, deals), [contact, deals]);
  const briefing = useMemo(() => buildBriefing(contact, deals), [contact, deals]);
  const lastTouch = useMemo(() => buildLastTouch(contact), [contact]);

  // Counts drive the filter chips; logged is always supplied by the page.
  const counts: Record<ActivityFilter, number> = {
    all: logged.length + activity.length,
    calls: logged.filter((l) => l.kind === "call").length,
    emails: logged.filter((l) => l.kind === "email").length,
    notes: logged.filter((l) => l.kind === "note").length,
  };
  const filters: { key: ActivityFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "calls", label: "Calls" },
    { key: "emails", label: "Emails" },
    { key: "notes", label: "Notes" },
  ];

  // Logged items shown for the active filter (synthesized rows only under "All").
  const visibleLogged =
    filter === "all"
      ? logged
      : logged.filter((l) => l.kind === FILTER_KIND[filter]);
  const showSynthesized = filter === "all";
  const isEmpty = visibleLogged.length === 0 && !showSynthesized;

  return (
    <div className="d-flex flex-column gap-4">
      {/* Engagement composer */}
      <ContactComposeModule
        contact={contact}
        deals={deals}
        onSubmit={onLog}
        onStartCall={onStartCall}
      />

      {/* Activity */}
      <Card className="shadow-sm">
        <Card.Body className="d-flex flex-column gap-3">
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
            <Card.Title
              className="fw-semibold d-inline-flex align-items-center gap-2"
              style={{ fontSize: 20, lineHeight: "26px" }}
            >
              Activity
              <Badge variant="secondary" appearance="muted" className="fs-xs">
                {counts.all}
              </Badge>
            </Card.Title>
            <div className="d-flex align-items-center gap-1">
              {filters.map((f) => (
                <Button
                  key={f.key}
                  variant="ghost"
                  size="sm"
                  className={filter === f.key ? "active" : undefined}
                  onClick={() => setFilter(f.key)}
                >
                  {f.label} <span className="text-muted ms-1">{counts[f.key]}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* AI briefing — soft gradient summary pinned above the timeline */}
          <div
            className="rounded-2 p-3 d-flex flex-column gap-2"
            style={{
              border: "1px solid #e7d5ff",
              backgroundImage:
                "linear-gradient(90deg, rgba(255,255,255,0.85), rgba(255,255,255,0.85)), linear-gradient(90deg, #b88cf2 0%, #8ca6f7 50%, #61c2ff 100%)",
            }}
          >
            <div className="d-flex align-items-center justify-content-between gap-2">
              <span
                className="d-inline-flex align-items-center gap-2 fw-semibold text-body-emphasis lh-sm"
                style={{ fontSize: 17 }}
              >
                <FontAwesomeIcon
                  icon={faSparkles}
                  style={{ color: "#9f55f7", fontSize: 14 }}
                />
                Briefing
              </span>
              <span className="text-muted fs-small text-nowrap">
                Last touch: <span className="fw-bold">{lastTouch}</span>
              </span>
            </div>
            <p className="mb-0">{briefing}</p>
          </div>

          {isEmpty ? (
            <span className="text-muted fs-small">No activity to show.</span>
          ) : (
            <div className="d-flex flex-column gap-3">
              {visibleLogged.map((l) => (
                <LoggedRow key={l.id} entry={l} />
              ))}
              {showSynthesized &&
                activity.map((a, i) => (
                  <div key={`synth-${i}`} className="d-flex align-items-center gap-3">
                    <TimelineIcon
                      icon={a.kind === "deal" ? faHandshake : faFlag}
                      color={
                        a.kind === "deal"
                          ? "var(--color-buildout-blue-500, #3f86f2)"
                          : "#8495ac"
                      }
                    />
                    <span className="flex-grow-1">{a.label}</span>
                    <span className="text-muted fs-small text-nowrap">
                      {medDate(a.date)}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}

/** One logged-activity row in the timeline. */
function LoggedRow({ entry }: { entry: ComposedActivity }) {
  const visual = KIND_VISUAL[entry.kind];
  const secondary =
    entry.kind === "email" && entry.subject ? entry.subject : entry.body;
  return (
    <div className="d-flex align-items-start gap-3">
      <TimelineIcon icon={visual.icon} color={visual.color} />
      <div className="flex-grow-1 min-w-0">
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <span className="fw-semibold">{COMPOSE_TIMELINE_TITLE[entry.kind]}</span>
          {entry.outcome && (
            <Badge variant="secondary" appearance="muted" className="fs-xs">
              {entry.outcome}
            </Badge>
          )}
          {entry.relatedDeal && (
            <span className="text-muted fs-small d-inline-flex align-items-center gap-1">
              <FontAwesomeIcon icon={faHandshake} />
              {entry.relatedDeal}
            </span>
          )}
        </div>
        {secondary && <p className="mb-0 text-body-secondary">{secondary}</p>}
      </div>
      <span className="text-muted fs-small text-nowrap">{medDate(entry.date)}</span>
    </div>
  );
}
