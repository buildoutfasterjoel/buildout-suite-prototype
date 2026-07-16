import { createFileRoute } from "@tanstack/react-router";
import { getStore } from "#/data/store";
import { DealActivity } from "#/components/deals/DealStubs";

export const Route = createFileRoute("/_shell/listings/$listingId/activities")({
  component: ActivitiesRoute,
});

function ActivitiesRoute() {
  const { listingId } = Route.useParams();
  const listing = getStore().listings.get(listingId);
  if (!listing) return null;
  return <DealActivity listing={listing} />;
}
