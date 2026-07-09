import { createFileRoute } from "@tanstack/react-router";
import { getStore } from "#/data/store";
import { TodayPlanner } from "#/components/deals/TodayPlanner";
import { DealContextRail } from "#/components/deals/DealContextRail";

export const Route = createFileRoute("/listings/$listingId/overview")({
  component: OverviewRoute,
});

function OverviewRoute() {
  const { listingId } = Route.useParams();
  const store = getStore();
  const listing = store.listings.get(listingId);
  if (!listing) return null;
  return (
    <div className="d-flex align-items-stretch">
      <div className="flex-grow-1" style={{ minWidth: 0 }}>
        <TodayPlanner listing={listing} />
      </div>
      <div
        className="flex-shrink-0 d-none d-xl-block border-start"
        style={{ width: 340 }}
      >
        <DealContextRail listing={listing} />
      </div>
    </div>
  );
}
