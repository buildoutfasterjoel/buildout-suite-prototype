import { createFileRoute } from "@tanstack/react-router";
import { getStore } from "#/data/store";
import { ListingWebsite } from "#/components/listings/ListingWebsite";

export const Route = createFileRoute("/_shell/listings/$listingId/website")({
  component: WebsiteRoute,
});

function WebsiteRoute() {
  const { listingId } = Route.useParams();
  const listing = getStore().listings.get(listingId);
  if (!listing) return null;
  // A classic deal splits this page in two: Web Activity takes the analytics
  // tab, so Website opens on settings. Every other deal lands on analytics.
  return (
    <ListingWebsite
      listing={listing}
      defaultTab={listing.isClassic ? "settings" : "analytics"}
    />
  );
}
