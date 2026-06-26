import { createFileRoute } from "@tanstack/react-router";
import { getStore } from "#/data/store";
import { ListingOverviewDashboard } from "#/components/listings/ListingOverviewDashboard";

export const Route = createFileRoute("/listings/$listingId/overview")({
  component: OverviewRoute,
});

function OverviewRoute() {
  const { listingId } = Route.useParams();
  const store = getStore();
  const listing = store.listings.get(listingId);
  if (!listing) return null;
  return <ListingOverviewDashboard listing={listing} />;
}
