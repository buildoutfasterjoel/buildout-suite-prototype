import { createFileRoute } from "@tanstack/react-router";
import { ListingEmail } from "#/components/listings/ListingEmail";
import { useSpaceRoute } from "#/components/deals/useSpaceRoute";

export const Route = createFileRoute(
  "/_shell/listings/$listingId_/spaces/$spaceId/email",
)({ component: SpaceEmailRoute });

function SpaceEmailRoute() {
  const { listingId, spaceId } = Route.useParams();
  const record = useSpaceRoute(listingId, spaceId);
  if (!record) return null;
  return <ListingEmail listing={record.space} />;
}
