import { createFileRoute } from "@tanstack/react-router";
import { Alert } from "@buildoutinc/blueprint-react/ui/Alert";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTriangleExclamation } from "@fortawesome/pro-duotone-svg-icons";
import { useDataStore } from "#/data/dataStore";
import { publishReadiness, REQUIRED_FIELD_LABEL } from "#/data/stageGates";
import { gateContext } from "#/data/dealShape";
import { requestSetupCompletion } from "#/components/deals/useStageGate";
import { IngestionBanner } from "#/components/deals/IngestionBanner";
import { MarketingReadinessBanner } from "#/components/deals/MarketingReadinessBanner";
import { useMarketingReadiness } from "#/components/deals/useMarketingReadiness";
import { TodayPlanner } from "#/components/deals/TodayPlanner";
import { DealContextRail } from "#/components/deals/DealContextRail";
import type { Listing } from "#/data/types";
import { ListingPageHeader } from "#/components/listings/ListingPageHeader";

export const Route = createFileRoute("/_shell/listings/$listingId/overview")({
  component: OverviewRoute,
});

/**
 * Sell-side deals started directly in a live stage (Active/Under Contract) never
 * went through the Approve & Publish gate, so they're live in name but missing
 * required info and unpublished. Warn and offer to finish setup in place.
 */
function SetupIncompleteBanner({ listing }: { listing: Listing }) {
  // While documents are still being read, the missing fields are about to be
  // filled — the ingestion banner is the accurate status. Don't stack both.
  if (listing.ingestion?.status === "processing") return null;

  const needsSetup =
    listing.dealSide === "seller" &&
    listing.status !== "proposal" &&
    listing.status !== "inactive" &&
    listing.publishedAt === null;
  if (!needsSetup) return null;

  const { shape, shellActive } = gateContext(listing);
  const { missing } = publishReadiness(listing, { shape, shellActive });
  if (missing.length === 0) return null;

  return (
    <Alert severity="warning" withIcon className="m-3 mb-0">
      <FontAwesomeIcon icon={faTriangleExclamation} />
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

/**
 * The two readiness banners never stack. They overlap on two fields — Sale
 * Description and Asking Price — and marketing readiness is the earlier gate:
 * a deal that cannot render a flyer is not ready to be approved and published
 * either, so naming the publish requirements on top of it is a second warning
 * about a step the broker has not reached. Marketing readiness wins; the
 * publish banner returns once it clears.
 *
 * A brand-new deal only sees the marketing one anyway — `SetupIncompleteBanner`
 * needs a stage past Pitching. They meet when a deal is created directly into
 * Active or Under Contract, which the create wizard allows.
 */
function ReadinessBanners({ listing }: { listing: Listing }) {
  const { ready } = useMarketingReadiness(listing);
  if (!ready) {
    return (
      <div className="m-3 mb-0">
        <MarketingReadinessBanner listing={listing} />
      </div>
    );
  }
  return <SetupIncompleteBanner listing={listing} />;
}

function OverviewRoute() {
  const { listingId } = Route.useParams();
  // Reactive selector (not getStore()) so a stage move — which replaces the
  // listing object with a new stage, task list, and published marker — re-renders
  // the banner and planner immediately. Same convention as $listingId.tsx.
  const listing = useDataStore((s) => s.listings.get(listingId));
  if (!listing) return null;
  return (
    <div>
      <ReadinessBanners listing={listing} />
      <div className="d-flex align-items-stretch">
        <div className="flex-grow-1 d-flex flex-column" style={{ minWidth: 0 }}>
          <div className="px-4 py-3">
            <ListingPageHeader title="Overview" />
          </div>
          {/* Inside the overview column, under its title — so it doesn't run
              across the top of the page above the context rail. */}
          <IngestionBanner listing={listing} />
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
