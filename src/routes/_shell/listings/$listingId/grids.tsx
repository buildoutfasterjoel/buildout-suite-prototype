import { createFileRoute } from "@tanstack/react-router";
import { getStore } from "#/data/store";
import { GridsPage } from "#/components/grids/GridsPage";

export const Route = createFileRoute("/_shell/listings/$listingId/grids")({
  // `from` arrives from a space deal's Property Marketing hub, scoping this
  // shell tab back to the space that linked here (see MarketingScopeBar).
  validateSearch: (search: Record<string, unknown>): { from?: string } =>
    typeof search.from === "string" && search.from ? { from: search.from } : {},
  component: GridsRoute,
});

function GridsRoute() {
  const { listingId } = Route.useParams();
  const listing = getStore().listings.get(listingId);
  if (!listing) return null;
  return <GridsPage listing={listing} />;
}
