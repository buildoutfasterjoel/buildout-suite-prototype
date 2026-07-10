import { createFileRoute } from "@tanstack/react-router";
import { getStore } from "#/data/store";
import { ListingClientReport } from "#/components/listings/ListingClientReport";

export const Route = createFileRoute("/listings/$listingId/client-report")({
  component: ClientReportRoute,
});

function ClientReportRoute() {
  const { listingId } = Route.useParams();
  const store = getStore();
  const listing = store.listings.get(listingId);
  const property = listing && store.properties.get(listing.propertyId);

  if (!listing || !property) return null;

  return <ListingClientReport listing={listing} property={property} />;
}
