import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import type { Contact, DealSummary } from "#/data/types";
import {
  ContactComposeModule,
  type ComposedDraft,
} from "#/components/contacts/ContactComposeModule";
import {
  contactFullName,
  todayISO,
  type ComposedActivity,
} from "#/components/contacts/contactDisplay";
import { notify } from "#/lib/notify";
import { playArrivalChime } from "#/lib/chime";
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
  selectFlags,
  selectResolved,
  selectSimEvents,
  useContactSession,
} from "#/components/contacts/useContactSession";
import { useDealSpotlight } from "#/components/contacts/useDealSpotlight";
import { AiDealProgressModal } from "#/components/deals/AiDealProgressModal";
import { requestStageChange } from "#/components/deals/useStageGate";
import { createDeal, updateDealTask } from "#/data/actions";
import { emptyDraft } from "#/data/createListing";
import { addDealDocument, getListingsForProperty, getProperty } from "#/data/store";

/**
 * The financial documents Rosa attaches to her follow-up email. One list feeds
 * the email's attachment chips, the AI progress modal's "scanning" step, and
 * the created deal's document set, so the story stays consistent end to end.
 */
const ROSA_FINANCIAL_DOCS = [
  { name: "The Delgado Building — T12.pdf", meta: "PDF · 268 KB", size: "268 KB" },
  { name: "Delgado Rent Roll — July 2026.xlsx", meta: "XLSX · 96 KB", size: "96 KB" },
];

/** The signed listing agreement Rosa returns after reading the BOV. */
const ROSA_SIGNED_AGREEMENT = {
  name: "Delgado Listing Agreement — Signed.pdf",
  meta: "PDF · 1.1 MB",
  size: "1.1 MB",
};
const ROSA_FINANCIALS_EMAIL_ID = "sim-rosa-financials-email";
const ROSA_AGREEMENT_EMAIL_ID = "sim-rosa-signed-agreement-email";
/** Set when the user calls Rosa back; her financials email fires post-log. */
const ROSA_CALLBACK_ARMED_FLAG = "rosa-callback-armed";

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
  // Rows the broker has acted on (replied / responded / called back) and the
  // simulated inbound events — both live in the contact-session store so
  // navigating away and back keeps the timeline where it was.
  const resolvedIds = useContactSession(selectResolved(contact.id));
  const resolved = useMemo(() => new Set(resolvedIds), [resolvedIds]);
  const resolve = (id: string) =>
    useContactSession.getState().resolve(contact.id, id);
  const simEvents = useContactSession(selectSimEvents(contact.id));
  const flags = useContactSession(selectFlags(contact.id));

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

  // One in-flight arrival timer per mount; effects dedupe on event presence,
  // so a navigation mid-delay simply reschedules on return.
  const arrivalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (arrivalTimer.current) clearTimeout(arrivalTimer.current);
    },
    [],
  );

  // Rosa's story beat: she said she'd send Miguel's financials after the call.
  // Once the called-back call is logged, her email lands a few seconds later —
  // T12 + rent roll attached, with a Start a Deal action on the row.
  useEffect(() => {
    if (!flags.includes(ROSA_CALLBACK_ARMED_FLAG)) return;
    if (simEvents.some((e) => e.id === ROSA_FINANCIALS_EMAIL_ID)) return;
    if (logged[0]?.kind !== "call") return;
    if (arrivalTimer.current) return;
    const subject = "Miguel's files — T12 and rent roll";
    arrivalTimer.current = setTimeout(() => {
      arrivalTimer.current = null;
      useContactSession
        .getState()
        .clearFlag(contact.id, ROSA_CALLBACK_ARMED_FLAG);
      useContactSession.getState().addSimEvent(contact.id, {
        id: ROSA_FINANCIALS_EMAIL_ID,
        type: "inbound-email",
        actor: { name: contactFullName(contact) },
        direction: "in",
        timestamp: new Date().toISOString(),
        seq: 2_000_000,
        subject,
        body:
          "John — I went through Miguel's cabinet after we spoke. Attached are the full trailing twelve months and the current rent roll, exactly as he kept them. I'm not saying yes to anything yet. But you should see what the building actually does before we talk again. — Rosa",
        hasAttachment: true,
        attachments: ROSA_FINANCIAL_DOCS.map(({ name, meta }) => ({
          name,
          meta,
        })),
        actionBar: { primary: "Start a Deal", ghosts: ["Reply"] },
        source: "user",
      });
      playArrivalChime();
      notify({ title: "New email from Rosa Delgado", description: subject });
    }, 6000);
  }, [logged, contact, simEvents, flags]);

  // The AI Start-a-Deal flow: holds the id of the email row it launched from
  // (null = modal closed) so the row can be resolved once the deal exists.
  const [aiDealFromEventId, setAiDealFromEventId] = useState<string | null>(
    null,
  );
  // The property the AI deal lands on — the contact's owned building.
  const ownedProperty = contact.ownedPropertyIds?.[0]
    ? getProperty(contact.ownedPropertyIds[0])
    : undefined;

  // The arc's next beat: after the BOV email goes out, Rosa returns the signed
  // listing agreement a few seconds later. The paperwork is real the moment
  // she sends it — the pdf files onto the deal and the planner's "Upload
  // executed listing agreement" task completes — and the row carries an
  // Activate Listing action.
  const agreementTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (agreementTimer.current) clearTimeout(agreementTimer.current);
    },
    [],
  );
  useEffect(() => {
    if (contact.heroKey !== "rosa") return;
    if (simEvents.some((e) => e.id === ROSA_AGREEMENT_EMAIL_ID)) return;
    const bovSent = logged.some(
      (l) =>
        l.kind === "email" &&
        l.attachments?.some((a) => /_BOV\.pdf$/i.test(a.name)),
    );
    if (!bovSent) return;
    if (agreementTimer.current) return;
    const subject = "Signed — the listing agreement";
    agreementTimer.current = setTimeout(() => {
      agreementTimer.current = null;
      const deal = ownedProperty
        ? getListingsForProperty(ownedProperty.id)[0]
        : undefined;
      if (deal) {
        addDealDocument(deal.id, {
          id: crypto.randomUUID(),
          name: ROSA_SIGNED_AGREEMENT.name,
          size: ROSA_SIGNED_AGREEMENT.size,
          uploadedAt: new Date().toISOString(),
        });
        const uploadTask = deal.tasks.find(
          (t) => t.label === "Upload executed listing agreement",
        );
        if (uploadTask) {
          updateDealTask(deal.id, uploadTask.id, { status: "complete" });
        }
      }
      useContactSession.getState().addSimEvent(contact.id, {
        id: ROSA_AGREEMENT_EMAIL_ID,
        type: "inbound-email",
        actor: { name: contactFullName(contact) },
        direction: "in",
        timestamp: new Date().toISOString(),
        seq: 2_000_001,
        subject,
        body:
          "John — Miguel never signed anything until he trusted the person across the table. I read the BOV twice, and then the agreement twice more. It's signed and attached. Find the operator who'll love this building the way he did. — Rosa",
        hasAttachment: true,
        attachments: [
          { name: ROSA_SIGNED_AGREEMENT.name, meta: ROSA_SIGNED_AGREEMENT.meta },
        ],
        actionBar: { primary: "Activate Listing", ghosts: ["Reply"] },
        source: "user",
      });
      playArrivalChime();
      notify({ title: "New email from Rosa Delgado", description: subject });
    }, 6000);
  }, [logged, contact, ownedProperty, simEvents]);

  // The agreement row's Activate action is handled once the deal actually
  // leaves Pitching — the gate can be cancelled, so clicking alone doesn't
  // resolve it.
  useEffect(() => {
    if (!ownedProperty) return;
    const moved = deals.some(
      (d) => d.propertyId === ownedProperty.id && d.status !== "proposal",
    );
    if (moved) resolve(ROSA_AGREEMENT_EMAIL_ID);
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

  /** The "AI scanned the docs" payoff: create the deal it was reading toward. */
  const completeAiDeal = () => {
    const fromEventId = aiDealFromEventId;
    setAiDealFromEventId(null);
    if (!ownedProperty) return;
    // Replayed demo guard: if the building already has a deal (e.g. the flow
    // was run in a previous session), don't stack a duplicate — point at the
    // existing card instead.
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
    // Prefill everything the scan could have read off the T12/rent roll and
    // the linked property record; the attached docs carry onto the deal.
    const { deal } = createDeal({
      ...emptyDraft(),
      name: ownedProperty.name,
      address: [ownedProperty.street, ownedProperty.city, ownedProperty.state]
        .filter(Boolean)
        .join(", "),
      propertyId: ownedProperty.id,
      propertyType: ownedProperty.propertyType,
      dealType: "Sale",
      listingPrice: ownedProperty.askingPrice,
      commissionPct: 5,
      availableSqFt: ownedProperty.buildingSqFt,
      description: `Sale of ${ownedProperty.name}, underwritten from the owner's T12 and rent roll.`,
      dealSide: "seller",
      sellerContactId: contact.id,
      initialStage: "proposal",
      documents: ROSA_FINANCIAL_DOCS.map(({ name, size }) => ({
        id: crypto.randomUUID(),
        name,
        size,
        uploadedAt: new Date().toISOString(),
      })),
    });
    notify({
      title: "Deal created",
      description: `${ownedProperty.name} — Pitching`,
    });
    // Walk the eye to the result: make sure the Deals section is open and
    // spotlight the just-created card in the overview column.
    revealDeal(deal.id);
    // The email that carried the documents has been acted on.
    if (fromEventId) resolve(fromEventId);
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
      // connected → mandatory log). On Rosa's missed call, arm her follow-up
      // email so it lands once the call is logged.
      if (contact.heroKey === "rosa" && event.type === "inbound-call") {
        useContactSession
          .getState()
          .setFlag(contact.id, ROSA_CALLBACK_ARMED_FLAG);
      }
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
      // Route through the standard stage gate (Approve & Publish). Committing
      // it moves the deal to Active and reconciles Rosa's contact stage; the
      // row resolves via the deals-watching effect once the move commits.
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
