import { createFileRoute } from "@tanstack/react-router";
import { getStore } from "#/data/store";
import { ListingEmail } from "#/components/listings/ListingEmail";

export const Route = createFileRoute("/_shell/listings/$listingId/email")({
  // `from` arrives from a space deal's Property Marketing hub, scoping this
  // shell tab back to the space that linked here (see MarketingScopeBar).
  validateSearch: (search: Record<string, unknown>): { from?: string } =>
    typeof search.from === "string" && search.from ? { from: search.from } : {},
  component: EmailRoute,
});

function EmailRoute() {
  const { listingId } = Route.useParams();
  const listing = getStore().listings.get(listingId);
  if (!listing) return null;
  return <ListingEmail listing={listing} />;
}
