import { getContactByHeroKey, getListing } from "#/data/store";

/**
 * Hand-set marketing stats for The Delgado Building — Rosa's owned building
 * in the scripted demo arc. Every other listing's stats are hash-derived from
 * its id; the Delgado Building's are pinned so the story reads right: a deal
 * that just went to market (10 days) with a small, fresh trickle of website
 * traffic rather than a year of made-up history.
 */
export const DELGADO_DAYS_ON_MARKET = 10;

export const DELGADO_WEBSITE_TRAFFIC = {
  pageViews: 350,
  uniqueVisitors: 200,
  leads: 3,
} as const;

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
