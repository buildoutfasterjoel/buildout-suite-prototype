import { createFileRoute } from "@tanstack/react-router";
import { DealUnderwritingTab } from "#/components/deals/underwriting/DealUnderwritingTab";
import { useSpaceRoute } from "#/components/deals/useSpaceRoute";

export const Route = createFileRoute(
  "/_shell/listings/$listingId_/spaces/$spaceId/underwriting",
)({ component: SpaceUnderwritingRoute });

function SpaceUnderwritingRoute() {
  const { listingId, spaceId } = Route.useParams();
  const record = useSpaceRoute(listingId, spaceId);
  if (!record) return null;
  return <DealUnderwritingTab listing={record.space} />;
}
