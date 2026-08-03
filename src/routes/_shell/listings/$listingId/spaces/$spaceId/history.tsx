import { createFileRoute } from "@tanstack/react-router";
import { faClockRotateLeft } from "@fortawesome/pro-regular-svg-icons";
import { getStore } from "#/data/store";
import { DealPagePlaceholder } from "#/components/deals/DealPagePlaceholder";

export const Route = createFileRoute(
  "/_shell/listings/$listingId/spaces/$spaceId/history",
)({
  component: SpaceHistoryRoute,
});

function SpaceHistoryRoute() {
  const { spaceId } = Route.useParams();
  const listing = getStore().listings.get(spaceId);
  if (!listing) return null;
  return <DealPagePlaceholder title="History" icon={faClockRotateLeft} />;
}
