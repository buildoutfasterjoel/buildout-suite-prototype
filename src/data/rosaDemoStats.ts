import { getContactByHeroKey, getListing, getListingsForProperty } from "#/data/store";
import type { PropertyStatus } from "#/data/types";

/**
 * Hand-set marketing stats for The Delgado Building — Rosa's owned building
 * in the scripted demo arc. Every other listing's stats are hash-derived from
 * its id; the Delgado Building's follow the story instead.
 *
 * While the deal is still in Pitching there is no listing website and no
 * market exposure, so everything reads zero. Once the deal goes Active the
 * numbers land at "just went to market": ten days, a small fresh trickle of
 * traffic, the first three leads — not a year of made-up history.
 */
export const DELGADO_DAYS_ON_MARKET = 10;

export const DELGADO_WEBSITE_TRAFFIC = {
  pageViews: 350,
  uniqueVisitors: 200,
  leads: 3,
} as const;

export const DELGADO_PRE_MARKET_TRAFFIC = {
  pageViews: 0,
  uniqueVisitors: 0,
  leads: 0,
} as const;

/** Stages at which the building has actually been exposed to the market. */
const ON_MARKET_STATUSES = new Set<PropertyStatus>([
  "active",
  "under-contract",
  "closed",
]);

/** True when `propertyId` is a building Rosa owns (The Delgado Building). */
export function isDelgadoBuilding(propertyId: string): boolean {
  const rosa = getContactByHeroKey("rosa");
  return rosa?.ownedPropertyIds?.includes(propertyId) ?? false;
}

/** True when the listing sits on The Delgado Building. */
export function isDelgadoListing(listingId: string): boolean {
  const listing = getListing(listingId);
  return listing ? isDelgadoBuilding(listing.propertyId) : false;
}

/**
 * True once a deal on The Delgado Building has left Pitching for the market.
 * The arc flips the deal to Active through the Approve & Publish gate; a
 * later stage still counts, since the listing has been live at some point.
 */
export function isDelgadoOnMarket(propertyId: string): boolean {
  return getListingsForProperty(propertyId).some((l) =>
    ON_MARKET_STATUSES.has(l.status),
  );
}

/** Days on market for The Delgado Building: zero until the deal is live. */
export function delgadoDaysOnMarket(propertyId: string): number {
  return isDelgadoOnMarket(propertyId) ? DELGADO_DAYS_ON_MARKET : 0;
}

/** Website headline numbers for The Delgado Building, by stage. */
export function delgadoWebsiteTraffic(propertyId: string) {
  return isDelgadoOnMarket(propertyId)
    ? DELGADO_WEBSITE_TRAFFIC
    : DELGADO_PRE_MARKET_TRAFFIC;
}
