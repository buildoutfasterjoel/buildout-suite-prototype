import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faVectorSquare, faPlus } from "@fortawesome/pro-regular-svg-icons";
import { useDataStore } from "#/data/dataStore";
import { getListing } from "#/data/store";
import { getChildDeals } from "#/data/leaseSpaces";
import { AddSpaceModal } from "#/components/deals/AddSpaceModal";
import { DealStageBadge } from "#/components/deals/DealStageBadge";

export const Route = createFileRoute("/_shell/listings/$listingId/spaces")({
  component: SpacesTab,
});

function SpacesTab() {
  const { listingId } = Route.useParams();
  // Reactive: re-render when a child is added (store map is replaced).
  const version = useDataStore((s) => s.listings);
  void version;
  const listing = getListing(listingId);
  const canAddSpace =
    listing?.dealType === "Lease" && listing?.parentDealId == null;
  const children = getChildDeals(listingId);
  const [addOpen, setAddOpen] = useState(false);

  if (!canAddSpace) {
    return (
      <div className="p-4">
        <Empty>
          <Empty.Media>
            <FontAwesomeIcon icon={faVectorSquare} aria-label="Not eligible" />
          </Empty.Media>
          <Empty.Content>
            <Empty.Title>
              Spaces are only for lease representation deals
            </Empty.Title>
            Only top-level landlord-rep lease deals can be split into spaces.
          </Empty.Content>
        </Empty>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h2 className="h5 mb-0">Spaces</h2>
        <Button variant="primary" onClick={() => setAddOpen(true)}>
          <FontAwesomeIcon icon={faPlus} /> Add space
        </Button>
      </div>

      {children.length === 0 ? (
        <Empty>
          <Empty.Media>
            <FontAwesomeIcon icon={faVectorSquare} aria-label="No spaces" />
          </Empty.Media>
          <Empty.Content>
            <Empty.Title>No spaces yet</Empty.Title>
            Add a space to spin an individual unit into its own deal — it inherits this deal&apos;s
            marketing template.
          </Empty.Content>
          <Empty.Actions>
            <Button variant="primary" onClick={() => setAddOpen(true)}>
              <FontAwesomeIcon icon={faPlus} /> Add space
            </Button>
          </Empty.Actions>
        </Empty>
      ) : (
        <div className="d-flex flex-column gap-2">
          {children.map((c) => (
            <Link
              key={c.id}
              to="/listings/$listingId"
              params={{ listingId: c.id }}
              className="d-flex align-items-center justify-content-between gap-3 border rounded p-3 text-decoration-none"
            >
              <span className="d-flex align-items-center gap-2 text-body fw-semibold">
                <FontAwesomeIcon icon={faVectorSquare} className="text-muted" />
                {c.name}
              </span>
              <span className="d-flex align-items-center gap-3">
                <span className="text-muted">
                  {c.marketing.spaceLeaseTerms[0]?.leaseRate
                    ? `$${c.marketing.spaceLeaseTerms[0]?.leaseRate} ${c.marketing.spaceLeaseTerms[0]?.leaseRateUnits}`
                    : "Rate TBD"}
                </span>
                <DealStageBadge stage={c.status} />
              </span>
            </Link>
          ))}
        </div>
      )}

      <AddSpaceModal
        parentDealId={listingId}
        open={addOpen}
        onOpenChange={setAddOpen}
      />
    </div>
  );
}
