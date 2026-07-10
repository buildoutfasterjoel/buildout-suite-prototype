import { createFileRoute } from "@tanstack/react-router";
import { getStore } from "#/data/store";
import { ListingMedia } from "#/components/listings/ListingMedia";

export const Route = createFileRoute("/listings/$listingId/media")({
  component: MediaRoute,
});

function MediaRoute() {
  const { listingId } = Route.useParams();
  const listing = getStore().listings.get(listingId);

  if (!listing) return null;

  return <ListingMedia listing={listing} />;
}
