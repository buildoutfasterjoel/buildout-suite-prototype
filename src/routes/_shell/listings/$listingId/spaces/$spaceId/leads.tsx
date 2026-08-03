import { createFileRoute } from "@tanstack/react-router";
import { getStore } from "#/data/store";
import { PropertyDetailLeads } from "#/components/properties/PropertyDetailLeads";

export const Route = createFileRoute(
  "/_shell/listings/$listingId/spaces/$spaceId/leads",
)({
  // `q` pre-fills the leads search — an inquiry card on the contact page links
  // here scoped to that contact, so the broker lands on the row they act on.
  // Mirrors the building route's schema (src/routes/_shell/listings/$listingId/leads.tsx).
  validateSearch: (search: Record<string, unknown>): { q?: string } => ({
    ...(typeof search.q === "string" && search.q ? { q: search.q } : {}),
  }),
  component: SpaceLeadsRoute,
});

function SpaceLeadsRoute() {
  const { spaceId } = Route.useParams();
  const { q } = Route.useSearch();
  const store = getStore();
  const listing = store.listings.get(spaceId);
  const property = listing && store.properties.get(listing.propertyId);
  if (!listing || !property) return null;
  // Shared store, scoped view: one lead library on the property, filtered here.
  return (
    <PropertyDetailLeads
      property={property}
      initialSearch={q}
      spaceDealId={listing.id}
    />
  );
}
