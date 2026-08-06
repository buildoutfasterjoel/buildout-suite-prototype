import { createFileRoute } from "@tanstack/react-router";
import { GridsPage } from "#/components/grids/GridsPage";
import { useSpaceRoute } from "#/components/deals/useSpaceRoute";

export const Route = createFileRoute(
  "/_shell/listings/$listingId_/spaces/$spaceId/grids",
)({ component: SpaceGridsRoute });

function SpaceGridsRoute() {
  const { listingId, spaceId } = Route.useParams();
  const record = useSpaceRoute(listingId, spaceId);
  if (!record) return null;
  return <GridsPage listing={record.space} />;
}
