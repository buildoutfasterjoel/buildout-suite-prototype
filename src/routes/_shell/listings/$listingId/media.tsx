import { createFileRoute } from "@tanstack/react-router";
import { getStore } from "#/data/store";
import { ListingMedia } from "#/components/listings/ListingMedia";

export const Route = createFileRoute("/_shell/listings/$listingId/media")({
  // `from` arrives from a space deal's Property Marketing hub, scoping this
  // shell tab back to the space that linked here (see MarketingScopeBar).
  // Without the schema, a hop from any sibling Marketing tab drops the param
  // and the return bar disappears mid-visit.
  validateSearch: (search: Record<string, unknown>): { from?: string } =>
    typeof search.from === "string" && search.from ? { from: search.from } : {},
  component: MediaRoute,
});

function MediaRoute() {
  const { listingId } = Route.useParams();
  const listing = getStore().listings.get(listingId);

  if (!listing) return null;

  return <ListingMedia listing={listing} />;
}
