import { createFileRoute } from "@tanstack/react-router";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBuildingFlag } from "@fortawesome/pro-regular-svg-icons";
import { useDataStore } from "#/data/dataStore";
import { getListing } from "#/data/store";
import { dealShape } from "#/data/dealShape";
import { PropertyMarketingHub } from "#/components/deals/PropertyMarketingHub";

export const Route = createFileRoute(
  "/_shell/listings/$listingId/property-marketing",
)({
  component: PropertyMarketingRoute,
});

function PropertyMarketingRoute() {
  const { listingId } = Route.useParams();
  // Reactive: re-render if the listing (or its shape) changes.
  const version = useDataStore((s) => s.listings);
  void version;
  const listing = getListing(listingId);

  if (!listing || dealShape(listing) !== "space") {
    return (
      <div className="p-4">
        <Empty>
          <Empty.Media>
            <FontAwesomeIcon icon={faBuildingFlag} aria-label="Not eligible" />
          </Empty.Media>
          <Empty.Content>
            <Empty.Title>Property Marketing is only for spaces</Empty.Title>
            Only a space deal under a lease shell has a Property Marketing
            hub.
          </Empty.Content>
        </Empty>
      </div>
    );
  }

  return <PropertyMarketingHub listing={listing} />;
}
