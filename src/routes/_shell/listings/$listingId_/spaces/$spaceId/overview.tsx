import { createFileRoute } from "@tanstack/react-router";
import { ListingPageHeader } from "#/components/listings/ListingPageHeader";
import { TodayPlanner } from "#/components/deals/TodayPlanner";
import { DealContextRail } from "#/components/deals/DealContextRail";
import { useSpaceRoute } from "#/components/deals/useSpaceRoute";

export const Route = createFileRoute(
  "/_shell/listings/$listingId_/spaces/$spaceId/overview",
)({ component: SpaceOverviewRoute });

function SpaceOverviewRoute() {
  const { listingId, spaceId } = Route.useParams();
  const record = useSpaceRoute(listingId, spaceId);
  if (!record) return null;

  return (
    <div className="d-flex align-items-stretch">
      <div className="flex-grow-1 d-flex flex-column" style={{ minWidth: 0 }}>
        <div className="px-4 py-3">
          <ListingPageHeader title="Overview" />
        </div>
        <TodayPlanner listing={record.space} />
      </div>
      <div
        className="flex-shrink-0 d-none d-xl-block border-start"
        style={{ width: 340 }}
      >
        <DealContextRail listing={record.space} />
      </div>
    </div>
  );
}
