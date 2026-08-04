import { createFileRoute } from "@tanstack/react-router";
import { getStore } from "#/data/store";
import { ListingWebsite } from "#/components/listings/ListingWebsite";

export const Route = createFileRoute("/_shell/listings/$listingId/website")({
  // `from` arrives from a space deal's Property Marketing hub, scoping this
  // shell tab back to the space that linked here (see MarketingScopeBar).
  validateSearch: (search: Record<string, unknown>): { from?: string } =>
    typeof search.from === "string" && search.from ? { from: search.from } : {},
  component: WebsiteRoute,
});

function WebsiteRoute() {
  const { listingId } = Route.useParams();
  const listing = getStore().listings.get(listingId);
  if (!listing) return null;
  return <ListingWebsite listing={listing} />;
}
