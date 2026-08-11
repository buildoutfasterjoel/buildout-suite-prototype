import { createFileRoute } from "@tanstack/react-router";
import { useDataStore } from "#/data/dataStore";
import { getProperty } from "#/data/store";
import { ListingMedia } from "#/components/listings/ListingMedia";

export const Route = createFileRoute("/_shell/listings/$listingId/media")({
  component: MediaRoute,
});

function MediaRoute() {
  const { listingId } = Route.useParams();
  // `useDataStore`, not `getStore()`: this page writes, so it has to re-render on
  // its own edits. A snapshot read leaves an upload looking like a no-op.
  const listing = useDataStore((s) => s.listings.get(listingId));
  if (!listing) return null;
  const property = getProperty(listing.propertyId);
  if (!property) return null;

  return <ListingMedia listing={listing} property={property} />;
}
