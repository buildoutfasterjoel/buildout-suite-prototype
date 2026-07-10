import { createFileRoute } from "@tanstack/react-router";
import { getStore } from "#/data/store";
import { ListingDemographics } from "#/components/listings/ListingDemographics";

export const Route = createFileRoute("/listings/$listingId/demographics")({
  component: DemographicsRoute,
});

function DemographicsRoute() {
  const { listingId } = Route.useParams();
  const listing = getStore().listings.get(listingId);

  if (!listing) return null;

  return <ListingDemographics listing={listing} />;
}
