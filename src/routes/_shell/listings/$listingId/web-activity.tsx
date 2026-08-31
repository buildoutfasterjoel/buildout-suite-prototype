import { createFileRoute } from "@tanstack/react-router";
import { getStore } from "#/data/store";
import { ListingWebsite } from "#/components/listings/ListingWebsite";

/**
 * Web Activity — the classic deal sidebar's name for the Website section's
 * Analytics tab. Its own route rather than a link into `website` with a search
 * param, because the sidebar and the breadcrumb both resolve the current section
 * from the first path segment: two nav items sharing one segment would leave the
 * same row highlighted on both pages.
 *
 * It renders the same section, opened on the other tab. When Web Activity earns
 * a page of its own, this route is where it goes.
 */
export const Route = createFileRoute("/_shell/listings/$listingId/web-activity")({
  component: WebActivityRoute,
});

function WebActivityRoute() {
  const { listingId } = Route.useParams();
  const listing = getStore().listings.get(listingId);
  if (!listing) return null;
  return <ListingWebsite listing={listing} defaultTab="analytics" />;
}
