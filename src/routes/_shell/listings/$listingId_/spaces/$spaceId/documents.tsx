import { createFileRoute } from "@tanstack/react-router";
import { PropertyDetailDocuments } from "#/components/properties/PropertyDetailDocuments";
import { useSpaceRoute } from "#/components/deals/useSpaceRoute";

export const Route = createFileRoute(
  "/_shell/listings/$listingId_/spaces/$spaceId/documents",
)({ component: SpaceDocumentsRoute });

function SpaceDocumentsRoute() {
  const { listingId, spaceId } = Route.useParams();
  const record = useSpaceRoute(listingId, spaceId);
  if (!record) return null;
  return <PropertyDetailDocuments listingId={spaceId} />;
}
