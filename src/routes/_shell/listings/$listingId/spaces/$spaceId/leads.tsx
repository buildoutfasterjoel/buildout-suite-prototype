import { createFileRoute } from "@tanstack/react-router";
import { getStore } from "#/data/store";
import { PropertyDetailLeads } from "#/components/properties/PropertyDetailLeads";

export const Route = createFileRoute(
  "/_shell/listings/$listingId/spaces/$spaceId/leads",
)({
  component: SpaceLeadsRoute,
});

function SpaceLeadsRoute() {
  const { spaceId } = Route.useParams();
  const store = getStore();
  const listing = store.listings.get(spaceId);
  const property = listing && store.properties.get(listing.propertyId);
  if (!listing || !property) return null;
  // Shared store, scoped view: one lead library on the property, filtered here.
  return <PropertyDetailLeads property={property} spaceDealId={listing.id} />;
}
