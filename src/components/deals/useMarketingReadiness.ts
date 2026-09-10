import { useDataStore } from "#/data/dataStore";
import { dealShape } from "#/data/dealShape";
import {
  marketingReadiness,
  type MarketingField,
} from "#/data/marketingReadiness";
import type { Listing } from "#/data/types";

/**
 * Whether this deal has the content its marketing output needs, plus the two
 * exemptions that belong with the question rather than beside each caller.
 *
 * Three surfaces ask — the route guard, the sidebar, and the Listing form's
 * banner — and an exemption that lived in only two of them would show a banner
 * over an unlocked sidebar, or lock a section the banner says is fine.
 *
 * The exemptions:
 *
 * - **A deal reading its documents.** Files attached at creation kick off an
 *   ingestion run that writes these very fields in. Walling the broker off from
 *   fields that are seconds from filling themselves is noise, and it is the same
 *   call `SetupIncompleteBanner` makes for the same reason.
 * - **A classic deal.** `CLASSIC_NAV_GROUPS` has no Listing item, so there is
 *   nowhere to send them: the redirect would land on a section their own sidebar
 *   does not offer.
 *
 * Subscribes to the store rather than reading it once, so saving the Listing
 * form unlocks the sidebar without a reload.
 */
export function useMarketingReadiness(listing: Listing): {
  ready: boolean;
  missing: MarketingField[];
} {
  const property = useDataStore((s) => s.properties.get(listing.propertyId));

  const exempt =
    listing.isClassic || listing.ingestion?.status === "processing";
  if (exempt || !property) return { ready: true, missing: [] };

  return marketingReadiness(listing, property, dealShape(listing));
}
