import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBuildingCircleExclamation } from "@fortawesome/pro-regular-svg-icons";
import { getPropertyDetailClient } from "#/data/selectors";
import { PropertyRecordHeader } from "#/components/properties/PropertyRecordHeader";
import { PropertyFactsCard } from "#/components/properties/PropertyFactsCard";
import { PropertyDealsPanel } from "#/components/properties/PropertyDealsPanel";
import { PropertyOwnersCard } from "#/components/properties/PropertyOwnersCard";

export const Route = createFileRoute("/properties/$propertyId")({
  component: PropertyRecordPage,
  head: () => ({ meta: [{ title: "Property | Buildout Suite" }] }),
});

function PropertyNotFound() {
  return (
    <div className="container py-8 d-flex justify-content-center">
      <Empty>
        <Empty.Media>
          <FontAwesomeIcon icon={faBuildingCircleExclamation} aria-label="Property not found" />
        </Empty.Media>
        <Empty.Content>
          <Empty.Title>Property not found</Empty.Title>
          We couldn&apos;t find that property. It may have been removed, or the link is incorrect.
        </Empty.Content>
        <Empty.Actions>
          <Button variant="primary" nativeButton={false} render={<Link to="/properties" />}>
            Back to Properties
          </Button>
        </Empty.Actions>
      </Empty>
    </div>
  );
}

function PropertyRecordPage() {
  const { propertyId } = Route.useParams();
  const detail = getPropertyDetailClient(propertyId);
  if (!detail) return <PropertyNotFound />;
  const { property, deals, contacts, comps } = detail;

  return (
    <div className="d-flex flex-column h-100 overflow-auto">
      <PropertyRecordHeader property={property} />
      <div className="container py-4">
        <div className="row g-4">
          <div className="col-12 col-lg-3">
            <PropertyFactsCard property={property} />
          </div>
          <div className="col-12 col-lg-6">
            <PropertyDealsPanel property={property} deals={deals} />
          </div>
          <div className="col-12 col-lg-3">
            <PropertyOwnersCard contacts={contacts} comps={comps} />
          </div>
        </div>
      </div>
    </div>
  );
}
