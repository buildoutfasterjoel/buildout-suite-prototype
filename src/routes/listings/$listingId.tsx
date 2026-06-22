import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBuildingCircleExclamation } from "@fortawesome/pro-regular-svg-icons";
import { getStore } from "#/data/store";
import { PropertyDetailHeader } from "#/components/properties/PropertyDetailHeader";
import { PropertyDetailSidebar } from "#/components/properties/PropertyDetailSidebar";

export const Route = createFileRoute("/listings/$listingId")({
  component: PropertyDetail,
  head: ({ params }) => {
    const property = getStore().properties.get(params.listingId);
    return {
      meta: [
        { title: `${property?.name ?? "Property"} | Buildout Suite` },
      ],
    };
  },
});

function PropertyNotFound() {
  return (
    <div className="container py-8 d-flex justify-content-center">
      <Empty>
        <Empty.Media>
          <FontAwesomeIcon
            icon={faBuildingCircleExclamation}
            aria-label="Property not found"
          />
        </Empty.Media>
        <Empty.Content>
          <Empty.Title>Property not found</Empty.Title>
          We couldn&apos;t find the property you&apos;re looking for. It may have
          been removed or the link is incorrect.
        </Empty.Content>
        <Empty.Actions>
          <Button variant="primary" render={<Link to="/listings" />}>
            Back to Listings
          </Button>
        </Empty.Actions>
      </Empty>
    </div>
  );
}

function PropertyDetail() {
  const { listingId } = Route.useParams();
  const property = getStore().properties.get(listingId);

  if (!property) return <PropertyNotFound />;

  return (
    <div className="d-flex flex-column h-100 overflow-hidden">
      <PropertyDetailHeader property={property} />

      <div className="p-6 flex-grow-1 overflow-hidden d-flex flex-column">
        <div className="container flex-grow-1 d-flex overflow-hidden gap-6">
          {/* Section nav — its own card */}
          <Card
            className="overflow-auto shadow flex-shrink-0"
            style={{ width: 248 }}
          >
            <PropertyDetailSidebar />
          </Card>

          {/* Detail content — its own card */}
          <Card className="flex-grow-1 overflow-hidden d-flex flex-column">
            <div className="flex-grow-1 overflow-y-auto overflow-x-hidden">
              <Outlet />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
