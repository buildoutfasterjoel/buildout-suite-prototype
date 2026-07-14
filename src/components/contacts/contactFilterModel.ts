import type {
  Contact,
  ContactDealStage,
  DealSide,
  PropertyType,
  RelationshipStage,
} from "#/data/types";
import { getProperty } from "#/data/store";

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

/** Total count of active selections — drives the "N selected" footer. */
export function countActiveContactFilters(f: ContactFilterState): number {
  let n = 0;
  if (f.assignedTo !== ALL) n += 1;
  if (f.source !== ALL) n += 1;
  n += f.side.size;
  n += f.relationship.size;
  n += f.dealStage.size;
  n += f.propertyTypes.size;
  n += f.tags.size;
  if (f.lastActivity !== "any") n += 1;
  if (f.excludeDoNotCall) n += 1;
  if (f.hasOpenTasks) n += 1;
  return n;
}
