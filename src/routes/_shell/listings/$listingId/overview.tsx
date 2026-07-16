import { createFileRoute } from "@tanstack/react-router";
import { Alert } from "@buildoutinc/blueprint-react/ui/Alert";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { getStore } from "#/data/store";
import { publishReadiness, REQUIRED_FIELD_LABEL } from "#/data/stageGates";
import { requestSetupCompletion } from "#/components/deals/useStageGate";
import { TodayPlanner } from "#/components/deals/TodayPlanner";
import { DealContextRail } from "#/components/deals/DealContextRail";
import type { Listing } from "#/data/types";

export const Route = createFileRoute("/_shell/listings/$listingId/overview")({
  component: OverviewRoute,
});

/**
 * Sell-side deals started directly in a live stage (Active/Under Contract) never
 * went through the Approve & Publish gate, so they're live in name but missing
 * required info and unpublished. Warn and offer to finish setup in place.
 */
function SetupIncompleteBanner({ listing }: { listing: Listing }) {
  const needsSetup =
    listing.dealSide === "seller" &&
    listing.status !== "proposal" &&
    listing.status !== "inactive" &&
    listing.publishedAt === null;
  if (!needsSetup) return null;

  const { missing } = publishReadiness(listing);
  if (missing.length === 0) return null;

  return (
    <Alert severity="warning" withIcon className="m-3 mb-0">
      <Alert.Title>Setup incomplete</Alert.Title>
      <div className="d-flex flex-column align-items-start gap-2">
        <span>
          This deal still needs{" "}
          {missing.map((f) => REQUIRED_FIELD_LABEL[f]).join(", ")} before it can
          be approved &amp; published.
        </span>
        <Button
          variant="primary"
          size="sm"
          onClick={() => requestSetupCompletion(listing.id)}
        >
          Complete &amp; publish
        </Button>
      </div>
    </Alert>
  );
}

function OverviewRoute() {
  const { listingId } = Route.useParams();
  const store = getStore();
  const listing = store.listings.get(listingId);
  if (!listing) return null;
  return (
    <div>
      <SetupIncompleteBanner listing={listing} />
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
    </div>
  );
}
