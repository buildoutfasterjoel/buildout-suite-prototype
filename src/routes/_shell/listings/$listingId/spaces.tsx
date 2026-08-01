import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { Collapsible } from "@buildoutinc/blueprint-react/ui/Collapsible";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faVectorSquare, faPlus } from "@fortawesome/pro-regular-svg-icons";
import { useDataStore } from "#/data/dataStore";
import { getListing, getProperty } from "#/data/store";
import { buildingAvailability } from "#/data/buildingAvailability";
import { canAddSpaces } from "#/data/dealShape";
import { emptySpaceLeaseTerms } from "#/data/createListing";
import { updateDealMarketing } from "#/data/actions";
import { SpaceTermsSection } from "#/components/listings/edit/sections/SpaceTermsSection";
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
  const canAddSpace = listing ? canAddSpaces(listing) : false;
  const rows = buildingAvailability(listingId);
  const property = listing ? getProperty(listing.propertyId) : undefined;
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
        <h2 className="fs-6 fw-semibold mb-0">Spaces</h2>
        <Button variant="primary" onClick={() => setAddOpen(true)}>
          <FontAwesomeIcon icon={faPlus} /> Add space
        </Button>
      </div>

      {rows.length === 0 ? (
        <Empty>
          <Empty.Media>
            <FontAwesomeIcon icon={faVectorSquare} aria-label="No spaces" />
          </Empty.Media>
          <Empty.Content>
            <Empty.Title>No spaces yet</Empty.Title>
            Add a space to spin an individual unit into its own deal. The
            building&apos;s marketing is shared by every space.
          </Empty.Content>
          <Empty.Actions>
            <Button variant="primary" onClick={() => setAddOpen(true)}>
              <FontAwesomeIcon icon={faPlus} /> Add space
            </Button>
          </Empty.Actions>
        </Empty>
      ) : (
        <div className="d-flex flex-column gap-2">
          {rows.map((row) => {
            const child = getListing(row.dealId);
            const unit = property?.units.find((u) => u.id === row.unitId);
            if (!child || !unit || !property) return null;
            const terms =
              child.marketing.spaceLeaseTerms?.[0] ??
              emptySpaceLeaseTerms(row.unitId);
            return (
              <Collapsible key={row.dealId} className="border rounded">
                <div className="d-flex align-items-center justify-content-between gap-3 p-3">
                  <Collapsible.Trigger className="d-flex align-items-center gap-2 border-0 bg-transparent p-0 fw-semibold text-body">
                    <FontAwesomeIcon
                      icon={faVectorSquare}
                      className="text-muted"
                    />
                    {unit.label}
                    <span className="text-muted fw-normal">
                      {row.sqft.toLocaleString()} SF
                    </span>
                  </Collapsible.Trigger>
                  <span className="d-flex align-items-center gap-3">
                    <span className="text-muted">
                      {row.leaseRate != null
                        ? `$${row.leaseRate} ${row.leaseRateUnits}`
                        : "Rate TBD"}
                    </span>
                    <span className="text-muted">{row.availability}</span>
                    <DealStageBadge stage={child.status} />
                    <Link
                      to="/listings/$listingId"
                      params={{ listingId: row.dealId }}
                      className="text-decoration-none"
                    >
                      Open deal
                    </Link>
                  </span>
                </div>
                <Collapsible.Content className="border-top p-3">
                  <SpaceTermsSection
                    bare
                    unit={unit}
                    property={property}
                    terms={terms}
                    onChange={(patch) =>
                      updateDealMarketing(row.dealId, {
                        spaceLeaseTerms: [{ ...terms, ...patch }],
                      })
                    }
                  />
                </Collapsible.Content>
              </Collapsible>
            );
          })}
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
