import { createFileRoute } from "@tanstack/react-router";
import { getStore } from "#/data/store";
import { DealUnderwritingTab } from "#/components/deals/underwriting/DealUnderwritingTab";

export const Route = createFileRoute("/_shell/listings/$listingId/underwriting")({
  component: UnderwritingRoute,
});

function UnderwritingRoute() {
  const { listingId } = Route.useParams();
  const listing = getStore().listings.get(listingId);
  if (!listing) return null;
  return <DealUnderwritingTab listing={listing} />;
}
