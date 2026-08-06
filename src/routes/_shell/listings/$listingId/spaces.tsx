import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faVectorSquare, faPlus, faAngleRight } from "@fortawesome/pro-regular-svg-icons";
import { useDataStore } from "#/data/dataStore";
import { getListing } from "#/data/store";
import { buildingSuites, type SuiteRow } from "#/data/buildingSuites";
import { canAddSpaces, isLeaseParent } from "#/data/dealShape";
import { addSpaceToDeal } from "#/data/leaseSpaces";
import { updateDealMarketing } from "#/data/actions";
import { emptySpaceLeaseTerms } from "#/data/createListing";
import { notify } from "#/lib/notify";
import { AddSpaceModal } from "#/components/deals/AddSpaceModal";

export const Route = createFileRoute("/_shell/listings/$listingId/spaces")({
  component: SpacesTab,
});

/**
 * Blueprint's Badge offers exactly three variants — "primary" | "secondary" |
 * "outline" — so this maps six states onto them by how actionable the row is
 * rather than by inventing a colour per state.
 *
 * Available is the one state the broker is actively working, so it takes the
 * emphasis. Vacant and Not advertised are dormant — nothing is happening yet —
 * so they read as an outline. Everything else is settled or belongs to someone
 * else and reads muted.
 */
function statusVariant(status: SuiteRow["status"]) {
  if (status === "Available") return "primary" as const;
  if (status === "Vacant" || status === "Not advertised") return "outline" as const;
  return "secondary" as const;
}

function SuiteTenant({ row, shellId }: { row: SuiteRow; shellId: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(row.tenantName ?? "");

  const commit = () => {
    const shell = getListing(shellId);
    if (!shell) return;
    const rows = shell.marketing.spaceLeaseTerms ?? [];
    const next = value.trim();
    // A blank override is removed rather than stored, so the shell never
    // accumulates rows holding nothing and the row falls back to the unit's own
    // tenant name. This is the only way a shell reacquires space terms, and it
    // holds exactly one field's worth.
    const withoutUnit = rows.filter((t) => t.unitId !== row.unitId);
    const existing = rows.find((t) => t.unitId === row.unitId);
    updateDealMarketing(shellId, {
      spaceLeaseTerms: next
        ? [
            ...withoutUnit,
            { ...(existing ?? emptySpaceLeaseTerms(row.unitId)), tenantName: next },
          ]
        : withoutUnit,
    });
    setEditing(false);
    notify({ title: "Tenant name saved" });
  };

  if (!editing) {
    return (
      <button
        type="button"
        className="border-0 bg-transparent p-0 text-start text-muted"
        style={{ cursor: "pointer" }}
        onClick={() => setEditing(true)}
      >
        {row.tenantName ?? "Add tenant name"}
        {row.leaseExpiration ? ` · thru ${row.leaseExpiration}` : ""}
      </button>
    );
  }

  return (
    <span className="d-inline-flex align-items-center gap-2">
      <Input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
        style={{ width: 220 }}
      />
    </span>
  );
}

function SpacesTab() {
  const { listingId } = Route.useParams();
  const navigate = useNavigate();
  // Subscribe to both maps: a row is a join of a unit (properties) and its deal
  // (listings), so either changing must re-render.
  void useDataStore((s) => s.listings);
  void useDataStore((s) => s.properties);
  const listing = getListing(listingId);
  // Whether this deal has a Spaces section at all — a top-level lease deal,
  // regardless of stage. Separate from canAddSpaces: a Lost shell keeps the
  // section, it just cannot accept new suites.
  const leaseParent = isLeaseParent(listing);
  const canAddSpace = listing ? canAddSpaces(listing) : false;
  const rows = buildingSuites(listingId);
  const [addOpen, setAddOpen] = useState(false);

  const startDeal = (unitId: string) => {
    const created = addSpaceToDeal(listingId, unitId);
    if (!created) return;
    void navigate({
      to: "/listings/$listingId/spaces/$spaceId/details",
      params: { listingId, spaceId: created.deal.id },
    });
  };

  if (!leaseParent) {
    return (
      <div className="p-4">
        <Empty>
          <Empty.Media>
            <FontAwesomeIcon icon={faVectorSquare} aria-label="Not eligible" />
          </Empty.Media>
          <Empty.Content>
            <Empty.Title>Spaces are only for lease representation deals</Empty.Title>
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
        {canAddSpace && (
          <Button variant="primary" onClick={() => setAddOpen(true)}>
            <FontAwesomeIcon icon={faPlus} /> Add space
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <Empty>
          <Empty.Media>
            <FontAwesomeIcon icon={faVectorSquare} aria-label="No suites" />
          </Empty.Media>
          <Empty.Content>
            <Empty.Title>No suites on this property yet</Empty.Title>
            Add a space to put a suite on the building and start its deal.
          </Empty.Content>
          {canAddSpace && (
            <Empty.Actions>
              <Button variant="primary" onClick={() => setAddOpen(true)}>
                <FontAwesomeIcon icon={faPlus} /> Add space
              </Button>
            </Empty.Actions>
          )}
        </Empty>
      ) : (
        <div className="d-flex flex-column gap-2">
          {rows.map((row) => {
            const shared = (
              <>
                <span className="fw-semibold">{row.label}</span>
                <span className="text-muted">{row.sqft.toLocaleString()} SF</span>
                <span className="text-muted">
                  {row.leaseRate != null
                    ? `$${row.leaseRate} ${row.leaseRateUnits}`
                    : ""}
                </span>
                <span className="ms-auto d-flex align-items-center gap-3">
                  <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                </span>
              </>
            );

            // A suite with a deal is a link to that deal's page. A suite without
            // one is not — there is nowhere to go, so the row carries whatever
            // action it does support instead.
            if (row.dealId) {
              return (
                <Link
                  key={row.unitId}
                  to="/listings/$listingId/spaces/$spaceId/overview"
                  params={{ listingId, spaceId: row.dealId }}
                  className="d-flex align-items-center gap-3 border rounded p-3 text-decoration-none text-body"
                >
                  {shared}
                  <FontAwesomeIcon icon={faAngleRight} className="text-muted" />
                </Link>
              );
            }

            return (
              <div
                key={row.unitId}
                className="d-flex align-items-center gap-3 border rounded p-3"
              >
                {shared}
                {row.status === "Occupied" ? (
                  <SuiteTenant row={row} shellId={listingId} />
                ) : (
                  canAddSpace && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => startDeal(row.unitId)}
                    >
                      Start a deal
                    </Button>
                  )
                )}
              </div>
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
