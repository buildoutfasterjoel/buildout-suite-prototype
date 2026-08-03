import { createFileRoute } from "@tanstack/react-router";
import { getStore } from "#/data/store";
import { ListingMedia } from "#/components/listings/ListingMedia";

export const Route = createFileRoute(
  "/_shell/listings/$listingId/spaces/$spaceId/media",
)({
  component: SpaceMediaRoute,
});

function SpaceMediaRoute() {
  const { spaceId } = Route.useParams();
  const listing = getStore().listings.get(spaceId);
  if (!listing) return null;
  // ListingMedia already filters to the listing's unit for a space deal (07e0214).
  return <ListingMedia listing={listing} />;
}
