import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faSnowflake,
  faFlag,
  faClock,
  faFire,
  faStar,
  faSackDollar,
  faListUl,
} from "@fortawesome/pro-regular-svg-icons";
import type { Contact } from "#/data/types";

/**
 * Saved "Contact Lists" segments shown in the People left panel. Each list is a
 * real predicate over the contact data, so the sidebar counts and the filtered
 * table always reflect the actual dataset (no hardcoded numbers).
 */
/**
 * How a list is maintained: "dynamic" lists update automatically from a rule
 * (their `predicate`); "static" lists are hand-curated collections.
 */
export type ContactListType = "dynamic" | "static";

export interface ContactList {
  id: string;
  label: string;
  icon: IconDefinition;
  /** Palette text-color utility for the leading icon. */
  iconClass: string;
  /** Soft-pill background utility used behind the icon in the overview cards. */
  iconBgClass: string;
  /** One-line summary of what the list contains. */
  description: string;
  type: ContactListType;
  /** ISO date the list was created. */
  createdOn: string;
  /** ISO date the list was last updated. */
  lastUpdated: string;
  /** Team member who last updated the list. */
  lastUpdatedBy: string;
  /** Days since the last activity on the list (for the "Nd ago" column). */
  lastActivityDays: number;
  /** Share of the list's contacts that have been reached, 0–100. */
  pctReached: number;
  predicate: (c: Contact) => boolean;
}

export const CONTACT_LISTS: ContactList[] = [
  {
    id: "cold-prospects",
    label: "Cold prospects to warm",
    icon: faSnowflake,
    iconClass: "text-seagull-700",
    iconBgClass: "bg-seagull-100",
    description: "Cold contacts worth an intro touch.",
    type: "dynamic",
    createdOn: "2024-05-01",
    lastUpdated: "2026-06-26",
    lastUpdatedBy: "Peter Parker",
    lastActivityDays: 1,
    pctReached: 50,
    predicate: (c) => c.relationship === "cold",
  },
  {
    id: "open-follow-up",
    label: "Has an open follow-up",
    icon: faFlag,
    iconClass: "text-harvest-gold-700",
    iconBgClass: "bg-harvest-gold-100",
    description: "Contacts with an open inquiry to follow up on.",
    type: "dynamic",
    createdOn: "2024-03-15",
    lastUpdated: "2026-06-20",
    lastUpdatedBy: "Natasha Romanoff",
    lastActivityDays: 2,
    pctReached: 42,
    predicate: (c) => c.inquiries > 0,
  },
  {
    id: "stale-clients",
    label: "Clients, haven't reached in 30 days",
    icon: faClock,
    iconClass: "text-storm-grey-700",
    iconBgClass: "bg-storm-grey-100",
    description: "Past clients you haven't reached recently.",
    type: "dynamic",
    createdOn: "2023-11-02",
    lastUpdated: "2026-05-30",
    lastUpdatedBy: "Bruce Wayne",
    lastActivityDays: 5,
    pctReached: 28,
    predicate: (c) => c.relationship === "past_client",
  },
  {
    id: "hot-list",
    label: "Hot List",
    icon: faFire,
    iconClass: "text-solid-pink-700",
    iconBgClass: "bg-solid-pink-100",
    description: "Active and pitching — your hottest opportunities.",
    type: "static",
    createdOn: "2024-01-10",
    lastUpdated: "2026-06-25",
    lastUpdatedBy: "Tony Stark",
    lastActivityDays: 1,
    pctReached: 76,
    predicate: (c) => c.relationship === "pitching" || c.relationship === "active",
  },
  {
    id: "a-list",
    label: "A List",
    icon: faStar,
    iconClass: "text-buildout-blue-700",
    iconBgClass: "bg-buildout-blue-100",
    description: "Your VIP relationships.",
    type: "static",
    createdOn: "2022-08-21",
    lastUpdated: "2026-04-12",
    lastUpdatedBy: "Diana Prince",
    lastActivityDays: 12,
    pctReached: 88,
    predicate: (c) => c.tags.includes("VIP"),
  },
  {
    id: "investors",
    label: "Investors",
    icon: faSackDollar,
    iconClass: "text-mountain-meadow-700",
    iconBgClass: "bg-mountain-meadow-100",
    description: "Contacts tagged as investors.",
    type: "static",
    createdOn: "2023-06-05",
    lastUpdated: "2026-06-18",
    lastUpdatedBy: "Steve Rogers",
    lastActivityDays: 3,
    pctReached: 64,
    predicate: (c) => c.tags.includes("Investor"),
  },
];

/**
 * A user/AI-created contact "call list". Unlike the built-in {@link ContactList}s
 * (which filter live via a `predicate`), these persist to the store as a **membership
 * snapshot** (`contactIds`) — predicate functions can't be serialized to IndexedDB.
 */
export interface CallList {
  id: string;
  label: string;
  description: string;
  /** ISO date created. */
  createdOn: string;
  /** Materialized membership — the contact ids captured when the list was made. */
  contactIds: string[];
  /** Where the list came from. */
  source: "user" | "ai";
}

/** The "All Contacts" pseudo-list id — pass-through, no filtering. */
export const ALL_CONTACTS_ID = "all";

/** Membership predicate for a user/AI call list (snapshot by contact id). */
export function callListPredicate(list: CallList): (c: Contact) => boolean {
  const ids = new Set(list.contactIds);
  return (c) => ids.has(c.id);
}

/**
 * Adapt a persisted {@link CallList} into the {@link ContactList} display shape so
 * the People UI (sidebar + overview) can render built-in and user/AI lists
 * uniformly. Its `predicate` filters by the stored membership snapshot.
 */
export function callListToContactList(cl: CallList): ContactList {
  return {
    id: cl.id,
    label: cl.label,
    icon: faListUl,
    iconClass: "text-buildout-blue-700",
    iconBgClass: "bg-buildout-blue-100",
    description: cl.description,
    type: "static",
    createdOn: cl.createdOn,
    lastUpdated: cl.createdOn,
    lastUpdatedBy: cl.source === "ai" ? "Assistant" : "You",
    lastActivityDays: 0,
    pctReached: 0,
    predicate: callListPredicate(cl),
  };
}

/**
 * Resolve the active predicate across built-in lists and user/AI call lists.
 * "all" (and unknown ids) match everything.
 */
export function listPredicate(
  listId: string,
  callLists: CallList[] = [],
): (c: Contact) => boolean {
  const builtIn = CONTACT_LISTS.find((l) => l.id === listId);
  if (builtIn) return builtIn.predicate;
  const userList = callLists.find((l) => l.id === listId);
  return userList ? callListPredicate(userList) : () => true;
}
