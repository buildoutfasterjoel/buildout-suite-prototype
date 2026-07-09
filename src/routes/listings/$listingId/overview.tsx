import { createFileRoute } from "@tanstack/react-router";
import { getStore } from "#/data/store";
import { TodayPlanner } from "#/components/deals/TodayPlanner";

export const Route = createFileRoute("/listings/$listingId/overview")({
  component: OverviewRoute,
});

function OverviewRoute() {
  const { listingId } = Route.useParams();
  const store = getStore();
  const listing = store.listings.get(listingId);
  if (!listing) return null;
  return <TodayPlanner listing={listing} />;
}
