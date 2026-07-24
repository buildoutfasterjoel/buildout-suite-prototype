import type {
  Contact,
  ContactDealStage,
  ContactSource,
  DealSide,
  PropertyType,
  RelationshipStage,
} from "#/data/types";
import { getListing, getProperty } from "#/data/store";
import {
  DEAL_STAGE_DISPLAY,
  RELATIONSHIP_DISPLAY,
  SIDE_DISPLAY,
} from "#/components/contacts/contactDisplay";
import { TYPE_LABELS } from "#/components/properties/propertyDisplay";

/**
 * Filter model + predicate for the People directory's Filters flyout.
 *
 * Kept free of JSX so the matching logic stays unit-testable and the page's
 * `filtered` memo can stay thin (mirrors the `contactLists.ts` module style).
 * Option arrays and labels are reused from `contactDisplay.ts` /
 * `propertyDisplay.ts` — this module only owns filter *state* and *matching*.
 */

/** Sentinel for the single-select fields (Assigned To) = "no filter". */
export const ALL = "all";

/**
 * Last-activity buckets, matched against a contact's real `lastContactedAt`
 * date. "within" buckets require a contact date within N days; "over" buckets
 * require it older than N days; `never` matches contacts never contacted.
 */
export type LastActivityKey =
  | "any"
  | "7d"
  | "30d"
  | "90d"
  | "30to90"
  | "over90"
  | "over1y"
  | "never";

export const LAST_ACTIVITY_OPTIONS: { key: LastActivityKey; label: string }[] = [
  { key: "any", label: "Any Time" },
  { key: "7d", label: "Past 7 Days" },
  { key: "30d", label: "Past 30 Days" },
  { key: "90d", label: "Past 90 Days" },
  { key: "30to90", label: "30–90 Days Ago" },
  { key: "over90", label: "Over 90 Days Ago" },
  { key: "over1y", label: "Over a Year Ago" },
  { key: "never", label: "Never Contacted" },
];

const DAY = 24 * 60 * 60 * 1000;

/** Whether a contact's last-contact date satisfies a last-activity bucket. */
function matchesLastActivity(
  lastContactedAt: string | null,
  key: LastActivityKey,
): boolean {
  if (key === "any") return true;
  if (key === "never") return lastContactedAt === null;
  if (lastContactedAt === null) return false; // date buckets need a real date
  const age = Date.now() - Date.parse(lastContactedAt);
  switch (key) {
    case "7d":
      return age <= 7 * DAY;
    case "30d":
      return age <= 30 * DAY;
    case "90d":
      return age <= 90 * DAY;
    case "30to90":
      return age >= 30 * DAY && age <= 90 * DAY;
    case "over90":
      return age > 90 * DAY;
    case "over1y":
      return age > 365 * DAY;
    default:
      return true;
  }
}

/** Tri-state open-tasks filter. */
export type OpenTasksFilter = "any" | "has" | "none";

export const OPEN_TASKS_OPTIONS: { key: OpenTasksFilter; label: string }[] = [
  { key: "any", label: "Any" },
  { key: "has", label: "Has open tasks" },
  { key: "none", label: "No open tasks" },
];

/**
 * Listing-inquiries modes: `none` = filter off, `any` = contacts with at least
 * one listing inquiry, `listing` = contacts who inquired about one specific
 * listing (picked separately as `inquiryListingId`).
 */
export type ListingInquiriesFilter = "none" | "any" | "listing";

export const LISTING_INQUIRY_OPTIONS: {
  key: ListingInquiriesFilter;
  label: string;
}[] = [
  { key: "none", label: "None" },
  { key: "any", label: "Any Listing Inquiry" },
  { key: "listing", label: "Specific Listing" },
];

export interface ContactFilterState {
  /** Single-select (ALL = no filter). */
  assignedTo: string;
  /** Multi-select checkbox groups (empty set = no filter). */
  source: Set<ContactSource>;
  side: Set<DealSide>;
  relationship: Set<RelationshipStage>;
  dealStage: Set<ContactDealStage>;
  propertyTypes: Set<PropertyType>;
  tags: Set<string>;
  /** Single-select radio group. */
  lastActivity: LastActivityKey;
  /** Tri-state open-tasks filter. */
  openTasks: OpenTasksFilter;
  /** Listing-inquiries mode; `listing` filters by {@link inquiryListingId}. */
  listingInquiries: ListingInquiriesFilter;
  /** The specific listing for `listingInquiries: "listing"` (null = not picked yet). */
  inquiryListingId: string | null;
  /** Wired toggle. */
  excludeDoNotCall: boolean;
}

export function emptyContactFilters(): ContactFilterState {
  return {
    assignedTo: ALL,
    source: new Set(),
    side: new Set(),
    relationship: new Set(),
    dealStage: new Set(),
    propertyTypes: new Set(),
    tags: new Set(),
    lastActivity: "any",
    openTasks: "any",
    listingInquiries: "none",
    inquiryListingId: null,
    excludeDoNotCall: false,
  };
}

/** The distinct property types a contact is linked to (via their properties). */
export function contactPropertyTypes(c: Contact): Set<PropertyType> {
  const types = new Set<PropertyType>();
  for (const id of c.propertyIds) {
    const p = getProperty(id);
    if (p) types.add(p.propertyType);
  }
  return types;
}

/** True when the contact passes every *wired* filter in `f`. */
export function matchesContactFilters(
  c: Contact,
  f: ContactFilterState,
): boolean {
  if (f.assignedTo !== ALL && c.assignedTo !== f.assignedTo) return false;

  // Multi-select groups: OR within a group, AND across groups.
  if (f.source.size && !f.source.has(c.source)) return false;
  if (f.side.size && (!c.side || !f.side.has(c.side))) return false;
  if (f.relationship.size && !f.relationship.has(c.relationship)) return false;
  if (f.dealStage.size && (!c.dealStage || !f.dealStage.has(c.dealStage)))
    return false;
  if (f.tags.size && !c.tags.some((t) => f.tags.has(t))) return false;

  if (f.propertyTypes.size) {
    const owned = contactPropertyTypes(c);
    let hit = false;
    for (const t of f.propertyTypes) {
      if (owned.has(t)) {
        hit = true;
        break;
      }
    }
    if (!hit) return false;
  }

  if (f.excludeDoNotCall && c.doNotCall) return false;

  if (!matchesLastActivity(c.lastContactedAt, f.lastActivity)) return false;

  if (f.openTasks === "has" && c.openTaskCount <= 0) return false;
  if (f.openTasks === "none" && c.openTaskCount > 0) return false;

  const inquired = c.inquiredListingIds ?? [];
  if (f.listingInquiries === "any" && inquired.length === 0) return false;
  // "listing" only filters once a listing is actually picked.
  if (
    f.listingInquiries === "listing" &&
    f.inquiryListingId &&
    !inquired.includes(f.inquiryListingId)
  )
    return false;

  return true;
}

/**
 * One removable chip per active *wired* filter value. Drives the toolbar chips,
 * the "Filters (N)" count, and the flyout footer count — so chips, count, and
 * results always agree.
 */
export interface ContactFilterChip {
  key: string;
  group: string;
  value: string;
  /** Returns a new filter state with just this value cleared. */
  clear: (f: ContactFilterState) => ContactFilterState;
}

function withoutSetValue<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  next.delete(value);
  return next;
}

export function contactFilterChips(f: ContactFilterState): ContactFilterChip[] {
  const chips: ContactFilterChip[] = [];

  if (f.assignedTo !== ALL) {
    chips.push({
      key: "assignedTo",
      group: "Assigned To",
      value: f.assignedTo,
      clear: (s) => ({ ...s, assignedTo: ALL }),
    });
  }
  for (const v of f.source) {
    chips.push({
      key: `source:${v}`,
      group: "Source",
      value: v,
      clear: (s) => ({ ...s, source: withoutSetValue(s.source, v) }),
    });
  }
  for (const v of f.side) {
    chips.push({
      key: `side:${v}`,
      group: "Side",
      value: SIDE_DISPLAY[v].label,
      clear: (s) => ({ ...s, side: withoutSetValue(s.side, v) }),
    });
  }
  for (const v of f.relationship) {
    chips.push({
      key: `relationship:${v}`,
      group: "Contact Stage",
      value: RELATIONSHIP_DISPLAY[v].label,
      clear: (s) => ({ ...s, relationship: withoutSetValue(s.relationship, v) }),
    });
  }
  for (const v of f.dealStage) {
    chips.push({
      key: `dealStage:${v}`,
      group: "Deal Stage",
      value: DEAL_STAGE_DISPLAY[v].label,
      clear: (s) => ({ ...s, dealStage: withoutSetValue(s.dealStage, v) }),
    });
  }
  for (const v of f.propertyTypes) {
    chips.push({
      key: `propertyType:${v}`,
      group: "Property Type",
      value: TYPE_LABELS[v],
      clear: (s) => ({ ...s, propertyTypes: withoutSetValue(s.propertyTypes, v) }),
    });
  }
  for (const v of f.tags) {
    chips.push({
      key: `tag:${v}`,
      group: "Tag",
      value: v,
      clear: (s) => ({ ...s, tags: withoutSetValue(s.tags, v) }),
    });
  }
  if (f.lastActivity !== "any") {
    const opt = LAST_ACTIVITY_OPTIONS.find((o) => o.key === f.lastActivity);
    chips.push({
      key: "lastActivity",
      group: "Last Activity",
      value: opt?.label ?? f.lastActivity,
      clear: (s) => ({ ...s, lastActivity: "any" }),
    });
  }
  if (f.openTasks !== "any") {
    chips.push({
      key: "openTasks",
      group: "Open Tasks",
      value: f.openTasks === "has" ? "Has open tasks" : "No open tasks",
      clear: (s) => ({ ...s, openTasks: "any" }),
    });
  }
  // One chip covers the whole listing-inquiries group; clearing it resets the
  // picked listing too. A "listing" mode with nothing picked isn't filtering
  // yet, so it gets no chip.
  if (
    f.listingInquiries === "any" ||
    (f.listingInquiries === "listing" && f.inquiryListingId)
  ) {
    chips.push({
      key: "listingInquiries",
      group: "Listing Inquiries",
      value:
        f.listingInquiries === "any"
          ? "Any Listing Inquiry"
          : getListing(f.inquiryListingId!)?.name ?? "Specific Listing",
      clear: (s) => ({ ...s, listingInquiries: "none", inquiryListingId: null }),
    });
  }
  if (f.excludeDoNotCall) {
    chips.push({
      key: "excludeDoNotCall",
      group: "Exclude",
      value: "Do Not Call",
      clear: (s) => ({ ...s, excludeDoNotCall: false }),
    });
  }

  return chips;
}

/** Count of active filters — number of chips (visual-only fields excluded). */
export function countActiveContactFilters(f: ContactFilterState): number {
  return contactFilterChips(f).length;
}

/** A friendly default name for a dynamic list built from the active filters. */
export function autoDynamicListName(f: ContactFilterState): string {
  const values = contactFilterChips(f).map((c) => c.value);
  if (values.length === 0) return "Filtered Contacts";
  const head = values.slice(0, 3).join(", ");
  const extra = values.length - 3;
  return extra > 0 ? `${head} +${extra}` : head;
}

/** JSON-safe form of {@link ContactFilterState} for persisting on a list. */
export interface SerializedContactFilters {
  assignedTo: string;
  source: ContactSource[];
  side: DealSide[];
  relationship: RelationshipStage[];
  dealStage: ContactDealStage[];
  propertyTypes: PropertyType[];
  tags: string[];
  lastActivity: LastActivityKey;
  openTasks: OpenTasksFilter;
  listingInquiries: ListingInquiriesFilter;
  inquiryListingId: string | null;
  excludeDoNotCall: boolean;
}

export function serializeContactFilters(
  f: ContactFilterState,
): SerializedContactFilters {
  return {
    assignedTo: f.assignedTo,
    source: [...f.source],
    side: [...f.side],
    relationship: [...f.relationship],
    dealStage: [...f.dealStage],
    propertyTypes: [...f.propertyTypes],
    tags: [...f.tags],
    lastActivity: f.lastActivity,
    openTasks: f.openTasks,
    listingInquiries: f.listingInquiries,
    inquiryListingId: f.inquiryListingId,
    excludeDoNotCall: f.excludeDoNotCall,
  };
}

export function deserializeContactFilters(
  s: SerializedContactFilters,
): ContactFilterState {
  return {
    assignedTo: s.assignedTo ?? ALL,
    source: new Set(s.source ?? []),
    side: new Set(s.side ?? []),
    relationship: new Set(s.relationship ?? []),
    dealStage: new Set(s.dealStage ?? []),
    propertyTypes: new Set(s.propertyTypes ?? []),
    tags: new Set(s.tags ?? []),
    lastActivity: s.lastActivity ?? "any",
    openTasks: s.openTasks ?? "any",
    listingInquiries: s.listingInquiries ?? "none",
    inquiryListingId: s.inquiryListingId ?? null,
    excludeDoNotCall: s.excludeDoNotCall ?? false,
  };
}

function setsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

/** Structural equality over the *wired* filter fields (ignores visual-only). */
export function filtersEqual(
  a: ContactFilterState,
  b: ContactFilterState,
): boolean {
  return (
    a.assignedTo === b.assignedTo &&
    a.lastActivity === b.lastActivity &&
    a.openTasks === b.openTasks &&
    a.listingInquiries === b.listingInquiries &&
    a.inquiryListingId === b.inquiryListingId &&
    a.excludeDoNotCall === b.excludeDoNotCall &&
    setsEqual(a.source, b.source) &&
    setsEqual(a.side, b.side) &&
    setsEqual(a.relationship, b.relationship) &&
    setsEqual(a.dealStage, b.dealStage) &&
    setsEqual(a.propertyTypes, b.propertyTypes) &&
    setsEqual(a.tags, b.tags)
  );
}
