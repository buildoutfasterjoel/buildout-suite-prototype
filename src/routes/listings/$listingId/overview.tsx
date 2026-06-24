import { createFileRoute } from "@tanstack/react-router";
import { getStore } from "#/data/store";
import { ListingOverview } from "#/components/deals/DealOverview";

export const Route = createFileRoute("/listings/$listingId/overview")({
  component: OverviewRoute,
});

function OverviewRoute() {
  const { listingId } = Route.useParams();
  const store = getStore();
  const listing = store.listings.get(listingId);
  const property = listing && store.properties.get(listing.propertyId);
  if (!listing || !property) return null;
  return <ListingOverview listing={listing} property={property} />;
}
