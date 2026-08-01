import { createFileRoute } from "@tanstack/react-router";
import { getStore } from "#/data/store";
import { ListingDemographics } from "#/components/listings/ListingDemographics";

export const Route = createFileRoute("/_shell/listings/$listingId/demographics")({
  // `from` arrives from a space deal's Property Marketing hub, scoping this
  // shell tab back to the space that linked here (see MarketingScopeBar).
  validateSearch: (search: Record<string, unknown>): { from?: string } =>
    typeof search.from === "string" && search.from ? { from: search.from } : {},
  component: DemographicsRoute,
});

function DemographicsRoute() {
  const { listingId } = Route.useParams();
  const listing = getStore().listings.get(listingId);

  if (!listing) return null;

  return <ListingDemographics listing={listing} />;
}
