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
import type { Contact } from "#/data/types";
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

/** A labeled bullet group (Call summary, Next steps, To…). */
export interface TimelineBlock {
  /** Optional uppercase subhead; omit to show the items with no label. */
  kicker?: string;
  items: string[];
  /**
   * Render the (single) item as a 2-line-clamped paragraph with a "Show
   * more" toggle instead of a bullet list — used for a voicemail transcript.
   */
  clamp?: boolean;
}

/** An inbound reply nested under a sent message (PR2 renders the ReplyCard). */
export interface TimelineReply {
  replier: string;
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
}

/** Conversation (email thread) payload — collapsed preview + ordered messages. */
export interface TimelineThread {
  count: number;
  latestSender: string;
  latestBody: string;
  messages: TimelineThreadMessage[];
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
 * The hybrid email-thread model. `All` collapses a thread into its one
 * Conversation card (member messages hidden); `Emails` expands the thread into
 * its individual message cards (Conversation card hidden). Other filters show
 * whatever matches — an attachment-bearing member still surfaces.
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
    if (filter === "emails") return e.type !== "conversation";
    if (filter === "all") {
      const isThreadMember =
        !!e.threadId && convoThreads.has(e.threadId) && e.type !== "conversation";
      return !isThreadMember;
    }
    return true;
  });
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

export type TimeBucket = "This week" | "This month" | "Earlier this year" | "Earlier";

const DAY = 86_400_000;

export function bucketFor(iso: string, now = Date.now()): TimeBucket {
  const age = now - new Date(iso).getTime();
  if (age < 7 * DAY) return "This week";
  if (age < 31 * DAY) return "This month";
  if (age < 365 * DAY) return "Earlier this year";
  return "Earlier";
}

const BUCKET_ORDER: TimeBucket[] = [
  "This week",
  "This month",
  "Earlier this year",
  "Earlier",
];

/** Sort newest-first, then split into ordered time-bucket groups (pinned first). */
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
    const b = bucketFor(e.timestamp, now);
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
    // "Connected" is the default/assumed call outcome, so it adds nothing; the
    // outcomes that carry information (No Answer, Left Voicemail…) ride in the
    // headline, since the row no longer has a badge to put them in.
    title:
      a.outcome && a.outcome !== "Connected"
        ? `${TYPE_CONFIG[type].defaultTitle} — ${a.outcome}`
        : undefined,
    associations: a.relatedDeal
      ? [{ type: "deal", label: a.relatedDeal }]
      : undefined,
    attachments: a.attachments,
    hasAttachment: (a.attachments?.length ?? 0) > 0,
    source: "user",
  };
}
