import { createFileRoute } from "@tanstack/react-router";
import { useDataStore } from "#/data/dataStore";
import { DealFinancials } from "#/components/deals/DealFinancials";

export const Route = createFileRoute(
  "/_shell/listings/$listingId/spaces/$spaceId/financials",
)({
  component: SpaceVoucherRoute,
});

function SpaceVoucherRoute() {
  const { spaceId } = Route.useParams();
  // Reactive so an Edit Transaction save re-renders the summary immediately.
  const listing = useDataStore((s) => s.listings.get(spaceId));
  if (!listing) return null;
  // No shell guard needed — a space deal is never a shell.
  return <DealFinancials listing={listing} />;
}
