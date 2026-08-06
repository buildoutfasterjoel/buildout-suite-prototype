import { createFileRoute } from "@tanstack/react-router";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faVectorSquare } from "@fortawesome/pro-regular-svg-icons";
import { SpaceDetails } from "#/components/deals/SpaceDetails";
import { useSpaceRoute } from "#/components/deals/useSpaceRoute";

export const Route = createFileRoute(
  "/_shell/listings/$listingId_/spaces/$spaceId/details",
)({ component: SpaceDetailsRoute });

function SpaceDetailsRoute() {
  const { listingId, spaceId } = Route.useParams();
  const record = useSpaceRoute(listingId, spaceId);
  if (!record) return null;

  // The form is keyed to a suite — every field on it describes one. A space whose
  // `unitId` is dangling has nothing to describe, so it says so rather than
  // rendering a form bound to nothing.
  if (!record.unit) {
    return (
      <div className="p-4">
        <Empty>
          <Empty.Media>
            <FontAwesomeIcon icon={faVectorSquare} aria-label="No suite" />
          </Empty.Media>
          <Empty.Content>
            <Empty.Title>This space is not linked to a suite</Empty.Title>
            Its details are edited against a unit on the property record, and that
            unit is missing.
          </Empty.Content>
        </Empty>
      </div>
    );
  }

  return (
    <SpaceDetails
      space={record.space}
      property={record.property}
      unit={record.unit}
    />
  );
}
