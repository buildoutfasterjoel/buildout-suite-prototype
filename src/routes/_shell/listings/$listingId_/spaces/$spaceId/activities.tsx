import { createFileRoute } from "@tanstack/react-router";
import { DealActivity } from "#/components/deals/DealStubs";
import { DealMessagesRail } from "#/components/deals/DealMessagesRail";
import { useSpaceRoute } from "#/components/deals/useSpaceRoute";

export const Route = createFileRoute(
  "/_shell/listings/$listingId_/spaces/$spaceId/activities",
)({ component: SpaceActivitiesRoute });

function SpaceActivitiesRoute() {
  const { listingId, spaceId } = Route.useParams();
  const record = useSpaceRoute(listingId, spaceId);
  if (!record) return null;

  return (
    <div className="d-flex align-items-stretch">
      <div className="flex-grow-1" style={{ minWidth: 0 }}>
        <DealActivity listing={record.space} />
      </div>
      <div
        className="flex-shrink-0 d-none d-xl-flex border-start"
        style={{ width: 420 }}
      >
        <DealMessagesRail listingId={spaceId} />
      </div>
    </div>
  );
}
