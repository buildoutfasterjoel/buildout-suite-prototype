import { createFileRoute } from "@tanstack/react-router";
import { getStore } from "#/data/store";
import { PropertyDetailDocuments } from "#/components/properties/PropertyDetailDocuments";

export const Route = createFileRoute("/listings/$listingId/documents")({
  component: DocumentsRoute,
});

function DocumentsRoute() {
  const { listingId } = Route.useParams();
  const property = getStore().properties.get(listingId);

  if (!property) return null;

  return <PropertyDetailDocuments property={property} />;
}
