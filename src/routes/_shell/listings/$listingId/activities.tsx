import { createFileRoute } from "@tanstack/react-router";
import { getStore } from "#/data/store";
import { DealActivity } from "#/components/deals/DealStubs";
import { DealMessagesRail } from "#/components/deals/DealMessagesRail";

export const Route = createFileRoute("/_shell/listings/$listingId/activities")({
  component: ActivitiesRoute,
});

function ActivitiesRoute() {
  const { listingId } = Route.useParams();
  const listing = getStore().listings.get(listingId);
  if (!listing) return null;
  return (
    <div className="d-flex align-items-stretch">
      <div className="flex-grow-1" style={{ minWidth: 0 }}>
        <DealActivity listing={listing} />
      </div>
      <div
        className="flex-shrink-0 d-none d-xl-flex border-start"
        style={{ width: 420 }}
      >
        <DealMessagesRail listingId={listingId} />
      </div>
    </div>
  );
}
