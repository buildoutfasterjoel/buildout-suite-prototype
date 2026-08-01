import { createFileRoute } from "@tanstack/react-router";
import { getStore } from "#/data/store";
import { dealShape } from "#/data/dealShape";
import { PropertyDetailLeads } from "#/components/properties/PropertyDetailLeads";

export const Route = createFileRoute("/_shell/listings/$listingId/leads")({
  // `q` pre-fills the leads search — an inquiry card on the contact page links
  // here scoped to that contact, so the broker lands on the row they act on.
  // `from` isn't consumed by this tab, but Leads sits in the Marketing group
  // alongside the shared surfaces, so the sidebar can carry it in when hopping
  // here — declared so it survives instead of being silently dropped.
  validateSearch: (
    search: Record<string, unknown>,
  ): { q?: string; from?: string } => ({
    ...(typeof search.q === "string" && search.q ? { q: search.q } : {}),
    ...(typeof search.from === "string" && search.from
      ? { from: search.from }
      : {}),
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

  const unitId = dealShape(listing) === "space" ? listing.unitId : undefined;

  return (
    <PropertyDetailLeads property={property} initialSearch={q} unitId={unitId} />
  );
}
