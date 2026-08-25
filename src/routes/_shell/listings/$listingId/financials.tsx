import { createFileRoute } from "@tanstack/react-router";
import { useDataStore } from "#/data/dataStore";
import { DealFinancials } from "#/components/deals/DealFinancials";

export const Route = createFileRoute("/_shell/listings/$listingId/financials")({
  component: FinancialsRoute,
});

function FinancialsRoute() {
  const { listingId } = Route.useParams();
  // Reactive selector so a save on the Edit Deal form re-renders the summary
  // as soon as this page comes back into view.
  const listing = useDataStore((s) => s.listings.get(listingId));
  if (!listing) return null;

  return <DealFinancials listing={listing} />;
}
