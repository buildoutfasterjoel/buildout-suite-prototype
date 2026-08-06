import { createFileRoute } from "@tanstack/react-router";
import { faClockRotateLeft } from "@fortawesome/pro-regular-svg-icons";
import { DealPagePlaceholder } from "#/components/deals/DealPagePlaceholder";
import { useSpaceRoute } from "#/components/deals/useSpaceRoute";

export const Route = createFileRoute(
  "/_shell/listings/$listingId_/spaces/$spaceId/history",
)({ component: SpaceHistoryRoute });

function SpaceHistoryRoute() {
  const { listingId, spaceId } = Route.useParams();
  const record = useSpaceRoute(listingId, spaceId);
  if (!record) return null;
  return <DealPagePlaceholder title="History" icon={faClockRotateLeft} />;
}
