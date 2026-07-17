import { useMemo, useState } from "react";
import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import type { Contact, DealSummary } from "#/data/types";
import {
  ContactComposeModule,
  type ComposedDraft,
} from "#/components/contacts/ContactComposeModule";
import {
  todayISO,
  type ComposedActivity,
} from "#/components/contacts/contactDisplay";
import {
  buildTimeline,
  composedToEvent,
  groupByBucket,
  visibleEvents,
  type FilterKey,
  type TimelineEvent as TimelineEventData,
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
  // Ephemeral per-event UI state (prototype — resets on reload).
  const [overrides, setOverrides] = useState<
    Record<string, { starred?: boolean; pinned?: boolean }>
  >({});
  const [deleted, setDeleted] = useState<Set<string>>(new Set());
  const [replyOpenId, setReplyOpenId] = useState<string | null>(null);
  const [threadOpenId, setThreadOpenId] = useState<string | null>(null);

  // The feed = session-logged compose/call events + the synthesized history,
  // with per-event star/pin overrides applied and deleted rows removed.
  const events = useMemo(() => {
    const base = [
      ...logged.map((l) => composedToEvent(l, contact)),
      ...buildTimeline(contact, deals),
    ];
    return base
      .filter((e) => !deleted.has(e.id))
      .map((e) => ({
        ...e,
        starred: overrides[e.id]?.starred ?? e.starred,
        pinned: overrides[e.id]?.pinned ?? e.pinned,
      }));
  }, [logged, contact, deals, overrides, deleted]);

  const groups = useMemo(
    () => groupByBucket(visibleEvents(events, filter)),
    [events, filter],
  );

  // Single action dispatch for every row — the row itself has no side-effects.
  function handleAction(event: TimelineEventData, id: string) {
    if (id === "Star") {
      setOverrides((o) => ({
        ...o,
        [event.id]: { ...o[event.id], starred: !(o[event.id]?.starred ?? event.starred) },
      }));
    } else if (id === "Pin to top") {
      setOverrides((o) => ({
        ...o,
        [event.id]: { ...o[event.id], pinned: !(o[event.id]?.pinned ?? event.pinned) },
      }));
    } else if (/^(Reply|Reply all|Forward|Respond)$/.test(id)) {
      setReplyOpenId((cur) => (cur === event.id ? null : event.id));
    } else if (id === "View full thread") {
      setThreadOpenId((cur) => (cur === event.id ? null : event.id));
    } else if (id === "Delete") {
      // eslint-disable-next-line no-alert
      if (window.confirm("Delete this event from the timeline?")) {
        setDeleted((d) => new Set(d).add(event.id));
      }
    }
    // Other actions (Call back, Create task, Associate, …) are prototype no-ops
    // — they still dispatch through here so wiring stays centralized.
  }

  function handleReplySend(event: TimelineEventData, text: string) {
    const subj = event.subject
      ? event.subject.startsWith("Re:")
        ? event.subject
        : `Re: ${event.subject}`
      : `Re: ${contact.firstName}`;
    onLog({
      kind: "email",
      body: text,
      subject: subj,
      to: contact.email,
      date: todayISO(),
    });
    setReplyOpenId(null);
  }

  return (
    <div className="d-flex flex-column gap-4">
      {/* Composer card — the "Activity" title shares the header row with the
          compose tabs. */}
      <Card className="contact-panel-card overflow-hidden">
        <ContactComposeModule
          contact={contact}
          deals={deals}
          onSubmit={onLog}
          onStartCall={onStartCall}
          headerStart={
            <span
              className="fw-semibold"
              style={{ fontSize: 20, lineHeight: "26px" }}
            >
              Activity
            </span>
          }
        />
      </Card>

      {/* Timeline card — filter pills + the grouped feed. */}
      <Card className="contact-panel-card overflow-hidden">
        <Card.Body className="d-flex flex-column gap-3">
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
                      <TimelineEvent
                        key={event.id}
                        event={event}
                        starred={!!event.starred}
                        pinned={!!event.pinned}
                        replyOpen={replyOpenId === event.id}
                        threadOpen={threadOpenId === event.id}
                        onAction={(id) => handleAction(event, id)}
                        onReplySend={(text) => handleReplySend(event, text)}
                        onReplyCancel={() => setReplyOpenId(null)}
                      />
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
