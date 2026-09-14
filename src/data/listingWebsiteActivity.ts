import { hash, pickFor, spread } from "#/components/properties/propertyDisplay";
import { isDelgadoListing, isDelgadoOnMarket } from "#/data/rosaDemoStats";
import { getLeadsForProperty, getListing } from "#/data/store";
import { dealShape } from "#/data/dealShape";
import { leadsForSpaceDeal } from "#/data/unitScopedMarketing";
import type { Listing } from "#/data/types";

/** Documents a visitor can act on from the listing website. */
const DOCUMENTS = [
  "Offering Memorandum.pdf",
  "Rent Roll 2026.xlsx",
  "T-12 Operating Statement 2025.pdf",
  "Submarket Report.pdf",
  "Site Photos.zip",
];

/** The four things a web visitor does: the CA, then the documents behind it. */
const ACTIVITY_KINDS = ["Viewed CA", "Signed CA", "Viewed", "Downloaded"] as const;

function activityFor(eventId: string): string {
  const kind = pickFor(ACTIVITY_KINDS, eventId, "activity");
  if (kind === "Viewed CA" || kind === "Signed CA") return kind;
  return `${kind} ${pickFor(DOCUMENTS, eventId, "document")}`;
}

/**
 * The named rows are this deal's inquirers — the same roster its Inquiries page
 * lists, scoped the same way (a space deal shows only its own inquirers). Every
 * other row is an anonymous visitor, who can do anything a lead can: the
 * website gates documents behind a CA, not behind being a known contact.
 */
function inquirerNames(listing: Listing): string[] {
  const scoped = leadsForSpaceDeal(
    getLeadsForProperty(listing.propertyId),
    dealShape(listing) === "space" ? listing.id : null,
  );
  return scoped.map((c) => `${c.firstName} ${c.lastName}`.trim());
}

/** Options for the Activity Log's filter dropdown — the kinds `activityFor` emits. */
export const ACTIVITY_FILTER_OPTIONS = [
  "Viewed CA",
  "Signed CA",
  "Viewed Document",
  "Downloaded Document",
];

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
  const listing = getListing(listingId);
  if (!listing) return [];

  // The Delgado Building has no listing website until the deal goes to market,
  // so its log stays empty while the deal is in Pitching (see rosaDemoStats).
  if (isDelgadoListing(listingId) && !isDelgadoOnMarket(listing.propertyId)) {
    return [];
  }

  const names = inquirerNames(listing);

  // Anchor date matches the prototype "today" used by listingTraffic.ts.
  const anchor = new Date(2026, 5, 26);

  return Array.from({ length: EVENT_COUNT }, (_, i) => {
    const id = `${listingId}-visit-${i}`;
    const date = new Date(anchor);
    date.setDate(date.getDate() - spread(hash(`${id}#day`), 30));

    const performedBy =
      names.length > 0 && spread(hash(`${id}#who`), 2) === 0
        ? pickFor(names, id, "lead")
        : "Anonymous User";

    return { id, date, performedBy, activity: activityFor(id) };
  })
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .map(({ date, ...rest }) => ({ ...rest, performedAt: fmtDate(date) }));
}
