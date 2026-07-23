import { createFileRoute } from "@tanstack/react-router";
import { useDataStore } from "#/data/dataStore";
import { DealFinancials } from "#/components/deals/DealFinancials";

export const Route = createFileRoute("/_shell/listings/$listingId/financials")({
  component: FinancialsRoute,
});

function FinancialsRoute() {
  const { listingId } = Route.useParams();
  // Reactive selector so an Edit Transaction save re-renders the summary immediately.
  const listing = useDataStore((s) => s.listings.get(listingId));
  if (!listing) return null;
  return <DealFinancials listing={listing} />;
}
