import { createFileRoute } from "@tanstack/react-router";
import { faTowerBroadcast } from "@fortawesome/pro-regular-svg-icons";
import { getStore } from "#/data/store";
import { DealPagePlaceholder } from "#/components/deals/DealPagePlaceholder";

export const Route = createFileRoute("/_shell/listings/$listingId/syndication")({
  component: SyndicationRoute,
});

function SyndicationRoute() {
  const { listingId } = Route.useParams();
  if (!getStore().listings.get(listingId)) return null;
  return <DealPagePlaceholder title="Syndication" icon={faTowerBroadcast} />;
}
