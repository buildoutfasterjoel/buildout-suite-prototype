import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBuildingCircleExclamation } from "@fortawesome/pro-regular-svg-icons";
import { getStore } from "#/data/store";
import { PropertyDetailHeader } from "#/components/properties/PropertyDetailHeader";
import { PropertyDetailSidebar } from "#/components/properties/PropertyDetailSidebar";
import { DealContextRail } from "#/components/deals/DealContextRail";

export const Route = createFileRoute("/listings/$listingId")({
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
  const listing = getStore().listings.get(listingId);

  if (!listing) return <ListingNotFound />;

  return (
    <div className="d-flex flex-column h-100 overflow-hidden">
      <PropertyDetailHeader listing={listing} />

      <div className="flex-grow-1 overflow-y-auto overflow-x-hidden py-4">
        <div className="container d-flex align-items-start gap-4">
          {/* Section nav — its own card */}
          <Card
            className="shadow flex-shrink-0 position-sticky"
            style={{ width: 248, top: 0 }}
          >
            <PropertyDetailSidebar />
          </Card>

          {/* Detail content — its own card */}
          <Card className="flex-grow-1 shadow">
            <Outlet />
          </Card>

          {/* Deal context rail — persistent across all tabs */}
          <Card
            className="shadow flex-shrink-0 d-none d-xl-block position-sticky"
            style={{ width: 340, top: 0 }}
          >
            <DealContextRail listing={listing} />
          </Card>
        </div>
      </div>
    </div>
  );
}
