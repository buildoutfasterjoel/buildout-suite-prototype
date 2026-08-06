import { createFileRoute } from "@tanstack/react-router";
import { ListingDemographics } from "#/components/listings/ListingDemographics";
import { useSpaceRoute } from "#/components/deals/useSpaceRoute";

export const Route = createFileRoute(
  "/_shell/listings/$listingId_/spaces/$spaceId/demographics",
)({ component: SpaceDemographicsRoute });

function SpaceDemographicsRoute() {
  const { listingId, spaceId } = Route.useParams();
  const record = useSpaceRoute(listingId, spaceId);
  if (!record) return null;
  return <ListingDemographics listing={record.space} />;
}
