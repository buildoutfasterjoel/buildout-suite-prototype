import { createFileRoute } from "@tanstack/react-router";
import { getStore } from "#/data/store";
import { PropertyDetailDocuments } from "#/components/properties/PropertyDetailDocuments";

export const Route = createFileRoute("/_shell/listings/$listingId/documents")({
  // `from` arrives from a space deal's Property Marketing hub, scoping this
  // shell tab back to the space that linked here (see MarketingScopeBar).
  validateSearch: (search: Record<string, unknown>): { from?: string } =>
    typeof search.from === "string" && search.from ? { from: search.from } : {},
  component: DocumentsRoute,
});

function DocumentsRoute() {
  const { listingId } = Route.useParams();
  const listing = getStore().listings.get(listingId);

  if (!listing) return null;

  return <PropertyDetailDocuments listingId={listingId} />;
}
