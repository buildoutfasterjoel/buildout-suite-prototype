import { createFileRoute } from "@tanstack/react-router";
import { getStore } from "#/data/store";
import { PropertyDetailDocuments } from "#/components/properties/PropertyDetailDocuments";

export const Route = createFileRoute("/listings/$listingId/documents")({
  component: DocumentsRoute,
});

function DocumentsRoute() {
  const { listingId } = Route.useParams();
  const listing = getStore().listings.get(listingId);

  if (!listing) return null;

  return <PropertyDetailDocuments listingId={listingId} />;
}
