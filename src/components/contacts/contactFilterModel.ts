import type {
  Contact,
  ContactDealStage,
  DealSide,
  PropertyType,
  RelationshipStage,
} from "#/data/types";
import { getProperty } from "#/data/store";
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

/** Sentinel for the single-select fields (Assigned To, Source) = "no filter". */
export const ALL = "all";

/** Last-activity buckets, matched against a contact's `lastTouch` date. */
export type LastActivityKey =
  | "any"
  | "7d"
  | "30d"
  | "90d"
  | "6m"
  | "1y"
  | "over1y";

export const LAST_ACTIVITY_OPTIONS: { key: LastActivityKey; label: string }[] = [
  { key: "any", label: "Any Time" },
  { key: "7d", label: "Past 7 Days" },
  { key: "30d", label: "Past 30 Days" },
  { key: "90d", label: "Past 90 Days" },
  { key: "6m", label: "Past 6 Months" },
  { key: "1y", label: "Past Year" },
  { key: "over1y", label: "Over a Year Ago" },
];

/** Millisecond windows for the "within the last …" buckets. */
const DAY = 24 * 60 * 60 * 1000;
const LAST_ACTIVITY_WINDOW_MS: Partial<Record<LastActivityKey, number>> = {
  "7d": 7 * DAY,
  "30d": 30 * DAY,
  "90d": 90 * DAY,
  "6m": 182 * DAY,
  "1y": 365 * DAY,
};

export interface ContactFilterState {
  /** Single-select (ALL = no filter). */
  assignedTo: string;
  source: string;
  /** Multi-select checkbox groups (empty set = no filter). */
  side: Set<DealSide>;
  relationship: Set<RelationshipStage>;
  dealStage: Set<ContactDealStage>;
  propertyTypes: Set<PropertyType>;
  tags: Set<string>;
  /** Single-select radio group. */
  lastActivity: LastActivityKey;
  /** Wired toggle. */
  excludeDoNotCall: boolean;
  /** Visual-only for now — not applied in `matchesContactFilters`. */
  hasOpenTasks: boolean;
}

export function emptyContactFilters(): ContactFilterState {
  return {
    assignedTo: ALL,
    source: ALL,
    side: new Set(),
    relationship: new Set(),
    dealStage: new Set(),
    propertyTypes: new Set(),
    tags: new Set(),
    lastActivity: "any",
    excludeDoNotCall: false,
    hasOpenTasks: false,
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
  if (f.source !== ALL && c.source !== f.source) return false;

  // Multi-select groups: OR within a group, AND across groups.
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

  if (f.lastActivity !== "any") {
    const age = Date.now() - Date.parse(c.lastTouch);
    if (f.lastActivity === "over1y") {
      if (age <= 365 * DAY) return false;
    } else {
      const window = LAST_ACTIVITY_WINDOW_MS[f.lastActivity];
      if (window !== undefined && age > window) return false;
    }
  }

  // `hasOpenTasks` is intentionally not applied yet (visual-only).
  return true;
}

/**
 * One removable chip per active *wired* filter value. Drives the toolbar chips,
 * the "Filters (N)" count, and the flyout footer count. Visual-only fields
 * (`hasOpenTasks`, `listingInquiries`) are intentionally excluded so chips,
 * count, and results always agree.
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
  if (f.source !== ALL) {
    chips.push({
      key: "source",
      group: "Source",
      value: f.source,
      clear: (s) => ({ ...s, source: ALL }),
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
  source: string;
  side: DealSide[];
  relationship: RelationshipStage[];
  dealStage: ContactDealStage[];
  propertyTypes: PropertyType[];
  tags: string[];
  lastActivity: LastActivityKey;
  excludeDoNotCall: boolean;
}

export function serializeContactFilters(
  f: ContactFilterState,
): SerializedContactFilters {
  return {
    assignedTo: f.assignedTo,
    source: f.source,
    side: [...f.side],
    relationship: [...f.relationship],
    dealStage: [...f.dealStage],
    propertyTypes: [...f.propertyTypes],
    tags: [...f.tags],
    lastActivity: f.lastActivity,
    excludeDoNotCall: f.excludeDoNotCall,
  };
}

export function deserializeContactFilters(
  s: SerializedContactFilters,
): ContactFilterState {
  return {
    assignedTo: s.assignedTo ?? ALL,
    source: s.source ?? ALL,
    side: new Set(s.side ?? []),
    relationship: new Set(s.relationship ?? []),
    dealStage: new Set(s.dealStage ?? []),
    propertyTypes: new Set(s.propertyTypes ?? []),
    tags: new Set(s.tags ?? []),
    lastActivity: s.lastActivity ?? "any",
    excludeDoNotCall: s.excludeDoNotCall ?? false,
    hasOpenTasks: false,
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
    a.source === b.source &&
    a.lastActivity === b.lastActivity &&
    a.excludeDoNotCall === b.excludeDoNotCall &&
    setsEqual(a.side, b.side) &&
    setsEqual(a.relationship, b.relationship) &&
    setsEqual(a.dealStage, b.dealStage) &&
    setsEqual(a.propertyTypes, b.propertyTypes) &&
    setsEqual(a.tags, b.tags)
  );
}
