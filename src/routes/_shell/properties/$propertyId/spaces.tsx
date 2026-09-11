import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faVectorSquare } from "@fortawesome/pro-regular-svg-icons";
import { useDataStore } from "#/data/dataStore";
import { propertyAvailability, propertySpaces } from "#/data/propertySpaces";
import { SpacesSummaryStrip } from "#/components/properties/SpacesSummaryStrip";
import { SpacesRoster } from "#/components/properties/SpacesRoster";
import { CreateSpaceModal } from "#/components/properties/CreateSpaceModal";

export const Route = createFileRoute("/_shell/properties/$propertyId/spaces")({
  component: PropertySpacesRoute,
});

/**
 * Every space on the property. Full width — this tab renders no rail, because
 * the roster's seven columns need it. Always present in the nav; with no spaces
 * it is the empty state with the one action that changes that.
 */
function PropertySpacesRoute() {
  const { propertyId } = Route.useParams();
  // A row is a join of a unit (properties) and its deal (listings).
  void useDataStore((s) => s.properties);
  void useDataStore((s) => s.listings);
  const rows = propertySpaces(propertyId);
  const availability = propertyAvailability(propertyId);
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="p-4 d-flex flex-column gap-3">
      {availability ? (
        <>
          <SpacesSummaryStrip availability={availability} onAddSpace={() => setAddOpen(true)} />
          <SpacesRoster rows={rows} propertyId={propertyId} />
        </>
      ) : (
        <>
          <h2 className="fs-6 fw-semibold mb-0">Spaces</h2>
          <Empty>
            <Empty.Media>
              <FontAwesomeIcon icon={faVectorSquare} aria-label="No spaces" />
            </Empty.Media>
            <Empty.Content>
              <Empty.Title>No spaces on this property yet</Empty.Title>
              Add a space to track it here and start a deal on it when you&apos;re ready.
            </Empty.Content>
            <Empty.Actions>
              <Button variant="primary" onClick={() => setAddOpen(true)}>
                <FontAwesomeIcon icon={faPlus} />
                Add Space
              </Button>
            </Empty.Actions>
          </Empty>
        </>
      )}

      <CreateSpaceModal propertyId={propertyId} open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
