import { createFileRoute } from "@tanstack/react-router";
import { useDataStore } from "#/data/dataStore";
import { DealInvoices } from "#/components/deals/DealInvoices";

export const Route = createFileRoute(
  "/_shell/listings/$listingId/spaces/$spaceId/financial-documents",
)({
  component: SpaceInvoicesRoute,
});

function SpaceInvoicesRoute() {
  const { spaceId } = Route.useParams();
  const listing = useDataStore((s) => s.listings.get(spaceId));
  if (!listing) return null;
  return <DealInvoices listing={listing} />;
}
