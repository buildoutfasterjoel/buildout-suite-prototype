import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faHandshake } from "@fortawesome/pro-regular-svg-icons";
import type { Listing, Property } from "#/data/types";
import { DealCardById } from "#/components/deals/DealCard";
import { useCreateDeal } from "#/data/useCreateDeal";

export function PropertyDealsPanel({
  property,
  deals,
}: {
  property: Property;
  deals: Listing[];
}) {
  return (
    <Card className="shadow-sm">
      <Card.Body className="d-flex flex-column gap-3">
        <div className="d-flex align-items-center justify-content-between gap-2">
          <Card.Title className="fs-6 d-inline-flex align-items-center gap-2">
            Deals on this property
            <Badge variant="secondary" appearance="muted" className="fs-xs">{deals.length}</Badge>
          </Card.Title>
          <Button variant="outline" size="sm" onClick={() => useCreateDeal.getState().openFor({ property })}>
            <FontAwesomeIcon icon={faPlus} />
            New deal
          </Button>
        </div>
        {deals.length === 0 ? (
          <Empty className="py-4">
            <Empty.Media>
              <FontAwesomeIcon icon={faHandshake} aria-label="No deals" />
            </Empty.Media>
            <Empty.Content>
              <Empty.Title>No deals yet</Empty.Title>
              Start a deal from this property and it will show up here.
            </Empty.Content>
          </Empty>
        ) : (
          <div className="d-flex flex-column gap-3">
            {deals.map((d) => (
              <DealCardById key={d.id} listingId={d.id} showStatus />
            ))}
          </div>
        )}
      </Card.Body>
    </Card>
  );
}
