import { createFileRoute } from "@tanstack/react-router";
import { getStore } from "#/data/store";
import { DealInvoices } from "#/components/deals/DealInvoices";

export const Route = createFileRoute(
  "/_shell/listings/$listingId/financial-documents",
)({
  component: InvoicesRoute,
});

function InvoicesRoute() {
  const { listingId } = Route.useParams();
  const listing = getStore().listings.get(listingId);
  if (!listing) return null;

  return <DealInvoices listing={listing} />;
}
