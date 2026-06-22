import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBuildingCircleExclamation } from "@fortawesome/pro-regular-svg-icons";
import { getStore } from "#/data/store";
import { PropertyDetailHeader } from "#/components/properties/PropertyDetailHeader";
import { PropertyDetailSidebar } from "#/components/properties/PropertyDetailSidebar";
import { PropertyDetailDashboard } from "#/components/properties/PropertyDetailDashboard";

export const Route = createFileRoute("/properties/$propertyId")({
  component: PropertyDetail,
  head: ({ params }) => {
    const property = getStore().properties.get(params.propertyId);
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
          <Button variant="primary" render={<Link to="/properties" />}>
            Back to Listings
          </Button>
        </Empty.Actions>
      </Empty>
    </div>
  );
}

function PropertyDetail() {
  const { propertyId } = Route.useParams();
  const property = getStore().properties.get(propertyId);

  if (!property) return <PropertyNotFound />;

  return (
    <div className="d-flex flex-column h-100">
      <PropertyDetailHeader property={property} />

      <div className="container py-4 flex-grow-1 overflow-auto">
        <Card className="overflow-hidden">
          <div className="d-flex align-items-stretch">
            <PropertyDetailSidebar />
            <PropertyDetailDashboard property={property} />
          </div>
        </Card>
      </div>
    </div>
  );
}
