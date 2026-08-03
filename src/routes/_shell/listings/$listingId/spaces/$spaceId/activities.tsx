import { createFileRoute } from "@tanstack/react-router";
import { getStore } from "#/data/store";
import { DealActivity } from "#/components/deals/DealStubs";

export const Route = createFileRoute(
  "/_shell/listings/$listingId/spaces/$spaceId/activities",
)({
  component: SpaceActivitiesRoute,
});

function SpaceActivitiesRoute() {
  const { spaceId } = Route.useParams();
  const listing = getStore().listings.get(spaceId);
  if (!listing) return null;
  // No DealMessagesRail here: the building's Activity tab renders it beside the feed
  // at 420px, which the panel has no room for.
  return <DealActivity listing={listing} />;
}
