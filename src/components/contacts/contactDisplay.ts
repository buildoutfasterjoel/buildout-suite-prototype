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
  "active",
  "pitching",
  "client",
  "past_client",
];

export const CONTACT_SOURCES: ContactSource[] = [
  "Public records",
  "Cold outreach",
  "Prospect by Buildout",
  "Referral",
  "Networking event",
];

export const DEAL_SIDES: DealSide[] = ["buyer", "seller"];

export const CONTACT_DEAL_STAGES: ContactDealStage[] = [
  "active_search",
  "active_listing",
  "pitching",
  "under_contract",
  "closed",
  "lost",
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
  active: {
    label: "Active",
    dotClass: "bg-solid-pink-500",
    pillClass: "bg-solid-pink-100 text-solid-pink-700",
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
 * Deal-stage display: soft `pillClass` (used in the detail views) plus a
 * `dotClass` for the People table, which renders a colored dot + label.
 */
export const DEAL_STAGE_DISPLAY: Record<
  ContactDealStage,
  { label: string; pillClass: string; dotClass: string }
> = {
  active_search: {
    label: "Active Search",
    pillClass: "bg-buildout-blue-100 text-buildout-blue-700",
    dotClass: "bg-buildout-blue-500",
  },
  active_listing: {
    label: "Active Listing",
    pillClass: "bg-buildout-blue-100 text-buildout-blue-700",
    dotClass: "bg-buildout-blue-500",
  },
  pitching: {
    label: "Pitching",
    pillClass: "bg-solid-pink-100 text-solid-pink-700",
    dotClass: "bg-solid-pink-500",
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
  lost: {
    label: "Lost",
    pillClass: "text-destructive",
    dotClass: "bg-destructive",
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

/** A one-to-two sentence AI-style briefing for the contact. */
export function buildBriefing(c: Contact, deals: DealSummary[]): string {
  const rel = RELATIONSHIP_DISPLAY[c.relationship].label;
  const sidePart = c.side
    ? ` on the ${SIDE_DISPLAY[c.side].label.toLowerCase()} side`
    : "";
  const dealPart = deals.length
    ? ` Tracking ${deals.length} deal${deals.length > 1 ? "s" : ""}: ${deals
        .map((d) => d.name)
        .join(", ")}.`
    : "";
  return `${contactFullName(c)}, ${c.title} at ${c.company}. ${rel} relationship${sidePart}, sourced via ${c.source.toLowerCase()}.${dealPart}`;
}
