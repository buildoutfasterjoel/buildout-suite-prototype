import { hash, pickFor, spread } from "#/components/properties/propertyDisplay";
import { isDelgadoListing, isDelgadoOnMarket } from "#/data/rosaDemoStats";
import { getListing } from "#/data/store";

/** Documents a visitor can act on from the listing website. */
const DOCUMENTS = [
  "Offering Memorandum.pdf",
  "Rent Roll 2026.xlsx",
  "T-12 Operating Statement 2025.pdf",
  "Submarket Report.pdf",
  "Site Photos.zip",
];

/**
 * The four things a web visitor does: the CA, then the documents behind it.
 * Signing is what puts a name on a visitor, so anonymous rows never sign.
 */
const ACTIVITY_KINDS = ["Viewed CA", "Signed CA", "Viewed", "Downloaded"] as const;
const ANON_ACTIVITY_KINDS = ACTIVITY_KINDS.filter((k) => k !== "Signed CA");

function activityFor(eventId: string, isAnonymous: boolean): string {
  const kind = pickFor(
    isAnonymous ? ANON_ACTIVITY_KINDS : ACTIVITY_KINDS,
    eventId,
    "activity",
  );
  if (kind === "Viewed CA" || kind === "Signed CA") return kind;
  return `${kind} ${pickFor(DOCUMENTS, eventId, "document")}`;
}

/** Options for the Activity Log's filter dropdown — the kinds `activityFor` emits. */
export const ACTIVITY_FILTER_OPTIONS = [
  "Viewed CA",
  "Signed CA",
  "Viewed Document",
  "Downloaded Document",
];

const FIRST_NAMES = ["Jordan", "Casey", "Morgan", "Riley", "Avery", "Taylor"];
const LAST_NAMES = ["Reed", "Brooks", "Kim", "Patel", "Nguyen", "Ortiz"];

/** A single visitor action on a listing's marketing site. */
export interface WebsiteVisitEvent {
  id: string;
  performedBy: string;
  performedAt: string;
  activity: string;
}

function fmtDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getFullYear()}`;
}

const EVENT_COUNT = 12;

/**
 * Deterministic per-listing website activity derived from the listing id, so
 * values stay stable across renders (same approach as `getListingTraffic`).
 */
export function getListingWebsiteActivity(
  listingId: string,
): WebsiteVisitEvent[] {
  // The Delgado Building has no listing website until the deal goes to market,
  // so its log stays empty while the deal is in Pitching (see rosaDemoStats).
  if (
    isDelgadoListing(listingId) &&
    !isDelgadoOnMarket(getListing(listingId)!.propertyId)
  ) {
    return [];
  }

  // Anchor date matches the prototype "today" used by listingTraffic.ts.
  const anchor = new Date(2026, 5, 26);

  return Array.from({ length: EVENT_COUNT }, (_, i) => {
    const id = `${listingId}-visit-${i}`;
    const date = new Date(anchor);
    date.setDate(date.getDate() - spread(hash(`${id}#day`), 30));

    // A visitor stays unidentified until they fill in the CA, so the log runs
    // about half anonymous.
    const isAnonymous = spread(hash(`${id}#who`), 2) !== 0;
    const performedBy = isAnonymous
      ? "Anonymous User"
      : `${pickFor(FIRST_NAMES, id, "first")} ${pickFor(LAST_NAMES, id, "last")}`;

    return { id, date, performedBy, activity: activityFor(id, isAnonymous) };
  })
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .map(({ date, ...rest }) => ({ ...rest, performedAt: fmtDate(date) }));
}
