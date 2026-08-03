import { useEffect } from "react";
import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBuildingCircleExclamation } from "@fortawesome/pro-regular-svg-icons";
import { getStore } from "#/data/store";
import { useDataStore } from "#/data/dataStore";
import { suitePanelPath, legacySubPath } from "#/data/suitePanelPath";
import { PropertyDetailHeader } from "#/components/properties/PropertyDetailHeader";
import { PropertyDetailSidebar } from "#/components/properties/PropertyDetailSidebar";
import { MarketingScopeBar } from "#/components/deals/MarketingScopeBar";

export const Route = createFileRoute("/_shell/listings/$listingId")({
  component: PropertyDetail,
  head: ({ params }) => {
    const listing = getStore().listings.get(params.listingId);
    return {
      meta: [{ title: `${listing?.name ?? "Listing"} | Buildout Suite` }],
    };
  },
});

function ListingNotFound() {
  return (
    <div className="container py-8 d-flex justify-content-center">
      <Empty>
        <Empty.Media>
          <FontAwesomeIcon
            icon={faBuildingCircleExclamation}
            aria-label="Listing not found"
          />
        </Empty.Media>
        <Empty.Content>
          <Empty.Title>Listing not found</Empty.Title>
          We couldn&apos;t find the listing you&apos;re looking for. It may have
          been removed or the link is incorrect.
        </Empty.Content>
        <Empty.Actions>
          <Button
            variant="primary"
            nativeButton={false}
            render={<Link to="/listings" />}
          >
            Back to Deals
          </Button>
        </Empty.Actions>
      </Empty>
    </div>
  );
}

function PropertyDetail() {
  const { listingId } = Route.useParams();
  // Subscribe to the whole map, not `.get(listingId)`: a deal's *shape* is derived
  // from other listings, so adding a space turns this deal into a shell without
  // touching its own object. A `.get()` selector would compare referentially equal
  // and skip the re-render, leaving the header offering a flat lease's full stage
  // ladder on a deal that can no longer go past Active. Also covers the original
  // reason for a reactive selector — commitStageTransition replaces both.
  const listing = useDataStore((s) => s.listings).get(listingId);

  const navigate = useNavigate();
  const { pathname } = useLocation();

  // A suite has no page of its own — it renders as a panel over its building. This runs in
  // the component rather than beforeLoad because the store is client-owned (Zustand +
  // IndexedDB): on a cold load beforeLoad fires before hydration, the suite lookup misses,
  // and it never re-runs. A reactive selector re-renders the moment hydration lands, so the
  // canonicalization always happens. `replace` keeps the legacy URL out of history.
  const panelPath = listing
    ? suitePanelPath(listing, legacySubPath(pathname, listing.id))
    : null;

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (panelPath) void navigate({ to: panelPath, replace: true } as any);
  }, [panelPath, navigate]);

  if (!listing) return <ListingNotFound />;

  // Don't paint the suite's old page for a frame on the way out.
  if (panelPath) return null;

  return (
    <div className="h-100 overflow-y-auto overflow-x-hidden">
      <PropertyDetailHeader listing={listing} />

      <div className="container d-flex align-items-start gap-4 py-4">
        {/* Section nav — its own card */}
        <Card
          className="shadow flex-shrink-0 position-sticky"
          style={{ width: 180, top: 0 }}
        >
          <PropertyDetailSidebar />
        </Card>

        {/* Detail content — each tab renders its own layout, including
            the deal context rail where applicable (e.g. Overview). */}
        <Card className="flex-grow-1 shadow" style={{ minWidth: 0 }}>
          <MarketingScopeBar />
          <Outlet />
        </Card>
      </div>
    </div>
  );
}
