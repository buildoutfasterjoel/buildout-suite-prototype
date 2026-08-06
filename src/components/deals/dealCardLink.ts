import type { Listing } from "#/data/types";
import { getListing } from "#/data/store";

/**
 * Where a card for this deal should go. A space deal has its own page, nested
 * under its building, so a space card opens that page rather than the building's
 * suite directory. Every card surface shares this one rule, so a space can never
 * lose its page by way of an un-updated link.
 */
export function dealCardLinkProps(listing: Listing):
  | { to: "/listings/$listingId"; params: { listingId: string } }
  | {
      to: "/listings/$listingId/spaces/$spaceId/overview";
      params: { listingId: string; spaceId: string };
    } {
  if (listing.parentDealId) {
    return {
      to: "/listings/$listingId/spaces/$spaceId/overview",
      params: { listingId: listing.parentDealId, spaceId: listing.id },
    };
  }
  return { to: "/listings/$listingId", params: { listingId: listing.id } };
}

/**
 * The listing whose page owns a building-level section for this deal. Sections
 * like Documents and Leads belong to the building, so a space resolves to its
 * parent and everything else to itself. Takes an id rather than a Listing
 * because most callers only hold the id.
 */
export function buildingSectionListingId(listingId: string): string {
  return getListing(listingId)?.parentDealId ?? listingId;
}
