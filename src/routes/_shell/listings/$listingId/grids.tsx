import { createFileRoute } from "@tanstack/react-router";
import { getStore } from "#/data/store";
import { GridsPage } from "#/components/grids/GridsPage";

export const Route = createFileRoute("/_shell/listings/$listingId/grids")({
  component: GridsRoute,
});

function GridsRoute() {
  const { listingId } = Route.useParams();
  const listing = getStore().listings.get(listingId);
  if (!listing) return null;
  return <GridsPage listing={listing} />;
}
