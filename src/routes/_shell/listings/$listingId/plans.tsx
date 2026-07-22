import { createFileRoute } from "@tanstack/react-router";
import { faRulerCombined } from "@fortawesome/pro-regular-svg-icons";
import { getStore } from "#/data/store";
import { DealPagePlaceholder } from "#/components/deals/DealPagePlaceholder";

export const Route = createFileRoute("/_shell/listings/$listingId/plans")({
  component: PlansRoute,
});

function PlansRoute() {
  const { listingId } = Route.useParams();
  if (!getStore().listings.get(listingId)) return null;
  return <DealPagePlaceholder title="Plans" icon={faRulerCombined} />;
}
