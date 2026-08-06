import { createFileRoute } from "@tanstack/react-router";
import { ListingMedia } from "#/components/listings/ListingMedia";
import { useSpaceRoute } from "#/components/deals/useSpaceRoute";

export const Route = createFileRoute(
  "/_shell/listings/$listingId_/spaces/$spaceId/media",
)({ component: SpaceMediaRoute });

function SpaceMediaRoute() {
  const { listingId, spaceId } = Route.useParams();
  const record = useSpaceRoute(listingId, spaceId);
  if (!record) return null;
  return <ListingMedia listing={record.space} />;
}
