import { createFileRoute } from "@tanstack/react-router";
import { useDataStore } from "#/data/dataStore";
import { DealTransaction } from "#/components/deals/DealOverview";

export const Route = createFileRoute("/_shell/listings/$listingId/transaction")({
  component: TransactionRoute,
});

function TransactionRoute() {
  const { listingId } = Route.useParams();
  // Reactive selector (not getStore()) so an Edit Transaction save —
  // updateDealTransaction replaces the listings map and listing object —
  // re-renders the transaction card immediately with the saved values.
  const listing = useDataStore((s) => s.listings.get(listingId));
  if (!listing) return null;
  return <DealTransaction listing={listing} />;
}
