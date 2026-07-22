import { createFileRoute } from "@tanstack/react-router";
import { faListCheck } from "@fortawesome/pro-regular-svg-icons";
import { getStore } from "#/data/store";
import { DealPagePlaceholder } from "#/components/deals/DealPagePlaceholder";

export const Route = createFileRoute("/_shell/listings/$listingId/planner")({
  component: PlannerRoute,
});

function PlannerRoute() {
  const { listingId } = Route.useParams();
  if (!getStore().listings.get(listingId)) return null;
  return <DealPagePlaceholder title="Planner" icon={faListCheck} />;
}
