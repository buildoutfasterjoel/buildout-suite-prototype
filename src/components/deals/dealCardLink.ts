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
 * like Documents and Website belong to the building, so a space resolves to its
 * parent and everything else to itself. Takes an id rather than a Listing
 * because most callers only hold the id.
 *
 * Not for Leads — see `spaceLeadsTarget`. A space's Leads page is a filtered view
 * of the building's, so it stays on the space.
 */
export function buildingSectionListingId(listingId: string): string {
  return getListing(listingId)?.parentDealId ?? listingId;
}

/**
 * The params for this listing's own Leads page, when it is a space — otherwise
 * null, meaning read Leads on the listing itself.
 *
 * Leads is deliberately NOT a building-owned section, so this is not
 * `buildingSectionListingId`. A space's Leads page shows the building's list
 * filtered to inquiries on that suite (`leadsForSpaceDeal`, which does not fall
 * back to building-wide inquiries), which is precisely where an inquiry on the
 * suite appears. Sending it to the building's unfiltered list instead loses that
 * scoping.
 *
 * Returns params rather than a `{ to, params }` pair on purpose: `navigate` is
 * generic over `to`, and a union of link objects spread into it does not narrow
 * `params` against the chosen route. Call sites keep a literal `to`.
 */
export function spaceLeadsTarget(
  listingId: string,
): { listingId: string; spaceId: string } | null {
  const parentDealId = getListing(listingId)?.parentDealId;
  return parentDealId ? { listingId: parentDealId, spaceId: listingId } : null;
}

/**
 * Where this deal's Edit Deal form lives. A space's edit page is nested under
 * its building like every other space section, so a space resolves to
 * `/listings/{shellId}/spaces/{spaceId}/edit` and everything else to its own
 * `/listings/{id}/edit`.
 *
 * Returns a `{ to, params }` pair rather than bare params because both branches
 * are complete link targets — spread it straight into a `<Link>` the way
 * `dealCardLinkProps` is. Callers that `navigate()` instead must keep a literal
 * `to`, since `navigate` is generic over `to` and a union does not narrow
 * `params` against it.
 */
export function dealEditTarget(listing: Listing):
  | { to: "/listings/$listingId/edit"; params: { listingId: string } }
  | {
      to: "/listings/$listingId/spaces/$spaceId/edit";
      params: { listingId: string; spaceId: string };
    } {
  if (listing.parentDealId) {
    return {
      to: "/listings/$listingId/spaces/$spaceId/edit",
      params: { listingId: listing.parentDealId, spaceId: listing.id },
    };
  }
  return { to: "/listings/$listingId/edit", params: { listingId: listing.id } };
}
