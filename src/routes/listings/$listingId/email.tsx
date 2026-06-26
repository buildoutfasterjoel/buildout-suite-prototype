import { createFileRoute } from "@tanstack/react-router";
import { getStore } from "#/data/store";
import { ListingEmail } from "#/components/listings/ListingEmail";

export const Route = createFileRoute("/listings/$listingId/email")({
  component: EmailRoute,
});

function EmailRoute() {
  const { listingId } = Route.useParams();
  const listing = getStore().listings.get(listingId);
  if (!listing) return null;
  return <ListingEmail listing={listing} />;
}
