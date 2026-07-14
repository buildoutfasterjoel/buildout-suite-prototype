import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { faListUl, faFilter } from "@fortawesome/pro-regular-svg-icons";
import type { Contact } from "#/data/types";
import {
  deserializeContactFilters,
  matchesContactFilters,
  type SerializedContactFilters,
} from "#/components/contacts/contactFilterModel";

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
  /** Optional raw hex applied inline to the icon (dynamic lists pick a color). */
  iconColor?: string;
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

/**
 * The pre-defined lists now ship as seeded, editable **dynamic** call lists
 * (see `seedCallLists()` in `seed.ts`) rather than hardcoded predicates, so
 * this built-in array is intentionally empty. Kept for the type + consumers
 * that merge `[...CONTACT_LISTS, ...userLists]`.
 */
export const CONTACT_LISTS: ContactList[] = [];

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
  /**
   * How membership is maintained. Omitted/`"static"` lists use the `contactIds`
   * snapshot; `"dynamic"` lists evaluate {@link filters} live.
   */
  type?: ContactListType;
  /** Saved filter criteria for a dynamic list (evaluated live, JSON-safe). */
  filters?: SerializedContactFilters;
  /** Raw hex for the list's icon color (chosen in the create modal). */
  color?: string;
}

/** The "All Contacts" pseudo-list id — pass-through, no filtering. */
export const ALL_CONTACTS_ID = "all";

/**
 * Membership predicate for a user/AI call list. Dynamic lists evaluate their
 * saved filter criteria live (so contacts join/leave as their data changes);
 * static lists match the stored contact-id snapshot.
 */
export function callListPredicate(list: CallList): (c: Contact) => boolean {
  if (list.type === "dynamic" && list.filters) {
    const filters = deserializeContactFilters(list.filters);
    return (c) => matchesContactFilters(c, filters);
  }
  const ids = new Set(list.contactIds);
  return (c) => ids.has(c.id);
}

/**
 * Adapt a persisted {@link CallList} into the {@link ContactList} display shape so
 * the People UI (sidebar + overview) can render built-in and user/AI lists
 * uniformly. Its `predicate` filters by the stored membership snapshot.
 */
export function callListToContactList(cl: CallList): ContactList {
  const isDynamic = cl.type === "dynamic";
  return {
    id: cl.id,
    label: cl.label,
    // Dynamic lists get a funnel icon in their chosen color so they read as
    // filter-driven; static/AI lists keep the neutral list glyph.
    icon: isDynamic ? faFilter : faListUl,
    iconClass: "text-buildout-blue-700",
    iconColor: cl.color,
    iconBgClass: "bg-buildout-blue-100",
    description: cl.description,
    type: isDynamic ? "dynamic" : "static",
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
