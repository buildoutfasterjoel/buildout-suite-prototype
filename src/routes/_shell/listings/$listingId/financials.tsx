import { createFileRoute } from "@tanstack/react-router";
import { getStore } from "#/data/store";
import { DealFinancials } from "#/components/deals/DealFinancials";

export const Route = createFileRoute("/_shell/listings/$listingId/financials")({
  component: FinancialsRoute,
});

function FinancialsRoute() {
  const { listingId } = Route.useParams();
  const listing = getStore().listings.get(listingId);
  if (!listing) return null;
  return <DealFinancials listing={listing} />;
}
