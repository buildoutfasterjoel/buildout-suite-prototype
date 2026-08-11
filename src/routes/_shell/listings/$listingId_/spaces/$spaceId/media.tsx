import { createFileRoute } from "@tanstack/react-router";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faVectorSquare } from "@fortawesome/pro-regular-svg-icons";
import { useDataStore } from "#/data/dataStore";
import { SpaceMedia } from "#/components/listings/media/SpaceMedia";
import { useSpaceRoute } from "#/components/deals/useSpaceRoute";

export const Route = createFileRoute(
  "/_shell/listings/$listingId_/spaces/$spaceId/media",
)({ component: SpaceMediaRoute });

function SpaceMediaRoute() {
  const { listingId, spaceId } = Route.useParams();
  const record = useSpaceRoute(listingId, spaceId);
  // `useDataStore`, not `getListing()`: this page writes the building's shell
  // (via `patchMarketing`), so it has to re-render on its own edits rather than
  // relying on `useSpaceRoute`'s subscription to carry it, as the sibling
  // building route (`listings/$listingId/media.tsx`) does for the same reason.
  const shell = useDataStore((s) => s.listings.get(listingId));
  if (!record || !shell) return null;

  // Media is keyed to a suite — every asset here is scoped by `unitId`. A space
  // whose `unitId` is dangling has no suite to scope to, so it says so rather
  // than rendering an editor bound to nothing. Same treatment as `details.tsx`.
  if (!record.unit) {
    return (
      <div className="p-4">
        <Empty>
          <Empty.Media>
            <FontAwesomeIcon icon={faVectorSquare} aria-label="No suite" />
          </Empty.Media>
          <Empty.Content>
            <Empty.Title>This space is not linked to a suite</Empty.Title>
            Its media is scoped to a unit on the property record, and that unit is
            missing.
          </Empty.Content>
        </Empty>
      </div>
    );
  }

  return <SpaceMedia shell={shell} unitId={record.unit.id} unitLabel={record.label} />;
}
