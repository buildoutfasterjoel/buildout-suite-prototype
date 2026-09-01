import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { Tabs } from "@buildoutinc/blueprint-react/ui/Tabs";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faListCheck, faWavePulse } from "@fortawesome/pro-regular-svg-icons";
import type { Contact, DealSummary } from "#/data/types";
import {
  ContactComposeModule,
  type ComposedDraft,
} from "#/components/contacts/ContactComposeModule";
import {
  contactFullName,
  contactInitials,
  type ComposedActivity,
} from "#/components/contacts/contactDisplay";
import { notify } from "#/lib/notify";
import { CURRENT_USER } from "#/data/teammates";
import {
  composedToEvent,
  foldThreads,
  groupByBucket,
  needsAttention,
  visibleEvents,
  type FilterKey,
  type SessionReply,
  type TimelineEvent as TimelineEventData,
} from "#/components/contacts/timeline";
import { buildContactTimeline } from "#/components/contacts/timelineArcs";
import { TimelineEvent } from "#/components/contacts/TimelineEvent";
import { TimelineFilterBar } from "#/components/contacts/TimelineFilterBar";
import { TimelineFilterDropdown } from "#/components/contacts/TimelineFilterDropdown";
import { AddTaskAction } from "#/components/contacts/ContactTasksPanel";
import { useContactUiPrefs } from "#/components/contacts/useContactUiPrefs";
import {
  recordEngagement,
  selectResolved,
  selectSimEvents,
  useContactSession,
} from "#/components/contacts/useContactSession";
import { useDealSpotlight } from "#/components/contacts/useDealSpotlight";
import { AiDealProgressModal } from "#/components/deals/AiDealProgressModal";
import { requestStageChange } from "#/components/deals/useStageGate";
import { getListingsForProperty, getProperty } from "#/data/store";
import { createRosaProposalDeal } from "#/components/call/rosaDeal";
import { ROSA_FINANCIAL_DOCS } from "#/components/call/rosaDocs";
import { ROSA_AGREEMENT_EMAIL_ID } from "#/components/call/rosaClosing";

/** The panes the "tabs" narrow layout folds into one card. */
type PaneKey = "timeline" | "tasks";

export function ContactEngagementPanel({
  contact,
  deals,
  logged,
  onLog,
  onStartCall,
  narrowSlot,
  sideTabs,
}: {
  contact: Contact;
  deals: DealSummary[];
  /** Activities logged this session (owned by the page), newest first. */
  logged: ComposedActivity[];
  onLog: (draft: ComposedDraft) => void;
  onStartCall: (phone: string) => void;
  /**
   * Cards that belong to the right column on a wide screen and move in here when
   * it goes away ("stacked" narrow layout). Rendered between Activity and the
   * Timeline — above the feed, because they're what you check before reading it.
   */
  narrowSlot?: ReactNode;
  /**
   * The "tabs" narrow layout: Tasks becomes a tab alongside the Timeline in one
   * card rather than a card of its own. The timeline state all lives here, so the
   * panel owns the tab strip and the route just supplies the Tasks panel.
   *
   * Briefing is deliberately NOT a tab — it arrives through `narrowSlot` above
   * the feed in both arrangements, because it's read on the way past rather than
   * navigated to.
   */
  sideTabs?: { tasks: ReactNode; taskCount: number };
}) {
  const tabTrack = useContactUiPrefs((s) => s.tabTrack);
  const timelineFilter = useContactUiPrefs((s) => s.timelineFilter);
  const [filter, setFilter] = useState<FilterKey>("all");
  // Which pane the "tabs" narrow layout is showing. Harmless when `sideTabs` is
  // absent, and holding it here means resizing back and forth doesn't lose it.
  const [pane, setPane] = useState<PaneKey>("timeline");
  // "Needs Reply" quick filter (dropdown mode only) — attention rows only.
  const [needsReply, setNeedsReply] = useState(false);
  // Ephemeral per-event UI state (prototype — resets on reload).
  const [overrides, setOverrides] = useState<
    Record<string, { pinned?: boolean }>
  >({});
  const [deleted, setDeleted] = useState<Set<string>>(new Set());
  // Replies the broker sent from the timeline this session, keyed by the event
  // they answered. `foldThreads` merges them into that exchange rather than
  // adding a row, and the conversation takes the new message's date — which is
  // what carries it back to the top of the feed.
  const [threadReplies, setThreadReplies] = useState<
    Record<string, SessionReply[]>
  >({});
  const [replyOpenId, setReplyOpenId] = useState<string | null>(null);
  // Inside an expanded thread the editor hangs under one specific message, so
  // the row needs to know which — null means "at the end of the row".
  const [replyMessageId, setReplyMessageId] = useState<string | null>(null);
  const [threadOpenId, setThreadOpenId] = useState<string | null>(null);
  // Rows the broker has acted on (replied / responded / called back) and the
  // simulated inbound events — both live in the contact-session store so
  // navigating away and back keeps the timeline where it was.
  const resolvedIds = useContactSession(selectResolved(contact.id));
  const resolved = useMemo(() => new Set(resolvedIds), [resolvedIds]);
  const resolve = (id: string) =>
    useContactSession.getState().resolve(contact.id, id);
  const simEvents = useContactSession(selectSimEvents(contact.id));

  // Simulated events that just landed play a one-shot entrance highlight.
  // Freshness is derived from the event's own arrival timestamp — no extra
  // state, and a row revisited later (or after navigation) renders plain.
  const arrivingIds = useMemo(() => {
    const now = Date.now();
    return new Set(
      simEvents
        .filter((e) => now - new Date(e.timestamp).getTime() < 5_000)
        .map((e) => e.id),
    );
  }, [simEvents]);

  // The AI Start-a-Deal flow: holds the id of the email row it launched from
  // (null = modal closed) so the row can be resolved once the deal exists.
  const [aiDealFromEventId, setAiDealFromEventId] = useState<string | null>(
    null,
  );
  // The property the AI deal lands on — the contact's owned building.
  const ownedProperty = contact.ownedPropertyIds?.[0]
    ? getProperty(contact.ownedPropertyIds[0])
    : undefined;

  // The agreement row's Activate action lands the deal at Active; once it does,
  // the row resolves. The gate can be cancelled, so clicking alone doesn't
  // resolve it — the deal's real status does.
  useEffect(() => {
    if (!ownedProperty) return;
    const activated = deals.some(
      (d) => d.propertyId === ownedProperty.id && d.status === "active",
    );
    if (activated) {
      resolve(ROSA_AGREEMENT_EMAIL_ID);
    }
    // `resolve` is a stable-behaving setState wrapper.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deals, ownedProperty]);

  /** Open the overview column's Deals section and spotlight one card. */
  const revealDeal = (dealId: string) => {
    const prefs = useContactUiPrefs.getState();
    if (!prefs.overviewSections.includes("deals")) {
      prefs.setOverviewSections([...prefs.overviewSections, "deals"]);
    }
    useDealSpotlight.getState().spotlight(dealId);
  };

  /**
   * The "AI scanned the docs" payoff: create the deal it was reading toward and
   * surface its card — nothing more. The underwriting is the broker's next
   * move, taken from the card's "Build Underwriting" button (which opens the
   * Cactus strategy/depth setup, then the BOV wizard) rather than auto-starting.
   */
  const completeAiDeal = () => {
    const fromEventId = aiDealFromEventId;
    setAiDealFromEventId(null);
    if (!ownedProperty) return;
    // Replayed-demo guard: if the building already has a deal, don't stack a
    // duplicate — point at the existing card instead.
    const existing = getListingsForProperty(ownedProperty.id)[0];
    if (existing) {
      notify({
        title: "Deal already exists",
        description: `${ownedProperty.name} already has an open deal.`,
      });
      revealDeal(existing.id);
      if (fromEventId) resolve(fromEventId);
      return;
    }
    const { deal } = createRosaProposalDeal(contact, ownedProperty);
    notify({
      title: "Deal created",
      description: `${ownedProperty.name} — Pitching`,
    });
    // The email that carried the documents has been acted on.
    if (fromEventId) resolve(fromEventId);
    revealDeal(deal.id);
  };

  // The feed = session-logged compose/call events + simulated inbound events +
  // the synthesized history, with per-event pin overrides applied and deleted
  // rows removed.
  const events = useMemo(() => {
    const base = [
      ...logged.map((l) => composedToEvent(l, contact)),
      ...simEvents,
      ...buildContactTimeline(contact, deals),
    ];
    return foldThreads(base, threadReplies)
      .filter((e) => !deleted.has(e.id))
      .map((e) => ({
        ...e,
        pinned: overrides[e.id]?.pinned ?? e.pinned,
      }));
  }, [logged, simEvents, contact, deals, overrides, deleted, threadReplies]);

  // Every reply from this record goes to the contact — the timeline is theirs.
  const replyTo = useMemo(
    () => ({
      name: contactFullName(contact),
      email: contact.email,
      initials: contactInitials(contact),
    }),
    [contact],
  );

  const isUnhandled = (e: TimelineEventData) =>
    needsAttention(e) && !resolved.has(e.id);

  // Count of rows still needing a reply (shown against the "Needs Reply" filter).
  const attentionCount = useMemo(
    () => visibleEvents(events, "all").filter(isUnhandled).length,
    [events, resolved],
  );
  // Total rows the feed would show unfiltered — the Timeline tab's badge.
  const timelineCount = useMemo(() => visibleEvents(events, "all").length, [events]);

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
  function handleAction(
    event: TimelineEventData,
    id: string,
    messageId?: string,
  ) {
    if (id === "Pin to top") {
      setOverrides((o) => ({
        ...o,
        [event.id]: { ...o[event.id], pinned: !(o[event.id]?.pinned ?? event.pinned) },
      }));
    } else if (/^(Reply|Reply all|Forward|Respond)$/.test(id)) {
      const sameTarget =
        replyOpenId === event.id && (replyMessageId ?? null) === (messageId ?? null);
      setReplyOpenId(sameTarget ? null : event.id);
      setReplyMessageId(sameTarget ? null : (messageId ?? null));
    } else if (id === "Call back" || id === "Call") {
      // Calling back runs the real simulated call flow (calling → ringing →
      // connected → mandatory log) — the hang-up recap is what drives the
      // hero arc (financials email → underwrite → BOV → …) from the sidebar.
      onStartCall(contact.phone);
      if (id === "Call back") resolve(event.id);
    } else if (id === "Dismiss") {
      // "Seen it, no response needed" — clear the row's attention state (greys
      // the icon, removes the action bar) without logging anything.
      resolve(event.id);
    } else if (id === "Start a Deal") {
      // Kick off the AI deal flow — the progress modal runs the scan/map/create
      // theater, then `completeAiDeal` creates the real deal.
      setAiDealFromEventId(event.id);
    } else if (id === "Activate Listing") {
      // Route through the standard stage gate (Approve & Publish). Committing it
      // moves the deal to Active and reconciles Rosa's contact stage; the row
      // resolves via the arc-complete effect once the move commits.
      const deal = ownedProperty
        ? getListingsForProperty(ownedProperty.id)[0]
        : undefined;
      if (deal) requestStageChange(deal.id, "active");
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
    // A reply advances an exchange; it isn't a separate thing that happened. So
    // it attaches to the event it answers (see foldThreads) rather than going
    // through onLog, which would leave a second row saying the same thing.
    const now = new Date().toISOString();
    // A conversation row is synthesized from its members, so its own id changes
    // as the thread grows — anchor the reply to the thread instead.
    const key = event.threadId ?? event.id;
    setThreadReplies((prev) => ({
      ...prev,
      [key]: [
        ...(prev[key] ?? []),
        { id: `${key}-reply-${(prev[key]?.length ?? 0) + 1}`, body: text, timestamp: now, sender: CURRENT_USER.name },
      ],
    }));
    setReplyOpenId(null);
    setReplyMessageId(null);
    // Replying handles the inbound email/thread — drop its attention state.
    resolve(event.id);
    // A reply is an email sent, so it starts the relationship like any other.
    // It doesn't go through `addLog` (see above), so the rule is applied here.
    recordEngagement(contact.id, "email");
  }

  const filterControl =
    timelineFilter === "dropdown" ? (
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
    );

  const feed = (
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
                    attention={needsAttention(event) && !resolved.has(event.id)}
                    pinned={!!event.pinned}
                    arriving={arrivingIds.has(event.id)}
                    replyOpen={replyOpenId === event.id}
                    replyMessageId={replyMessageId}
                    threadOpen={threadOpenId === event.id}
                    replyTo={replyTo}
                    onAction={(id, messageId) =>
                      handleAction(event, id, messageId)
                    }
                    onReplySend={(text) => handleReplySend(event, text)}
                    onReplyCancel={() => {
                      setReplyOpenId(null);
                      setReplyMessageId(null);
                    }}
                  />
                ))}
              </section>
            ))}
          </div>
        </Tooltip.Provider>
      )}
    </div>
  );

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

      {/* "Stacked" narrow layout: the right column's cards land here, between the
          composer and the feed. */}
      {narrowSlot}

      {sideTabs ? (
        /* "Tabs" narrow layout: one card, Timeline and Tasks as panes. The tab
           strip *is* this card's header, so the active pane's controls sit at its
           trailing edge rather than claiming a row of their own — a row that was
           empty on the left in both panes.
           
           No `overflow-hidden` here, unlike the other cards: it would make the
           card the containment context for the sticky header and stop it sticking
           as the column scrolls. */
        <Card className="panel-card">
          <div className="compose-header contact-pane-tabs">
            {/* Same pill track the compose tabs use: it's taller than any of the
                panes' controls, so the track sets the row height and switching
                panes can't shift the layout. `.compose-tabs` carries the pill
                styling and the enclosing `.tabtrack--*` the track fill. */}
            <div className="compose-tabs">
              <Tabs value={pane} onValueChange={(v) => v && setPane(v as PaneKey)}>
                <Tabs.List variant="pills">
                  <Tabs.Tab
                    value="timeline"
                    icon={<FontAwesomeIcon icon={faWavePulse} />}
                  >
                    Timeline
                    <Badge variant="secondary" appearance="muted">
                      {timelineCount}
                    </Badge>
                  </Tabs.Tab>
                  <Tabs.Tab
                    value="tasks"
                    icon={<FontAwesomeIcon icon={faListCheck} />}
                  >
                    Tasks
                    <Badge variant="secondary" appearance="muted">
                      {sideTabs.taskCount}
                    </Badge>
                  </Tabs.Tab>
                </Tabs.List>
              </Tabs>
            </div>
            {/* Contextual to the pane: the feed's filters, or the Add action. */}
            <div className="contact-pane-tabs__actions">
              {pane === "timeline" && filterControl}
              {pane === "tasks" && <AddTaskAction contactId={contact.id} />}
            </div>
          </div>

          {pane === "timeline" && feed}
          {pane === "tasks" && <div className="p-4">{sideTabs.tasks}</div>}
        </Card>
      ) : (
        /* Timeline card — "Timeline" title shares the header row with the filter
           pills (same pattern as the composer), then the grouped feed. */
        <Card className="panel-card overflow-hidden">
          <div className="compose-header">
            <span
              className="fw-semibold"
              style={{ fontSize: 20, lineHeight: "26px" }}
            >
              Timeline
            </span>
            {filterControl}
          </div>
          {feed}
        </Card>
      )}

      {/* AI Start-a-Deal progress — scan docs → map fields → create deal. */}
      <AiDealProgressModal
        open={aiDealFromEventId != null}
        documents={ROSA_FINANCIAL_DOCS.map((d) => d.name)}
        dealLabel={`${ownedProperty?.name ?? "New deal"} · Pitching`}
        onComplete={completeAiDeal}
      />
    </div>
  );
}
