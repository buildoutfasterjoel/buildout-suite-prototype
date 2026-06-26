import { createFileRoute } from "@tanstack/react-router";
import { getStore } from "#/data/store";
import { DealPlanner } from "#/components/deals/DealPlanner";

export const Route = createFileRoute("/listings/$listingId/tasks")({
  component: TasksRoute,
});

function TasksRoute() {
  const { listingId } = Route.useParams();
  const listing = getStore().listings.get(listingId);
  if (!listing) return null;
  return <DealPlanner listing={listing} />;
}
