import { createFileRoute } from "@tanstack/react-router";
import { ListingClientReport } from "#/components/listings/ListingClientReport";
import { useSpaceRoute } from "#/components/deals/useSpaceRoute";

export const Route = createFileRoute(
  "/_shell/listings/$listingId_/spaces/$spaceId/client-report",
)({ component: SpaceClientReportRoute });

function SpaceClientReportRoute() {
  const { listingId, spaceId } = Route.useParams();
  const record = useSpaceRoute(listingId, spaceId);
  if (!record) return null;
  return (
    <ListingClientReport listing={record.space} property={record.property} />
  );
}
