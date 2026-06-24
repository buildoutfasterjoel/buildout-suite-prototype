import { createFileRoute } from "@tanstack/react-router";
import { getStore } from "#/data/store";
import { DealHistory } from "#/components/deals/DealStubs";

export const Route = createFileRoute("/listings/$listingId/history")({
  component: HistoryRoute,
});

function HistoryRoute() {
  const { listingId } = Route.useParams();
  const listing = getStore().listings.get(listingId);
  if (!listing) return null;
  return <DealHistory listing={listing} />;
}
