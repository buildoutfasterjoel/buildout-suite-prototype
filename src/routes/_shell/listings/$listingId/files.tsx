import { createFileRoute } from "@tanstack/react-router";
import { getStore } from "#/data/store";
import { PropertyDetailFiles } from "#/components/properties/PropertyDetailFiles";

export const Route = createFileRoute("/_shell/listings/$listingId/files")({
  component: FilesRoute,
});

function FilesRoute() {
  const { listingId } = Route.useParams();
  const listing = getStore().listings.get(listingId);

  if (!listing) return null;

  return <PropertyDetailFiles listingId={listingId} />;
}
