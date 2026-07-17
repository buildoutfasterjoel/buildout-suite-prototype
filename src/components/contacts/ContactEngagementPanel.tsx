import { useMemo, useState } from "react";
import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSparkles } from "@fortawesome/pro-solid-svg-icons";
import type { Contact, DealSummary } from "#/data/types";
import {
  ContactComposeModule,
  type ComposedDraft,
} from "#/components/contacts/ContactComposeModule";
import {
  buildBriefing,
  buildLastTouch,
  type ComposedActivity,
} from "#/components/contacts/contactDisplay";
import {
  buildTimeline,
  composedToEvent,
  groupByBucket,
  matchesFilter,
  type FilterKey,
} from "#/components/contacts/timeline";
import { TimelineEvent } from "#/components/contacts/TimelineEvent";
import { TimelineFilterBar } from "#/components/contacts/TimelineFilterBar";

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
  const [filter, setFilter] = useState<FilterKey>("all");

  const briefing = useMemo(() => buildBriefing(contact, deals), [contact, deals]);
  const lastTouch = useMemo(() => buildLastTouch(contact), [contact]);

  // The feed = session-logged compose/call events + the synthesized history.
  const events = useMemo(
    () => [
      ...logged.map((l) => composedToEvent(l, contact)),
      ...buildTimeline(contact, deals),
    ],
    [logged, contact, deals],
  );

  const groups = useMemo(
    () => groupByBucket(events.filter((e) => matchesFilter(e, filter))),
    [events, filter],
  );

  return (
    <div className="d-flex flex-column gap-4">
      {/* Engagement composer */}
      <ContactComposeModule
        contact={contact}
        deals={deals}
        onSubmit={onLog}
        onStartCall={onStartCall}
      />

      {/* Activity timeline */}
      <Card className="shadow-sm">
        <Card.Body className="d-flex flex-column gap-3">
          <Card.Title
            className="fw-semibold"
            style={{ fontSize: 20, lineHeight: "26px" }}
          >
            Activity
          </Card.Title>

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

          <TimelineFilterBar events={events} value={filter} onChange={setFilter} />

          {groups.length === 0 ? (
            <span className="text-muted fs-small">No activity to show.</span>
          ) : (
            <Tooltip.Provider delay={200}>
              <div className="tl-feed">
                {groups.map((group) => (
                  <section key={group.bucket} className="tl-group">
                    <div className="tl-group__header">{group.bucket}</div>
                    {group.events.map((event) => (
                      <TimelineEvent key={event.id} event={event} />
                    ))}
                  </section>
                ))}
              </div>
            </Tooltip.Provider>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}
