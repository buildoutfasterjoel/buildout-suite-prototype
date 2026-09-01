import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
// The rail glyphs are SOLID — at 14px inside a 36px bubble an outline glyph goes
// thin and muddy, and the bubble already carries the weight. The filter icons
// below stay regular; they sit on their own in a control, not in a bubble.
import {
  faPhone as faPhoneSolid,
  faPhoneArrowDownLeft,
  faEnvelope as faEnvelopeSolid,
  faReply,
  faEnvelopes,
  faCalendarUsers,
  faBuilding,
  faNoteSticky as faNoteStickySolid,
  faCircleQuestion as faCircleQuestionSolid,
  faBullhorn,
  faListCheck,
  faFlagCheckered,
  faShuffle,
  faUserGear,
  faGear,
} from "@fortawesome/pro-solid-svg-icons";
import {
  faPhone,
  faEnvelope,
  faNoteSticky,
  faCircleQuestion,
  faListUl,
  faCalendar,
  faBinoculars,
} from "@fortawesome/pro-regular-svg-icons";
import type { Contact, RelationshipStage } from "#/data/types";
import { CURRENT_USER } from "#/data/teammates";
import type { ComposedActivity } from "#/components/contacts/contactDisplay";
import { contactFullName } from "#/components/contacts/contactDisplay";

// ─────────────────────────────────────────────────────────────────────────────
// Activity timeline data model
//
// A single `TimelineEvent` shape backs every row (mirrors the Figma
// `TimelineEvent` component set). The `type` drives icon/content via the
// `TYPE_CONFIG` map; per-row booleans (pinned, …) and state props
// (action bar, reply open, …) toggle overlays. No per-type component forks.
//
// Excluded per product scope: Text/SMS, saved/viewed property, property search,
// open house, website/page-view, and appointment. 16 types remain.
// ─────────────────────────────────────────────────────────────────────────────

export type TimelineEventType =
  | "call"
  | "email"
  | "inbound-email"
  | "email-reply"
  | "inbound-call"
  | "conversation"
  | "meeting"
  | "tour"
  | "note"
  | "inquiry"
  | "marketing"
  | "task"
  | "created"
  | "stage-change"
  | "assignment"
  | "change-log";

/** Which FilterBar tab an event counts toward. */
export type FilterKey =
  | "all"
  | "notes"
  | "calls"
  | "emails"
  | "meetings"
  | "tours"
  | "inquiries"
  | "attachments"
  | "activity"
  | "marketing";

export interface TimelineActor {
  name: string;
  avatarUrl?: string;
}

/**
 * A group of body lines. Deliberately unlabelled: the uppercase "CALL SUMMARY" /
 * "NEXT STEPS" subheads used to sit here, but call logging is a plain textarea —
 * it can't produce headed sections, so showing them invented a capability.
 */
export interface TimelineBlock {
  items: string[];
  /**
   * Render the (single) item as a 2-line-clamped paragraph with a "Show
   * more" toggle instead of a bullet list — used for a voicemail transcript.
   */
  clamp?: boolean;
}

/** An inbound reply nested under a sent message, rendered as a thread of one. */
export interface TimelineReply {
  replier: string;
  /** When the reply landed. Falls back to the parent event's timestamp. */
  timestamp?: string;
  delay?: string;
  sentiment?: string;
  sentimentTone?: "positive" | "neutral" | "negative";
  body: string;
}

export interface TimelineThreadMessage {
  id: string;
  direction: "out" | "in";
  sender: string;
  timestamp: string;
  body: string;
  /**
   * Files this specific message carried. Attachments belong to the email they
   * arrived on, not to the conversation — hoisting them to the row put Rosa's
   * rent roll next to a reply that never contained it.
   */
  attachments?: TimelineAttachment[];
}

/**
 * Conversation (email thread) payload. `messages` is ordered oldest → newest and
 * the last one is the "latest" — it's rendered as the row's own content, so the
 * expanded thread below shows only the older ones and the toggle counts those.
 */
export interface TimelineThread {
  latestSender: string;
  latestBody: string;
  messages: TimelineThreadMessage[];
}

/** How many messages sit behind the "View full thread" toggle. */
export function hiddenMessageCount(thread: TimelineThread): number {
  return Math.max(0, thread.messages.length - 1);
}

export interface TimelineAssociation {
  type: "deal" | "property" | "relationship";
  label: string;
  /** Deal/listing id — when present the label links to the deal detail page. */
  id?: string;
}

/** A file attached to an email event, rendered as a document chip. */
export interface TimelineAttachment {
  name: string;
  /** Optional meta line, e.g. "PDF · 268 KB". */
  meta?: string;
  /** When set, the chip links to this deal's document editor (e.g. a sent BOV). */
  dealId?: string;
}

export type TimelineSource = "user" | "system" | "api" | "automation";
export type TimelineVisibility = "private" | "shared" | "team";

/**
 * One timeline row. Mirrors the spec's property surface; most fields are
 * conditional and rendered only when present.
 */
export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  actor: TimelineActor;
  contact?: { name: string; id: string };
  direction?: "out" | "in";
  /** ISO timestamp; rendered relative with an exact-time tooltip. */
  timestamp: string;
  /** Monotonic tiebreaker so same-timestamp rows keep a stable order. */
  seq: number;
  durationSecs?: number;
  title?: string;
  subject?: string;
  blocks?: TimelineBlock[];
  body?: string;
  reply?: TimelineReply;
  threadId?: string;
  messageId?: string;
  inReplyTo?: string;
  thread?: TimelineThread;
  associations?: TimelineAssociation[];
  source: TimelineSource;
  visibility?: TimelineVisibility;
  pinned?: boolean;
  hasAttachment?: boolean;
  /** Attached documents, rendered as file chips under the body. */
  attachments?: TimelineAttachment[];
  /** Voicemail / missed flag — what holds an inbound call in needs-attention. */
  attempted?: boolean;
  /**
   * Stage badges rendered after the headline. One badge (`to` only) on a creation
   * row says which stage the contact arrived as; two say what changed.
   */
  stageChange?: { from?: RelationshipStage; to: RelationshipStage };
  /**
   * Per-event action bar — overrides the type's default labels when this one
   * row needs a special action (e.g. "Start a Deal" on an email that arrived
   * with financial documents attached).
   */
  actionBar?: TypeConfig["actionBar"];
}

/**
 * Which channel buttons the hover FAB carries between the pin and the overflow
 * trigger. Derived per type rather than per row, because it's the channel that
 * decides whether "reply" is even a coherent action.
 */
export type FabChannel = "none" | "call" | "email" | "inquiry";

/** Per-type presentation + action-label config (the Figma type variant set). */
export interface TypeConfig {
  icon: IconDefinition;
  filter: Exclude<FilterKey, "all" | "attachments">;
  /** Default headline when an event supplies no `title`. */
  defaultTitle: string;
  /** System / marketing rows are not 1:1 editable. */
  readOnly?: boolean;
  /**
   * Needs-attention action bar. `primary` is the filled button; `ghosts` are the
   * outlined ones. Every bar also gets a "Dismiss" ghost, added by the bar
   * itself — it's the one action that means the same thing on every row.
   */
  actionBar?: { primary?: string; ghosts?: string[] };
  /** Channel buttons in the hover FAB. Defaults to "none". */
  fab?: FabChannel;
}

/**
 * The overflow menu, now the same three items on every row. It used to stack a
 * per-type list on top of a six-item universal set, which made the menu the
 * widest surface in the feed and buried the two things anyone actually reached
 * for. Channel actions live in the hover FAB instead, where they're one click.
 */
export const OVERFLOW_ITEMS = ["Pin to Top", "Edit", "Delete"] as const;

/**
 * The per-type map. Also carries the action-bar labels and the FAB channel so a
 * row can relabel its actions by type ("Call back" vs "Reply") without per-type
 * component forks.
 *
 * The three designed action bars are Call back / Reply / Email — a missed call
 * wants a call back, an email wants a reply, and an inquiry wants first contact
 * on whichever channel suits. Every bar carries "Task for later" so the broker
 * can defer without the row going quiet, and "Dismiss" is added by the bar.
 */
export const TYPE_CONFIG: Record<TimelineEventType, TypeConfig> = {
  call: {
    icon: faPhoneSolid,
    filter: "calls",
    defaultTitle: "Logged a call",
    actionBar: { primary: "Call back", ghosts: ["Task for later"] },
    fab: "call",
  },
  email: {
    icon: faEnvelopeSolid,
    filter: "emails",
    defaultTitle: "Sent an email",
    actionBar: { primary: "Reply", ghosts: ["Reply all", "Task for later"] },
    fab: "email",
  },
  "inbound-email": {
    icon: faEnvelopeSolid,
    filter: "emails",
    defaultTitle: "Received an email",
    actionBar: { primary: "Reply", ghosts: ["Reply all", "Task for later"] },
    fab: "email",
  },
  "email-reply": {
    icon: faReply,
    filter: "emails",
    defaultTitle: "Replied",
    actionBar: { primary: "Reply", ghosts: ["Reply all", "Task for later"] },
    fab: "email",
  },
  "inbound-call": {
    icon: faPhoneArrowDownLeft,
    filter: "calls",
    defaultTitle: "Missed call",
    actionBar: { primary: "Call back", ghosts: ["Task for later"] },
    fab: "call",
  },
  conversation: {
    icon: faEnvelopes,
    filter: "emails",
    defaultTitle: "Email conversation",
    actionBar: { primary: "Reply", ghosts: ["Reply all", "Task for later"] },
    fab: "email",
  },
  meeting: {
    icon: faCalendarUsers,
    filter: "meetings",
    defaultTitle: "Logged a meeting",
  },
  tour: {
    icon: faBuilding,
    filter: "tours",
    defaultTitle: "Logged a tour",
  },
  note: {
    icon: faNoteStickySolid,
    filter: "notes",
    defaultTitle: "Added a note",
  },
  inquiry: {
    icon: faCircleQuestionSolid,
    filter: "inquiries",
    defaultTitle: "Property inquiry",
    actionBar: { primary: "Email", ghosts: ["Call", "Task for later"] },
    fab: "inquiry",
  },
  marketing: {
    icon: faBullhorn,
    filter: "marketing",
    defaultTitle: "Marketing email",
    readOnly: true,
  },
  task: {
    icon: faListCheck,
    filter: "activity",
    defaultTitle: "Task",
  },
  created: {
    icon: faFlagCheckered,
    filter: "activity",
    defaultTitle: "Contact created",
    readOnly: true,
  },
  "stage-change": {
    icon: faShuffle,
    filter: "activity",
    defaultTitle: "Stage change",
    readOnly: true,
  },
  assignment: {
    icon: faUserGear,
    filter: "activity",
    defaultTitle: "Assignment",
    readOnly: true,
  },
  "change-log": {
    icon: faGear,
    filter: "activity",
    defaultTitle: "Record change",
    readOnly: true,
  },
};

/**
 * Whether a row still needs the broker's attention (drives the colored icon +
 * the Tier-1 action bar). Only three cases qualify — a missed inbound call, an
 * inbound email not yet replied to, and an inquiry not yet followed up (plus an
 * email thread whose latest message is inbound). Everything else is "resting".
 * Callers additionally clear this once the row has been actioned (see the panel
 * `resolved` set) so the color earns its meaning.
 */
export function needsAttention(e: TimelineEvent): boolean {
  switch (e.type) {
    case "inbound-call":
      return !!e.attempted;
    case "inbound-email":
    case "email-reply":
    case "inquiry":
      return true;
    case "conversation":
      return e.thread?.messages.at(-1)?.direction === "in";
    default:
      return false;
  }
}

// ── Filtering ────────────────────────────────────────────────────────────────

export const FILTER_TABS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "notes", label: "Notes" },
  { key: "calls", label: "Calls" },
  { key: "emails", label: "Emails" },
  { key: "meetings", label: "Meetings" },
  { key: "tours", label: "Tours" },
  { key: "inquiries", label: "Inquiries" },
];

/**
 * Icon per filter — shared by the pill tab track and the dropdown so both read
 * identically. Meetings/Tours reuse the compose-tab icons (calendar/binoculars);
 * "All" uses a list glyph (surfaced only in the dropdown — the tab track shows
 * its text label instead).
 */
export const FILTER_ICON: Partial<Record<FilterKey, IconDefinition>> = {
  all: faListUl,
  notes: faNoteSticky,
  calls: faPhone,
  emails: faEnvelope,
  meetings: faCalendar,
  tours: faBinoculars,
  // Same glyph the inquiry rows carry, so the filter and the rows it selects
  // read as the same thing.
  inquiries: faCircleQuestion,
};

export function matchesFilter(event: TimelineEvent, key: FilterKey): boolean {
  if (key === "all") return true;
  if (key === "attachments") return !!event.hasAttachment;
  return TYPE_CONFIG[event.type].filter === key;
}

/**
 * The email-thread model. `All` and `Emails` both collapse a thread into its one
 * Conversation card (member messages hidden) — narrowing to Emails should drop
 * the non-email rows, not shatter a conversation into its individual messages.
 * Other filters show whatever matches — an attachment-bearing member still
 * surfaces.
 */
export function visibleEvents(
  events: TimelineEvent[],
  filter: FilterKey,
): TimelineEvent[] {
  const convoThreads = new Set(
    events
      .filter((e) => e.type === "conversation" && e.threadId)
      .map((e) => e.threadId as string),
  );
  return events.filter((e) => {
    if (!matchesFilter(e, filter)) return false;
    if (filter === "all" || filter === "emails") {
      const isThreadMember =
        !!e.threadId && convoThreads.has(e.threadId) && e.type !== "conversation";
      return !isThreadMember;
    }
    return true;
  });
}

/** A reply the broker sent from the timeline this session. */
export interface SessionReply {
  id: string;
  body: string;
  timestamp: string;
  sender: string;
}

/** The one message a non-thread email row represents. */
function ownMessage(e: TimelineEvent): TimelineThreadMessage {
  return {
    id: e.messageId ?? `${e.id}-msg`,
    direction: e.direction ?? (e.type === "inbound-email" ? "in" : "out"),
    sender: e.actor.name,
    timestamp: e.timestamp,
    body: e.body ?? "",
    attachments: e.attachments,
  };
}

/**
 * The broker and the counterparty, read off an event whichever way round it was
 * authored (`mk` flips actor/contact for inbound rows).
 */
function partiesOf(e: TimelineEvent): {
  broker: { name: string; id: string };
  other: { name: string; id: string };
} {
  const inbound = (e.direction ?? "out") === "in";
  const actor = { name: e.actor.name, id: "me" };
  const counter = { name: e.contact?.name ?? "", id: e.contact?.id ?? "" };
  return inbound
    ? { broker: counter, other: { name: actor.name, id: counter.id } }
    : { broker: actor, other: counter };
}

/**
 * Actor and recipient for a conversation row, from whoever sent the newest
 * message — a thread reads as "who spoke last, to whom", so it flips when the
 * other side answers.
 */
function actorsFor(
  latest: TimelineThreadMessage,
  parties: ReturnType<typeof partiesOf>,
): Pick<TimelineEvent, "actor" | "contact"> {
  return latest.direction === "in"
    ? { actor: { name: parties.other.name }, contact: parties.broker }
    : { actor: { name: parties.broker.name }, contact: parties.other };
}

function threadOf(messages: TimelineThreadMessage[]): TimelineThread {
  const ordered = [...messages].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  const latest = ordered.at(-1)!;
  return {
    latestSender: latest.sender,
    latestBody: latest.body,
    messages: ordered,
  };
}

/**
 * Arc threads were authored with their files on the row. Attach them to the newest
 * message, which is where they already appeared, so every thread follows the one
 * rule: attachments belong to a message.
 */
function withHoistedAttachments(e: TimelineEvent): TimelineThreadMessage[] {
  const messages = e.thread!.messages;
  if (!e.attachments?.length || messages.some((m) => m.attachments?.length)) {
    return messages;
  }
  return messages.map((m, i) =>
    i === messages.length - 1 ? { ...m, attachments: e.attachments } : m,
  );
}

/**
 * Collapse an email that has more than one message into the conversation row that
 * represents it.
 *
 * A reply doesn't create a second entry on the record — it advances the exchange
 * that was already there. So an email that received an inbound reply, or one the
 * broker answered from the timeline, stops standing alone: it keeps its place as a
 * *member* of a thread (which is what the Emails filter lists), and a conversation
 * row appears carrying the newest message, dated to it. `visibleEvents` then shows
 * whichever of the two the current filter asks for.
 */
export function foldThreads(
  events: TimelineEvent[],
  sessionReplies: Record<string, SessionReply[]> = {},
): TimelineEvent[] {
  const out: TimelineEvent[] = [];

  for (const e of events) {
    // An existing conversation just gains the new messages. It looks replies up by
    // thread as well as by id, because a synthesized conversation's own id shifts
    // as the thread grows — but *only* a conversation may do that. The members of
    // an arc's thread carry the same threadId, and letting them match it folded
    // every one of them into a conversation of its own.
    if (e.type === "conversation" && e.thread) {
      const added =
        sessionReplies[e.id] ??
        (e.threadId ? sessionReplies[e.threadId] : undefined) ??
        [];
      if (!added.length) {
        out.push({
          ...e,
          thread: { ...e.thread, messages: withHoistedAttachments(e) },
          attachments: undefined,
        });
        continue;
      }
      const thread = threadOf([
        ...withHoistedAttachments(e),
        ...added.map((r) => ({
          id: r.id,
          direction: "out" as const,
          sender: r.sender,
          timestamp: r.timestamp,
          body: r.body,
        })),
      ]);
      const latest = thread.messages.at(-1)!;
      out.push({
        ...e,
        ...actorsFor(latest, partiesOf(e)),
        thread,
        timestamp: latest.timestamp,
        // Attachments now live on the messages that carried them.
        attachments: undefined,
      });
      continue;
    }

    // A standalone email answers to its own id *and* to the thread key it will be
    // folded under — a reply to the resulting conversation is stored against that
    // key, and reading only `e.id` here silently dropped it.
    //
    // An email that already belongs to an arc thread is deliberately excluded: its
    // members share the conversation's `threadId`, and letting them match it folded
    // every one of them into a conversation of its own.
    const ownThreadKey = `${e.id}-thread`;
    const added = e.threadId
      ? (sessionReplies[e.id] ?? [])
      : (sessionReplies[e.id] ?? sessionReplies[ownThreadKey] ?? []);
    const isEmail =
      e.type === "email" || e.type === "inbound-email" || e.type === "email-reply";
    if (!isEmail || (!e.reply && !added.length)) {
      out.push(e);
      continue;
    }

    // One email plus at least one reply: becomes a member of its own new thread.
    const threadId = e.threadId ?? ownThreadKey;
    const messages: TimelineThreadMessage[] = [ownMessage(e)];
    if (e.reply) {
      messages.push({
        id: `${e.id}-reply`,
        direction: "in",
        sender: e.reply.replier,
        timestamp: e.reply.timestamp ?? e.timestamp,
        body: e.reply.body,
      });
    }
    for (const r of added) {
      messages.push({
        id: r.id,
        direction: "out",
        sender: r.sender,
        timestamp: r.timestamp,
        body: r.body,
      });
    }
    const thread = threadOf(messages);
    const latest = thread.messages.at(-1)!;

    // The original, now a thread member — `reply` is folded in, so it doesn't
    // also render as a nested block.
    out.push({ ...e, threadId, reply: undefined });

    // Each reply becomes its own member row, so the Emails filter lists the
    // exchange message by message rather than hiding half of it.
    for (const m of thread.messages.slice(1)) {
      out.push({
        id: m.id,
        type: m.direction === "in" ? "inbound-email" : "email",
        actor: { name: m.sender },
        contact: e.contact,
        direction: m.direction,
        timestamp: m.timestamp,
        seq: e.seq,
        subject: e.subject,
        body: m.body,
        threadId,
        messageId: m.id,
        associations: e.associations,
        source: "user",
      });
    }

    out.push({
      id: `${threadId}-convo`,
      type: "conversation",
      ...actorsFor(latest, partiesOf(e)),
      timestamp: latest.timestamp,
      seq: e.seq,
      subject: e.subject,
      thread,
      threadId,
      associations: e.associations,
      // The paperclip still flags that the exchange carries files; which message
      // they came on is what the thread shows.
      hasAttachment: thread.messages.some((m) => m.attachments?.length),
      source: "user",
    });
  }

  return out;
}

/** Counts match the rows each tab actually renders (post thread-grouping). */
export function filterCounts(events: TimelineEvent[]): Record<FilterKey, number> {
  const out = {} as Record<FilterKey, number>;
  for (const { key } of FILTER_TABS) {
    out[key] = visibleEvents(events, key).length;
  }
  return out;
}

// ── Time grouping ──────────────────────────────────────────────────────────––

/**
 * A feed heading. "Pinned" isn't a time range — it's a section above all of them,
 * because a pinned row's whole point is that it stops being sorted by when it
 * happened.
 */
export type TimeBucket =
  | "Pinned"
  | "This week"
  | "This month"
  | "Earlier this year"
  | "Earlier";

const DAY = 86_400_000;

export function bucketFor(iso: string, now = Date.now()): TimeBucket {
  const age = now - new Date(iso).getTime();
  if (age < 7 * DAY) return "This week";
  if (age < 31 * DAY) return "This month";
  if (age < 365 * DAY) return "Earlier this year";
  return "Earlier";
}

const BUCKET_ORDER: TimeBucket[] = [
  "Pinned",
  "This week",
  "This month",
  "Earlier this year",
  "Earlier",
];

/**
 * Sort newest-first, then split into ordered headings. Pinned rows leave their time
 * bucket entirely and collect under a "Pinned" heading at the top — a row pinned
 * from last year was otherwise filed under "Earlier", which is the one place the
 * reader wasn't going to look for it.
 */
export function groupByBucket(
  events: TimelineEvent[],
  now = Date.now(),
): { bucket: TimeBucket; events: TimelineEvent[] }[] {
  const sorted = [...events].sort((a, b) => {
    if (!!b.pinned !== !!a.pinned) return a.pinned ? -1 : 1;
    const t = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    return t !== 0 ? t : b.seq - a.seq;
  });
  const groups = new Map<TimeBucket, TimelineEvent[]>();
  for (const e of sorted) {
    const b = e.pinned ? "Pinned" : bucketFor(e.timestamp, now);
    (groups.get(b) ?? groups.set(b, []).get(b)!).push(e);
  }
  return BUCKET_ORDER.filter((b) => groups.has(b)).map((bucket) => ({
    bucket,
    events: groups.get(bucket)!,
  }));
}

// ── Relative time ────────────────────────────────────────────────────────────

export function relativeTime(iso: string, now = Date.now()): string {
  const diff = now - new Date(iso).getTime();
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  if (days < 31) return `${weeks}w ago`;
  const months = Math.round(days / 30);
  if (days < 365) return `${months}mo ago`;
  return `${Math.round(days / 365)}y ago`;
}

export function exactTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Compact exact timestamp for a message inside a thread, e.g. "Jul 6, 9:05 AM".
 * A thread can span weeks, so a relative label ("3w ago") collapses messages
 * minutes apart into the same string and loses the pacing entirely; the full
 * {@link exactTime} (with weekday and year) rides along as the tooltip.
 */
export function shortDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function durationLabel(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// ── Compose / live-call → timeline event ────────────────────────────────────

const owner: TimelineActor = {
  name: CURRENT_USER.name,
  avatarUrl: CURRENT_USER.avatarUrl,
};

const COMPOSE_TYPE: Record<ComposedActivity["kind"], TimelineEventType> = {
  note: "note",
  call: "call",
  email: "email",
  meeting: "meeting",
  tour: "tour",
  task: "task",
};

/** Maps a session-logged compose/live-call activity into a timeline event. */
export function composedToEvent(a: ComposedActivity, c: Contact): TimelineEvent {
  const type = COMPOSE_TYPE[a.kind];
  const isEmail = a.kind === "email";
  return {
    id: a.id,
    type,
    actor: owner,
    contact: { name: contactFullName(c), id: c.id },
    direction: "out",
    // The chosen activity date + the (fixed) time-of-day it was logged. Using
    // the stored creation moment keeps the row's position stable relative to
    // other session events — re-stamping to "now" here would bump logged items
    // above genuinely newer events whenever the feed recomputes.
    timestamp: `${a.date}T${new Date(a.createdAt).toTimeString().slice(0, 8)}`,
    seq: 1_000_000 + a.seq,
    subject: isEmail ? a.subject : undefined,
    body: a.body || undefined,
    // A completed task names itself. Otherwise: "Connected" is the default call
    // outcome so it adds nothing, but the ones that carry information (No Answer,
    // Left Voicemail…) ride in the headline, since the row no longer has a badge
    // to put them in.
    title:
      a.kind === "task"
        ? "Task completed"
        : a.outcome && a.outcome !== "Connected"
          ? `${TYPE_CONFIG[type].defaultTitle} — ${a.outcome}`
          : undefined,
    associations: a.relatedDeal
      ? [{ type: "deal", label: a.relatedDeal }]
      : undefined,
    attachments: a.attachments,
    hasAttachment: (a.attachments?.length ?? 0) > 0,
    source: "user",
    visibility: a.isPrivate ? "private" : undefined,
  };
}

// ── Artifact privacy ─────────────────────────────────────────────────────────
//
// Any user can mark an artifact they authored private, on any contact — even a
// company-owned one. System rows are the exception: Contact Created, stage
// changes, change-log entries, assignment, automated marketing, and task
// notifications are the record's history, not one person's note. Inbound rows
// (a call or email *from* the contact) aren't authored by the broker either.

/** Types a person writes themselves. */
const PRIVATABLE_TYPES: ReadonlySet<TimelineEventType> = new Set([
  "note",
  "call",
  "email",
  "meeting",
  "tour",
]);

/** Whether the signed-in user may mark this row private (or visible again). */
export function canBePrivate(event: TimelineEvent): boolean {
  return (
    PRIVATABLE_TYPES.has(event.type) &&
    event.source === "user" &&
    event.direction !== "in" &&
    event.actor.name === CURRENT_USER.name
  );
}

export function isPrivateEvent(event: TimelineEvent): boolean {
  return event.visibility === "private";
}

/**
 * Authorship governs: a private artifact is visible to its author and nobody
 * else. Not the record's owner, not a teammate it's shared with, and not a
 * Managing Director with View Private Contacts — that permission opens the
 * relationship, never a colleague's candid note.
 */
export function hiddenFromViewer(event: TimelineEvent): boolean {
  return isPrivateEvent(event) && event.actor.name !== CURRENT_USER.name;
}
