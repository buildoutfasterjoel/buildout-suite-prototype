import { createFileRoute } from "@tanstack/react-router";
import { PropertyDetailFiles } from "#/components/properties/PropertyDetailFiles";
import { useSpaceRoute } from "#/components/deals/useSpaceRoute";

export const Route = createFileRoute(
  "/_shell/listings/$listingId_/spaces/$spaceId/files",
)({ component: SpaceFilesRoute });

function SpaceFilesRoute() {
  const { listingId, spaceId } = Route.useParams();
  const record = useSpaceRoute(listingId, spaceId);
  if (!record) return null;
  return <PropertyDetailFiles listingId={spaceId} />;
}
