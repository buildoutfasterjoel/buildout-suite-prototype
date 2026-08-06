import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faImage } from "@fortawesome/pro-regular-svg-icons";
import { ListingPageHeader } from "#/components/listings/ListingPageHeader";
import { useSpaceRoute } from "#/components/deals/useSpaceRoute";

export const Route = createFileRoute(
  "/_shell/listings/$listingId_/spaces/$spaceId/plans",
)({ component: SpacePlansRoute });

function SpacePlansRoute() {
  const { listingId, spaceId } = Route.useParams();
  if (!useSpaceRoute(listingId, spaceId)) return null;

  return (
    <div className="d-flex flex-column gap-3 p-4">
      <ListingPageHeader
        title="Plans"
        actions={<Button variant="primary">New Plan</Button>}
      />

      <Card>
        <Card.Body>
          <Empty className="py-8">
            <Empty.Media>
              <FontAwesomeIcon icon={faImage} aria-label="No plans" />
            </Empty.Media>
            <Empty.Content>
              <Empty.Title>You don't have any plans yet!</Empty.Title>
              Click "New Plan" to create your first plan.
            </Empty.Content>
          </Empty>
        </Card.Body>
      </Card>
    </div>
  );
}
