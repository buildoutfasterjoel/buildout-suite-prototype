import { createFileRoute } from "@tanstack/react-router";
import { getStore } from "#/data/store";
import { dealShape } from "#/data/dealShape";
import { PropertyDetailLeads } from "#/components/properties/PropertyDetailLeads";

export const Route = createFileRoute("/_shell/listings/$listingId/leads")({
  // `q` pre-fills the leads search — an inquiry card on the contact page links
  // here scoped to that contact, so the broker lands on the row they act on.
  validateSearch: (search: Record<string, unknown>): { q?: string } => ({
    ...(typeof search.q === "string" && search.q ? { q: search.q } : {}),
  }),
  component: LeadsRoute,
});

function LeadsRoute() {
  const { listingId } = Route.useParams();
  const { q } = Route.useSearch();
  const store = getStore();
  const listing = store.listings.get(listingId);
  const property = listing && store.properties.get(listing.propertyId);

  if (!listing || !property) return null;

  // The space deal's own id — leads are scoped by which listing a contact's
  // `inquiredListingIds` names, and this space deal IS one such listing.
  const spaceDealId = dealShape(listing) === "space" ? listing.id : undefined;

  return (
    <PropertyDetailLeads
      property={property}
      dealId={listing.id}
      initialSearch={q}
      spaceDealId={spaceDealId}
    />
  );
}
