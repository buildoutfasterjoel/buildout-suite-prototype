import type { Contact, DealSummary } from "#/data/types";
import { CURRENT_USER } from "#/data/teammates";
import { contactFullName } from "#/components/contacts/contactDisplay";
import type {
  TimelineActor,
  TimelineAssociation,
  TimelineEvent,
  TimelineEventType,
} from "#/components/contacts/timeline";

// ─────────────────────────────────────────────────────────────────────────────
// Timeline arc kit — shared plumbing for the synthesized activity feeds.
//
// Both the parameterized stage arcs (timelineArcs.ts) and the hand-authored
// hero arcs (timelineHeroes.ts) build events through this kit so every feed
// gets the same deterministic dates, ids, and actor wiring.
// ─────────────────────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;

export const OWNER: TimelineActor = {
  name: CURRENT_USER.name,
  avatarUrl: CURRENT_USER.avatarUrl,
};

/** ISO for `days` ago at `hour`:`minute` local time. */
export function daysAgoISO(days: number, hour = 10, minute = 15): string {
  const d = new Date(Date.now() - days * DAY_MS);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

/** Whole days elapsed since an ISO timestamp (>= 0). */
export function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS));
}

/**
 * Deterministic PRNG seeded from a string (contact id) — mulberry32 over an
 * FNV-1a hash. Same contact, same feed, every render.
 */
export function rngFor(key: string): () => number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick one variant deterministically. */
export function pick<T>(rng: () => number, options: readonly T[]): T {
  return options[Math.floor(rng() * options.length)];
}

/** Everything a beat needs to write itself for a specific contact. */
export interface ArcCtx {
  c: Contact;
  /** The contact as a timeline participant. */
  ref: { name: string; id: string };
  first: string;
  deals: DealSummary[];
  /** Primary deal (first linked), when any. */
  deal?: DealSummary;
  rng: () => number;
  /** Monotonic event ordinal — id suffix + same-timestamp tiebreaker. */
  next: () => number;
  /** ISO for `days` ago (arc-local shorthand for daysAgoISO). */
  at: (days: number, hour?: number, minute?: number) => string;
}

export function makeCtx(c: Contact, deals: DealSummary[]): ArcCtx {
  let seq = 0;
  return {
    c,
    ref: { name: contactFullName(c), id: c.id },
    first: c.firstName,
    deals,
    deal: deals[0],
    rng: rngFor(c.id),
    next: () => seq++,
    at: daysAgoISO,
  };
}

export function assoc(d?: DealSummary): TimelineAssociation[] {
  return d ? [{ type: "deal", label: d.name, id: d.id }] : [];
}

type EventOverrides = Partial<Omit<TimelineEvent, "id" | "type" | "seq">>;

/**
 * Build one event with the boilerplate filled in. Outbound rows are authored
 * by the broker; pass `direction: "in"` for rows the contact authored (actor
 * and counterpart flip automatically unless explicitly provided).
 */
export function mk(
  ctx: ArcCtx,
  type: TimelineEventType,
  daysAgo: number,
  over: EventOverrides = {},
): TimelineEvent {
  const n = ctx.next();
  const inbound = over.direction === "in";
  return {
    id: `${ctx.c.id}-${type}-${n}`,
    type,
    actor: inbound ? { name: ctx.ref.name } : OWNER,
    contact: inbound ? { name: OWNER.name, id: "me" } : ctx.ref,
    timestamp: ctx.at(daysAgo, 9 + (n % 8), (n * 17) % 60),
    seq: n,
    source: "user",
    ...over,
  };
}

/** The system "Contact created" row every arc ends with. */
export function createdEvent(ctx: ArcCtx): TimelineEvent {
  return {
    id: `${ctx.c.id}-created`,
    type: "created",
    actor: { name: ctx.c.assignedTo },
    contact: ctx.ref,
    timestamp: ctx.c.createdAt,
    seq: ctx.next(),
    title: "Contact created",
    body: `Source: ${ctx.c.source}`,
    source: "system",
  };
}
