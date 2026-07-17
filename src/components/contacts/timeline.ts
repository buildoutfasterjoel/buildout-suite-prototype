import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faPhone,
  faPhoneArrowDownLeft,
  faEnvelope,
  faEnvelopeOpen,
  faReply,
  faComments,
  faCalendarUsers,
  faBuilding,
  faNoteSticky,
  faCircleQuestion,
  faBullhorn,
  faListCheck,
  faFlagCheckered,
  faShuffle,
  faUserGear,
  faGear,
} from "@fortawesome/pro-regular-svg-icons";
import type { Contact, DealSummary } from "#/data/types";
import { CURRENT_USER } from "#/data/teammates";
import type { ComposedActivity } from "#/components/contacts/contactDisplay";
import { contactFullName } from "#/components/contacts/contactDisplay";

// ─────────────────────────────────────────────────────────────────────────────
// Activity timeline data model
//
// A single `TimelineEvent` shape backs every row (mirrors the Figma
// `TimelineEvent` component set). The `type` drives icon/tone/content via the
// `TYPE_CONFIG` map; per-row booleans (starred, pinned, …) and PR2 state props
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

/** Circular icon-badge tones (channel color) — see IconBadge. */
export type IconTone = "green" | "amber" | "blue" | "rose" | "accent" | "slate";

/** Pill tones for delivery / engagement / status — see TimelineBadge. */
export type BadgeTone =
  | "sent"
  | "open"
  | "click"
  | "reply"
  | "activity"
  | "system"
  | "error";

/** Which FilterBar tab an event counts toward. */
export type FilterKey =
  | "all"
  | "notes"
  | "calls"
  | "emails"
  | "meetings"
  | "tours"
  | "attachments"
  | "activity"
  | "marketing"
  | "starred";

export interface TimelineActor {
  name: string;
  avatarUrl?: string;
}

export interface TimelineBadgeData {
  label: string;
  tone: BadgeTone;
  /** Optional trailing meta, e.g. "2h after send". */
  meta?: string;
}

/** A labeled bullet group (Call summary, Next steps, To…). */
export interface TimelineBlock {
  kicker: string;
  items: string[];
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
  href?: string;
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
  badges?: TimelineBadgeData[];
  reply?: TimelineReply;
  threadId?: string;
  messageId?: string;
  inReplyTo?: string;
  thread?: TimelineThread;
  associations?: TimelineAssociation[];
  source: TimelineSource;
  visibility?: TimelineVisibility;
  starred?: boolean;
  pinned?: boolean;
  hasAttachment?: boolean;
  /** Voicemail / missed flag — flips the icon to an outline/amber treatment. */
  attempted?: boolean;
}

/** Per-type presentation + action-label config (the Figma type variant set). */
export interface TypeConfig {
  icon: IconDefinition;
  tone: IconTone;
  /** Default fill; `attempted`/system rows render outline. */
  filled: boolean;
  filter: Exclude<FilterKey, "all" | "starred" | "attachments">;
  /** Default headline when an event supplies no `title`. */
  defaultTitle: string;
  /** System / marketing rows are not 1:1 editable. */
  readOnly?: boolean;
  /** Tier-1 action bar labels (consumed in PR2). */
  actionBar?: { primary?: string; ghosts?: string[] };
  /** Type-specific overflow-menu top items (consumed in PR2). */
  overflow?: string[];
}

const UNIVERSAL_OVERFLOW = [
  "Star",
  "Pin to top",
  "Comment",
  "Create task",
  "Associate",
  "Copy link",
  "Delete",
];

/**
 * The per-type map. Also carries the action-bar / overflow labels so PR2 can
 * relabel actions by type ("Call back" vs "Reply") without per-type forks.
 */
export const TYPE_CONFIG: Record<TimelineEventType, TypeConfig> = {
  call: {
    icon: faPhone,
    tone: "green",
    filled: true,
    filter: "calls",
    defaultTitle: "Logged a call",
    actionBar: { primary: "Call back", ghosts: ["Text back", "Log follow-up"] },
    overflow: ["Play recording", "Edit summary", "Log call"],
  },
  email: {
    icon: faEnvelope,
    tone: "blue",
    filled: true,
    filter: "emails",
    defaultTitle: "Sent an email",
    actionBar: { primary: "Reply", ghosts: ["Reply all", "Forward"] },
    overflow: ["View thread", "Resend", "Log call"],
  },
  "inbound-email": {
    icon: faEnvelopeOpen,
    tone: "blue",
    filled: false,
    filter: "emails",
    defaultTitle: "Received an email",
    actionBar: { primary: "Reply", ghosts: ["Reply all", "Forward"] },
    overflow: ["View thread", "Create task", "Book meeting"],
  },
  "email-reply": {
    icon: faReply,
    tone: "blue",
    filled: false,
    filter: "emails",
    defaultTitle: "Replied",
    actionBar: { primary: "Reply", ghosts: ["Reply all"] },
    overflow: ["View thread", "Create task", "Book meeting"],
  },
  "inbound-call": {
    icon: faPhoneArrowDownLeft,
    tone: "amber",
    filled: false,
    filter: "calls",
    defaultTitle: "Inbound call",
    actionBar: { primary: "Call back", ghosts: ["Text back"] },
    overflow: ["Play voicemail", "Create task", "Log call"],
  },
  conversation: {
    icon: faComments,
    tone: "blue",
    filled: true,
    filter: "emails",
    defaultTitle: "Email conversation",
    actionBar: { primary: "Reply", ghosts: ["Reply all", "Forward"] },
    overflow: ["View full thread", "Create task"],
  },
  meeting: {
    icon: faCalendarUsers,
    tone: "accent",
    filled: true,
    filter: "meetings",
    defaultTitle: "Logged a meeting",
    actionBar: { primary: "Add notes", ghosts: ["Reschedule"] },
    overflow: ["Set disposition", "Create task"],
  },
  tour: {
    icon: faBuilding,
    tone: "accent",
    filled: true,
    filter: "tours",
    defaultTitle: "Logged a tour",
    actionBar: { primary: "Send side-by-side", ghosts: ["Add feedback"] },
    overflow: ["Add feedback", "Create task"],
  },
  note: {
    icon: faNoteSticky,
    tone: "slate",
    filled: true,
    filter: "notes",
    defaultTitle: "Added a note",
    actionBar: { primary: "Comment", ghosts: ["Edit"] },
    overflow: ["Edit", "Change visibility"],
  },
  inquiry: {
    icon: faCircleQuestion,
    tone: "amber",
    filled: false,
    filter: "activity",
    defaultTitle: "Property inquiry",
    actionBar: { primary: "Respond", ghosts: ["Text back"] },
    overflow: ["Send listing", "Create task"],
  },
  marketing: {
    icon: faBullhorn,
    tone: "accent",
    filled: true,
    filter: "marketing",
    defaultTitle: "Marketing email",
    readOnly: true,
    actionBar: { primary: "Email directly", ghosts: [] },
    overflow: ["View campaign", "Email directly"],
  },
  task: {
    icon: faListCheck,
    tone: "green",
    filled: true,
    filter: "activity",
    defaultTitle: "Task",
    actionBar: { primary: "Do it now", ghosts: ["Reassign"] },
    overflow: ["Edit task", "Reassign"],
  },
  created: {
    icon: faFlagCheckered,
    tone: "slate",
    filled: false,
    filter: "activity",
    defaultTitle: "Contact created",
    readOnly: true,
    overflow: ["View source"],
  },
  "stage-change": {
    icon: faShuffle,
    tone: "slate",
    filled: false,
    filter: "activity",
    defaultTitle: "Stage change",
    readOnly: true,
    overflow: ["View change log"],
  },
  assignment: {
    icon: faUserGear,
    tone: "slate",
    filled: false,
    filter: "activity",
    defaultTitle: "Assignment",
    readOnly: true,
    overflow: ["View change log"],
  },
  "change-log": {
    icon: faGear,
    tone: "slate",
    filled: false,
    filter: "activity",
    defaultTitle: "Record change",
    readOnly: true,
    overflow: ["View change log"],
  },
};

/** Universal overflow items appended after any type-specific ones (PR2). */
export function overflowItems(type: TimelineEventType): string[] {
  return [...(TYPE_CONFIG[type].overflow ?? []), ...UNIVERSAL_OVERFLOW];
}

// ── Filtering ────────────────────────────────────────────────────────────────

export const FILTER_TABS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "notes", label: "Notes" },
  { key: "calls", label: "Calls" },
  { key: "emails", label: "Emails" },
  { key: "meetings", label: "Meetings" },
  { key: "tours", label: "Tours" },
  { key: "attachments", label: "Attachments" },
  { key: "activity", label: "Activity" },
  { key: "marketing", label: "Marketing" },
  { key: "starred", label: "Starred" },
];

export function matchesFilter(event: TimelineEvent, key: FilterKey): boolean {
  if (key === "all") return true;
  if (key === "starred") return !!event.starred;
  if (key === "attachments") return !!event.hasAttachment;
  return TYPE_CONFIG[event.type].filter === key;
}

export function filterCounts(events: TimelineEvent[]): Record<FilterKey, number> {
  const out = {} as Record<FilterKey, number>;
  for (const { key } of FILTER_TABS) {
    out[key] = events.filter((e) => matchesFilter(e, key)).length;
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

export function durationLabel(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// ── Seed builder ─────────────────────────────────────────────────────────────

const owner: TimelineActor = { name: CURRENT_USER.name, avatarUrl: CURRENT_USER.avatarUrl };

/** ISO for `days` ago at `hour` local time (deterministic-ish per render). */
function daysAgo(days: number, hour = 10, minute = 15): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

/**
 * Synthesizes a rich, varied timeline for a contact — at least one row per
 * supported type, spread across the time buckets — so the feed exercises every
 * component path. Deterministic per contact (no randomness).
 */
export function buildTimeline(c: Contact, deals: DealSummary[]): TimelineEvent[] {
  const contactRef = { name: contactFullName(c), id: c.id };
  const first = c.firstName;
  const dealA = deals[0];
  const dealB = deals[1] ?? deals[0];
  const assoc = (d?: DealSummary): TimelineAssociation[] =>
    d ? [{ type: "property", label: d.name, href: `/backoffice/deals/${d.id}` }] : [];

  const threadId = `thr-${c.id}`;
  let seq = 0;
  const next = () => seq++;

  const events: TimelineEvent[] = [
    // ── This week ──
    {
      id: `${c.id}-call-1`,
      type: "call",
      actor: owner,
      contact: contactRef,
      direction: "out",
      timestamp: daysAgo(1, 9, 12),
      seq: next(),
      durationSecs: 729,
      title: `Call with ${first}`,
      blocks: [
        {
          kicker: "Call summary",
          items: [
            `Leaning King Street but not ready to offer; wants one more pass with their CPA.`,
          ],
        },
        {
          kicker: "Next steps",
          items: [
            "Refresh the King Street underwriting",
            "Schedule the CPA call",
          ],
        },
      ],
      badges: [{ label: "Connected", tone: "reply" }],
      associations: assoc(dealA),
      source: "user",
      starred: true,
    },
    {
      id: `${c.id}-inbound-email-1`,
      type: "inbound-email",
      actor: { name: contactRef.name },
      contact: { name: owner.name, id: "me" },
      direction: "in",
      timestamp: daysAgo(2, 14, 3),
      seq: next(),
      subject: "Re: Updated financials",
      body: `Thanks for sending those over — can we hop on a call Thursday to walk through the assumptions?`,
      reply: {
        replier: contactRef.name,
        delay: "2h after send",
        sentiment: "Positive · wants to meet",
        sentimentTone: "positive",
        body: "Can we hop on a call Thursday to walk through the assumptions?",
      },
      badges: [{ label: "New", tone: "reply" }],
      threadId,
      messageId: `${threadId}-m3`,
      inReplyTo: `${threadId}-m2`,
      hasAttachment: true,
      source: "user",
    },
    {
      id: `${c.id}-task-1`,
      type: "task",
      actor: owner,
      contact: contactRef,
      timestamp: daysAgo(3, 8, 30),
      seq: next(),
      title: `Send revised BOV to ${first}`,
      badges: [{ label: "Due Jul 24", tone: "activity" }],
      associations: assoc(dealA),
      source: "user",
    },

    // ── This month ──
    {
      id: `${c.id}-conversation-1`,
      type: "conversation",
      actor: owner,
      contact: contactRef,
      timestamp: daysAgo(9, 16, 40),
      seq: next(),
      subject: "Updated financials",
      thread: {
        count: 3,
        latestSender: contactRef.name,
        latestBody:
          "Can we hop on a call Thursday to walk through the assumptions?",
        messages: [
          {
            id: `${threadId}-m1`,
            direction: "out",
            sender: owner.name,
            timestamp: daysAgo(11, 9, 5),
            body: `Hi ${first} — attaching the updated financials for your review.`,
          },
          {
            id: `${threadId}-m2`,
            direction: "in",
            sender: contactRef.name,
            timestamp: daysAgo(10, 11, 20),
            body: "Got them, thank you. Reviewing with my team this week.",
          },
          {
            id: `${threadId}-m3`,
            direction: "in",
            sender: contactRef.name,
            timestamp: daysAgo(9, 16, 40),
            body: "Can we hop on a call Thursday to walk through the assumptions?",
          },
        ],
      },
      badges: [{ label: "3 in thread", tone: "activity" }],
      threadId,
      source: "user",
    },
    {
      id: `${c.id}-email-1`,
      type: "email",
      actor: owner,
      contact: contactRef,
      direction: "out",
      timestamp: daysAgo(11, 9, 5),
      seq: next(),
      subject: "Updated financials",
      body: `Hi ${first} — attaching the updated financials for your review. Happy to walk through anything that stands out.`,
      badges: [
        { label: "Sent", tone: "sent" },
        { label: "Opened", tone: "open", meta: "2h after send" },
        { label: "Clicked", tone: "click" },
      ],
      threadId,
      messageId: `${threadId}-m1`,
      hasAttachment: true,
      source: "user",
    },
    {
      id: `${c.id}-email-reply-1`,
      type: "email-reply",
      actor: { name: contactRef.name },
      contact: { name: owner.name, id: "me" },
      direction: "in",
      timestamp: daysAgo(10, 11, 20),
      seq: next(),
      subject: "Re: Updated financials",
      body: "Got them, thank you. Reviewing with my team this week.",
      reply: {
        replier: contactRef.name,
        delay: "1d after send",
        sentiment: "Interested · reviewing with team",
        sentimentTone: "positive",
        body: "Got them, thank you. Reviewing with my team this week.",
      },
      badges: [{ label: "Replied", tone: "reply" }],
      threadId,
      messageId: `${threadId}-m2`,
      inReplyTo: `${threadId}-m1`,
      source: "user",
    },
    {
      id: `${c.id}-meeting-1`,
      type: "meeting",
      actor: owner,
      contact: contactRef,
      direction: "out",
      timestamp: daysAgo(14, 13, 0),
      seq: next(),
      durationSecs: 2700,
      title: `Coffee with ${first}`,
      blocks: [
        {
          kicker: "Notes",
          items: [
            "Walked the comp set; comfortable with pricing band.",
            "Introduce to lending contact next.",
          ],
        },
      ],
      badges: [{ label: "Held", tone: "reply" }],
      associations: assoc(dealA),
      source: "user",
    },
    {
      id: `${c.id}-inbound-call-1`,
      type: "inbound-call",
      actor: { name: contactRef.name },
      contact: { name: owner.name, id: "me" },
      direction: "in",
      timestamp: daysAgo(16, 17, 45),
      seq: next(),
      title: "Missed call",
      attempted: true,
      blocks: [
        {
          kicker: "Voicemail",
          items: [
            `"Hi, it's ${first} — give me a ring back when you have a minute about the retail space."`,
          ],
        },
      ],
      badges: [{ label: "Voicemail", tone: "error" }],
      source: "user",
    },
    {
      id: `${c.id}-tour-1`,
      type: "tour",
      actor: owner,
      contact: contactRef,
      direction: "out",
      timestamp: daysAgo(18, 11, 30),
      seq: next(),
      title: `Toured ${dealA ? dealA.name : "2 properties"} with ${first}`,
      blocks: [
        {
          kicker: "Feedback",
          items: [
            "Liked the frontage; wants to see parking ratios.",
            "Interest: high.",
          ],
        },
      ],
      associations: [...assoc(dealA), ...assoc(dealB === dealA ? undefined : dealB)],
      source: "user",
    },
    {
      id: `${c.id}-note-1`,
      type: "note",
      actor: owner,
      contact: contactRef,
      timestamp: daysAgo(20, 15, 10),
      seq: next(),
      body: `${first} mentioned they're expanding into the Southeast — keep an eye out for retail pads in Charleston and Savannah.`,
      visibility: "shared",
      source: "user",
    },
    {
      id: `${c.id}-inquiry-1`,
      type: "inquiry",
      actor: { name: contactRef.name },
      contact: { name: owner.name, id: "me" },
      direction: "in",
      timestamp: daysAgo(24, 10, 0),
      seq: next(),
      title: `Inquired about ${dealA ? dealA.name : "a listing"}`,
      body: "Requested the offering memorandum and current rent roll.",
      badges: [{ label: "LoopNet", tone: "system" }],
      associations: assoc(dealA),
      source: "api",
    },
    {
      id: `${c.id}-marketing-1`,
      type: "marketing",
      actor: { name: "Buildout Marketing" },
      contact: contactRef,
      direction: "out",
      timestamp: daysAgo(27, 7, 0),
      seq: next(),
      subject: "New listing: Class-A retail on King Street",
      badges: [
        { label: "Delivered", tone: "sent" },
        { label: "Opened", tone: "open" },
      ],
      source: "automation",
    },

    // ── Earlier this year ──
    {
      id: `${c.id}-assignment-1`,
      type: "assignment",
      actor: { name: "Routing" },
      contact: contactRef,
      timestamp: daysAgo(60, 9, 0),
      seq: next(),
      title: `Assigned to ${c.assignedTo}`,
      body: `Owner · round-robin routing`,
      source: "automation",
    },
    {
      id: `${c.id}-stage-1`,
      type: "stage-change",
      actor: { name: owner.name },
      contact: contactRef,
      timestamp: daysAgo(70, 12, 30),
      seq: next(),
      title: "Stage changed",
      body: "Prospect → Active",
      source: "user",
    },
    {
      id: `${c.id}-change-1`,
      type: "change-log",
      actor: { name: owner.name },
      contact: contactRef,
      timestamp: daysAgo(85, 14, 0),
      seq: next(),
      title: "Added tag",
      body: `Tag "Expansion buyer" added`,
      source: "user",
    },
    {
      id: `${c.id}-created-1`,
      type: "created",
      actor: { name: c.assignedTo },
      contact: contactRef,
      timestamp: c.createdAt,
      seq: next(),
      title: `Contact created`,
      body: `Source: ${c.source}`,
      source: "system",
    },
  ];

  return events;
}

// ── Compose / live-call → timeline event ────────────────────────────────────

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
    // Logged items are the most recent thing that happened — stamp to now-ish
    // but keep them above the seed via a high seq.
    timestamp: `${a.date}T${new Date().toTimeString().slice(0, 8)}`,
    seq: 1_000_000 + a.seq,
    subject: isEmail ? a.subject : undefined,
    body: a.body || undefined,
    badges: a.outcome ? [{ label: a.outcome, tone: "reply" }] : undefined,
    associations: a.relatedDeal
      ? [{ type: "deal", label: a.relatedDeal }]
      : undefined,
    source: "user",
  };
}
