import { useEffect, useMemo, useState } from "react";
import { useRouter } from "@tanstack/react-router";
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
import { notify } from "#/lib/notify";
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
import {
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
import { startUnderwriting } from "#/components/call/heroInbound";
import { ROSA_AGREEMENT_EMAIL_ID } from "#/components/call/rosaClosing";
import { useHeroDemo } from "#/components/call/heroDemo";
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
  const router = useRouter();
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
  // the arc is complete (Otto's "run it again" beat) and the row resolves. The
  // gate can be cancelled, so clicking alone doesn't resolve it — the deal's
  // real status does.
  useEffect(() => {
    if (!ownedProperty) return;
    const activated = deals.some(
      (d) => d.propertyId === ownedProperty.id && d.status === "active",
    );
    if (activated) {
      useHeroDemo.getState().markArcComplete();
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

  /** The "AI scanned the docs" payoff: create the deal it was reading toward,
   * kick the sidebar underwrite/BOV, and land on the listing. */
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
    // Kick the sidebar underwrite → BOV, then walk the eye to the new listing.
    startUnderwriting(deal.id);
    router.navigate({ to: "/listings/$listingId", params: { listingId: deal.id } });
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
    return base
      .filter((e) => !deleted.has(e.id))
      .map((e) => ({
        ...e,
        pinned: overrides[e.id]?.pinned ?? e.pinned,
      }));
  }, [logged, simEvents, contact, deals, overrides, deleted]);

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
                        arriving={arrivingIds.has(event.id)}
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
