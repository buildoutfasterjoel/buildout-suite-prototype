import { createFileRoute } from "@tanstack/react-router";
import { ListingWebsite } from "#/components/listings/ListingWebsite";
import { useSpaceRoute } from "#/components/deals/useSpaceRoute";

export const Route = createFileRoute(
  "/_shell/listings/$listingId_/spaces/$spaceId/website",
)({ component: SpaceWebsiteRoute });

function SpaceWebsiteRoute() {
  const { listingId, spaceId } = Route.useParams();
  const record = useSpaceRoute(listingId, spaceId);
  if (!record) return null;
  return <ListingWebsite listing={record.space} />;
}
