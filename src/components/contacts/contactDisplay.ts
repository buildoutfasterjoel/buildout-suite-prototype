import type {
  Contact,
  ContactSource,
  RelationshipStage,
  DealSide,
  ContactDealStage,
  PhoneStatus,
  PropertyStatus,
  DealSummary,
} from "#/data/types";
import { STATUS_LABELS } from "#/components/properties/propertyDisplay";

/**
 * Display metadata for the People directory. All colors are Blueprint palette
 * utility classes (no raw hex) — soft pills pair a light background with darker
 * text, and dots use the mid (500) shade of the same family.
 */

export const RELATIONSHIP_STAGES: RelationshipStage[] = [
  "cold",
  "nurturing",
  "pitching",
  "client",
  "past_client",
];

export const CONTACT_SOURCES: ContactSource[] = [
  "Public records",
  "Manual entry",
  "Cold outreach",
  "Prospect by Buildout",
  "Referral",
  "Networking event",
];

export const DEAL_SIDES: DealSide[] = ["buyer", "seller"];

export const CONTACT_DEAL_STAGES: ContactDealStage[] = [
  "pitching",
  "active",
  "under_contract",
  "closed",
];

/** Relationship pill: label, dot color, and soft-pill classes. */
export const RELATIONSHIP_DISPLAY: Record<
  RelationshipStage,
  { label: string; dotClass: string; pillClass: string }
> = {
  cold: {
    label: "Cold",
    dotClass: "bg-storm-grey-500",
    pillClass: "bg-storm-grey-100 text-storm-grey-700",
  },
  nurturing: {
    label: "Nurturing",
    dotClass: "bg-harvest-gold-500",
    pillClass: "bg-harvest-gold-100 text-harvest-gold-700",
  },
  pitching: {
    label: "Pitching",
    dotClass: "bg-solid-pink-500",
    pillClass: "bg-solid-pink-100 text-solid-pink-700",
  },
  client: {
    label: "Client",
    dotClass: "bg-buildout-blue-500",
    pillClass: "bg-buildout-blue-100 text-buildout-blue-700",
  },
  past_client: {
    label: "Past Client",
    dotClass: "bg-mountain-meadow-500",
    pillClass: "bg-mountain-meadow-100 text-mountain-meadow-700",
  },
};

/** Side pill — both sides use the Seagull (teal) family, as in the reference. */
export const SIDE_DISPLAY: Record<DealSide, { label: string; pillClass: string }> = {
  buyer: { label: "Buyer", pillClass: "bg-seagull-100 text-seagull-700" },
  seller: { label: "Seller", pillClass: "bg-seagull-100 text-seagull-700" },
};

/**
 * Deal-side badge colors (hex of Blueprint family tokens), per Figma — used on
 * the deal and property cards. Seller = buildout-blue, Buyer = mountain-meadow.
 */
export const SIDE_BADGE_COLORS: Record<DealSide, { bg: string; text: string }> = {
  seller: { bg: "#dcebfd", text: "#182753" }, // buildout-blue 100 / 950
  buyer: { bg: "#cdfee5", text: "#003024" }, // mountain-meadow 100 / 950
};

/**
 * Deal-stage display: soft `pillClass` (used in the detail views) plus a
 * `dotClass` for the People table, which renders a colored dot + label.
 */
export const DEAL_STAGE_DISPLAY: Record<
  ContactDealStage,
  { label: string; pillClass: string; dotClass: string }
> = {
  pitching: {
    label: "Pitching",
    pillClass: "bg-solid-pink-100 text-solid-pink-700",
    dotClass: "bg-solid-pink-500",
  },
  active: {
    label: "Active",
    pillClass: "bg-buildout-blue-100 text-buildout-blue-700",
    dotClass: "bg-buildout-blue-500",
  },
  under_contract: {
    label: "Under Contract",
    pillClass: "bg-harvest-gold-100 text-harvest-gold-700",
    dotClass: "bg-harvest-gold-500",
  },
  closed: {
    label: "Closed",
    pillClass: "bg-mountain-meadow-100 text-mountain-meadow-700",
    dotClass: "bg-mountain-meadow-500",
  },
};

/** Label + grey dot shown in the Deal Stage column when a contact has no deal. */
export const NO_DEAL_STAGE = {
  label: "None Active",
  dotClass: "bg-storm-grey-400",
} as const;

/** Phone indicator dot color per status. */
export const PHONE_STATUS_DOT: Record<PhoneStatus, string> = {
  valid: "bg-mountain-meadow-500",
  invalid: "bg-destructive",
  unknown: "bg-storm-grey-400",
};

export function contactFullName(c: Contact): string {
  return `${c.firstName} ${c.lastName}`;
}

export function contactInitials(c: Contact): string {
  return `${c.firstName.charAt(0)}${c.lastName.charAt(0)}`.toUpperCase();
}

export function contactAddressLines(c: Contact): [string, string] {
  return [c.street, `${c.city}, ${c.state} ${c.zip}`];
}

/** Listing/deal status pill — Blueprint tokens, parallel to the deal-stage map. */
export const LISTING_STATUS_PILL: Record<
  PropertyStatus,
  { label: string; pillClass: string }
> = {
  proposal: {
    label: STATUS_LABELS.proposal,
    pillClass: "bg-solid-pink-100 text-solid-pink-700",
  },
  active: {
    label: STATUS_LABELS.active,
    pillClass: "bg-buildout-blue-100 text-buildout-blue-700",
  },
  "under-contract": {
    label: STATUS_LABELS["under-contract"],
    pillClass: "bg-harvest-gold-100 text-harvest-gold-700",
  },
  closed: {
    label: STATUS_LABELS.closed,
    pillClass: "bg-mountain-meadow-100 text-mountain-meadow-700",
  },
  inactive: {
    label: STATUS_LABELS.inactive,
    pillClass: "text-destructive",
  },
};

/** One row in the contact's activity timeline. */
export type ContactActivityKind = "created" | "deal";
export interface ContactActivityEntry {
  kind: ContactActivityKind;
  label: string;
  date: string;
}

/** The kinds of activity the compose module can log. */
export type ComposeKind = "note" | "call" | "email" | "meeting" | "tour";

/**
 * An activity logged from the compose module, prepended to the timeline. Held in
 * component state (prototype — not persisted).
 */
export interface ComposedActivity {
  id: string;
  kind: ComposeKind;
  /** Free-text body (note/call/meeting/tour) or email message. */
  body: string;
  /** `yyyy-mm-dd` when the activity took place — editable via the date picker. */
  date: string;
  /** Monotonic creation order so the newest logged item sorts to the top. */
  seq: number;
  /** Call outcome chip (call only), e.g. "Connected". */
  outcome?: string;
  /** Email subject (email only). */
  subject?: string;
  /** Email recipient address (email only). */
  to?: string;
  /** Related deal name, when one was selected. */
  relatedDeal?: string;
}

/** Timeline headline per logged activity kind. */
export const COMPOSE_TIMELINE_TITLE: Record<ComposeKind, string> = {
  note: "You logged a note",
  call: "You logged a call",
  email: "You sent an email",
  meeting: "You logged a meeting",
  tour: "You logged a tour",
};

/** Local `yyyy-mm-dd` for today (no timezone drift). */
export function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * Format a date value as e.g. "Jul 16, 2026". Accepts both full ISO timestamps
 * and plain `yyyy-mm-dd` (pinned to local midnight to avoid a UTC day-shift).
 */
export function medDate(value: string): string {
  const d = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Synthesizes a short activity timeline from the contact + its linked deals. */
export function buildActivity(
  c: Contact,
  deals: DealSummary[],
): ContactActivityEntry[] {
  const entries: ContactActivityEntry[] = deals.map((d) => ({
    kind: "deal",
    label: `Deal opened — ${d.name}`,
    date: c.createdAt,
  }));
  entries.push({
    kind: "created",
    label: `Contact created by ${c.assignedTo}`,
    date: c.createdAt,
  });
  return entries;
}

/** Coarse "Nd ago" relative label from an ISO timestamp. */
function relativeAge(iso: string): string {
  const days = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000));
  if (days === 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  if (days < 60) return `${weeks}w ago`;
  return `${Math.round(days / 30)}mo ago`;
}

/** Short "Last touch" label for the briefing header, e.g. "Task created 1d ago". */
export function buildLastTouch(c: Contact): string {
  return `${c.lastTouch} ${relativeAge(c.lastContactedAt ?? c.createdAt)}`;
}

/**
 * Situation line — how we know them and where the relationship stands. Keyed off
 * the relationship stage; `{source}` is filled with the (lowercased) contact source.
 */
const SITUATION_BY_RELATIONSHIP: Record<RelationshipStage, string> = {
  cold: "Sourced via {source} and still cold — no real relationship yet, so the first job is simply earning a genuine conversation.",
  nurturing:
    "Sourced via {source}; in active nurture with rapport building, but not yet ready to transact.",
  pitching:
    "Mid-pitch and weighing our positioning against other brokers — trust-building is what moves this forward.",
  client:
    "An engaged client with an established working relationship and a track record of transacting with us.",
  past_client:
    "A past client whose closed history makes them a strong candidate for repeat business.",
};

/** "Why now" line — the live reason to reach out, derived from deal posture. */
function buildWhyNow(c: Contact, deals: DealSummary[]): string {
  const deal = deals[0];
  if (deal) {
    switch (deal.status) {
      case "under-contract":
        return `Why now: ${deal.name} is under contract — the close window is short and momentum matters.`;
      case "active":
        return c.side === "buyer"
          ? `Why now: actively hunting for the right asset and ready to move the moment one surfaces.`
          : `Why now: ${deal.name} is on the market and they want to transact before conditions shift.`;
      case "proposal":
        return `Why now: the decision to bring ${deal.name} to market this cycle is live and still up for grabs.`;
      case "closed":
        return `Why now: ${deal.name} just closed — timing is right to tee up the next move.`;
    }
  }
  return c.inquiries > 0
    ? `Why now: ${c.inquiries} open inquir${c.inquiries === 1 ? "y" : "ies"} signal fresh interest worth a fast follow-up.`
    : `Why now: no live deal yet — the opening is to surface a need before a competitor does.`;
}

/** "Where we left off" line — recaps the last touch, or flags a cold start. */
function buildLeftOff(c: Contact): string {
  const touch = c.lastTouch.toLowerCase();
  return c.lastContactedAt
    ? `Where we left off ${relativeAge(c.lastContactedAt)}: ${touch}.`
    : `Not yet directly contacted — ${touch} is the only footprint so far.`;
}

/**
 * A short, narrative AI-style briefing for the contact, built in four beats:
 * identity · situation · why-now · where-we-left-off.
 */
export function buildBriefing(c: Contact, deals: DealSummary[]): string {
  const identity = `${contactFullName(c)}, ${c.title} at ${c.company}.`;
  const situation = SITUATION_BY_RELATIONSHIP[c.relationship].replace(
    "{source}",
    c.source.toLowerCase(),
  );
  return [identity, situation, buildWhyNow(c, deals), buildLeftOff(c)].join(" ");
}
