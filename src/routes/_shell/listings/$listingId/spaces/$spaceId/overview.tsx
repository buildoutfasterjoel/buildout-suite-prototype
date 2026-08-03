import { createFileRoute } from "@tanstack/react-router";
import { useDataStore } from "#/data/dataStore";
import { SpacePanelDetails } from "#/components/deals/SpacePanelDetails";

export const Route = createFileRoute(
  "/_shell/listings/$listingId/spaces/$spaceId/overview",
)({
  component: SpaceOverviewRoute,
});

function SpaceOverviewRoute() {
  const { spaceId } = Route.useParams();
  const listing = useDataStore((s) => s.listings).get(spaceId);
  if (!listing) return null;
  return <SpacePanelDetails listing={listing} />;
}
