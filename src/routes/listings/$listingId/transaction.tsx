import { createFileRoute } from "@tanstack/react-router";
import { getStore } from "#/data/store";
import { DealTransaction } from "#/components/deals/DealOverview";

export const Route = createFileRoute("/listings/$listingId/transaction")({
  component: TransactionRoute,
});

function TransactionRoute() {
  const { listingId } = Route.useParams();
  const listing = getStore().listings.get(listingId);
  if (!listing) return null;
  return <DealTransaction listing={listing} />;
}
