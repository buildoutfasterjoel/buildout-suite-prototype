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
  composedToEvent,
  groupByBucket,
  needsAttention,
  visibleEvents,
  type FilterKey,
  type TimelineEvent as TimelineEventData,
} from "#/components/contacts/timeline";
import { buildContactTimeline } from "#/components/contacts/timelineArcs";
import { TimelineEvent } from "#/components/contacts/TimelineEvent";
import { TimelineFilterBar } from "#/components/contacts/TimelineFilterBar";
import { TimelineFilterDropdown } from "#/components/contacts/TimelineFilterDropdown";
import { useContactUiPrefs } from "#/components/contacts/useContactUiPrefs";

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
  const tabTrack = useContactUiPrefs((s) => s.tabTrack);
  const timelineFilter = useContactUiPrefs((s) => s.timelineFilter);
  const [filter, setFilter] = useState<FilterKey>("all");
  // "Needs Reply" quick filter (dropdown mode only) — attention rows only.
  const [needsReply, setNeedsReply] = useState(false);
  // Ephemeral per-event UI state (prototype — resets on reload).
  const [overrides, setOverrides] = useState<
    Record<string, { pinned?: boolean }>
  >({});
  const [deleted, setDeleted] = useState<Set<string>>(new Set());
  const [replyOpenId, setReplyOpenId] = useState<string | null>(null);
  const [threadOpenId, setThreadOpenId] = useState<string | null>(null);
  // Rows the broker has acted on (replied / responded / called back). Clears the
  // attention color + removes the reply options once handled.
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const resolve = (id: string) =>
    setResolved((r) => (r.has(id) ? r : new Set(r).add(id)));

  // The feed = session-logged compose/call events + the synthesized history,
  // with per-event pin overrides applied and deleted rows removed.
  const events = useMemo(() => {
    const base = [
      ...logged.map((l) => composedToEvent(l, contact)),
      ...buildContactTimeline(contact, deals),
    ];
    return base
      .filter((e) => !deleted.has(e.id))
      .map((e) => ({
        ...e,
        pinned: overrides[e.id]?.pinned ?? e.pinned,
      }));
  }, [logged, contact, deals, overrides, deleted]);

  const isUnhandled = (e: TimelineEventData) =>
    needsAttention(e) && !resolved.has(e.id);

  // Count of rows still needing a reply (shown against the "Needs Reply" filter).
  const attentionCount = useMemo(
    () => visibleEvents(events, "all").filter(isUnhandled).length,
    [events, resolved],
  );

  // "Needs Reply" only applies in the dropdown filter mode.
  const attentionOnly = timelineFilter === "dropdown" && needsReply;
  const groups = useMemo(
    () =>
      groupByBucket(
        visibleEvents(events, filter).filter((e) => !attentionOnly || isUnhandled(e)),
      ),
    [events, filter, attentionOnly, resolved],
  );

  // Single action dispatch for every row — the row itself has no side-effects.
  function handleAction(event: TimelineEventData, id: string) {
    if (id === "Pin to top") {
      setOverrides((o) => ({
        ...o,
        [event.id]: { ...o[event.id], pinned: !(o[event.id]?.pinned ?? event.pinned) },
      }));
    } else if (/^(Reply|Reply all|Forward|Respond)$/.test(id)) {
      setReplyOpenId((cur) => (cur === event.id ? null : event.id));
    } else if (id === "Call back" || id === "Dismiss") {
      // "Call back" is itself the follow-up; "Dismiss" is "seen it, no response
      // needed". Either way the row is handled — clear its attention state
      // (greys the icon, removes the action bar) without logging anything.
      resolve(event.id);
    } else if (id === "View full thread") {
      setThreadOpenId((cur) => (cur === event.id ? null : event.id));
    } else if (id === "Delete") {
      // eslint-disable-next-line no-alert
      if (window.confirm("Delete this event from the timeline?")) {
        setDeleted((d) => new Set(d).add(event.id));
      }
    }
    // Other actions (Create task, Associate, …) are prototype no-ops — they
    // still dispatch through here so wiring stays centralized.
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
    // Replying handles the inbound email/thread — drop its attention state.
    resolve(event.id);
  }

  return (
    <div className={`d-flex flex-column gap-4 tabtrack tabtrack--${tabTrack}`}>
      {/* Composer card — the "Log Activity" title shares the header row with
          the compose tabs. */}
      <Card className="panel-card overflow-hidden">
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
              Log Activity
            </span>
          }
        />
      </Card>

      {/* Timeline card — "Timeline" title shares the header row with the filter
          pills (same pattern as the composer), then the grouped feed. */}
      <Card className="panel-card overflow-hidden">
        <div className="compose-header">
          <span
            className="fw-semibold"
            style={{ fontSize: 20, lineHeight: "26px" }}
          >
            Timeline
          </span>
          {timelineFilter === "dropdown" ? (
            <TimelineFilterDropdown
              events={events}
              value={filter}
              onChange={setFilter}
              needsReply={needsReply}
              onNeedsReplyChange={setNeedsReply}
              attentionCount={attentionCount}
            />
          ) : (
            <TimelineFilterBar events={events} value={filter} onChange={setFilter} />
          )}
        </div>

        <div className="d-flex flex-column gap-3 p-4">
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
                        attention={
                          needsAttention(event) && !resolved.has(event.id)
                        }
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
        </div>
      </Card>
    </div>
  );
}
