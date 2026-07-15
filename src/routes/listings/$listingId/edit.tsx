import { createFileRoute } from "@tanstack/react-router";
import { getStore } from "#/data/store";
import { DealMarketingEditor } from "#/components/deals/DealMarketingEditor";

export const Route = createFileRoute("/listings/$listingId/edit")({
  component: EditRoute,
});

function EditRoute() {
  const { listingId } = Route.useParams();
  const store = getStore();
  const listing = store.listings.get(listingId);
  const property = listing && store.properties.get(listing.propertyId);

  if (!listing || !property) return null;

  return <DealMarketingEditor listing={listing} property={property} />;
}
