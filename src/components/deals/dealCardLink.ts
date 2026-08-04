import type { Listing } from "#/data/types";
import { getListing } from "#/data/store";

/**
 * Where a card for this deal should go. A space deal has no page of its own, so
 * it opens its building's roster with its own row expanded — the roster is where
 * its terms, stage and gate live. Every card surface shares this one rule so a
 * space can never acquire a page by way of an un-updated link.
 */
export function dealCardLinkProps(listing: Listing):
  | { to: "/listings/$listingId"; params: { listingId: string } }
  | {
      to: "/listings/$listingId/spaces";
      params: { listingId: string };
      search: { space: string };
    } {
  if (listing.parentDealId) {
    return {
      to: "/listings/$listingId/spaces",
      params: { listingId: listing.parentDealId },
      search: { space: listing.id },
    };
  }
  return { to: "/listings/$listingId", params: { listingId: listing.id } };
}

/**
 * The listing whose page owns a building-level section for this deal. Sections
 * like Documents and Leads belong to the building, and a space has no page of
 * its own — so a space resolves to its parent, and everything else to itself.
 * Takes an id rather than a Listing because most callers only hold the id.
 */
export function buildingSectionListingId(listingId: string): string {
  return getListing(listingId)?.parentDealId ?? listingId;
}
