import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faVectorSquare, faPlus, faAngleRight } from "@fortawesome/pro-regular-svg-icons";
import { useDataStore } from "#/data/dataStore";
import { getListing } from "#/data/store";
import { buildingSuites, groupSuites, type SuiteRow } from "#/data/buildingSuites";
import { canAddSpaces, isLeaseParent } from "#/data/dealShape";
import { addSpaceToDeal } from "#/data/leaseSpaces";
import { updateDealMarketing } from "#/data/actions";
import { emptySpaceLeaseTerms } from "#/data/createListing";
import { notify } from "#/lib/notify";
import { AddSpaceModal } from "#/components/deals/AddSpaceModal";
import { StatusPill } from "#/components/deals/DealStageBadge";
import { DealStageSelect } from "#/components/deals/DealStageSelect";
import { formatMonthYear } from "#/components/deals/dealDisplay";

export const Route = createFileRoute("/_shell/listings/$listingId/spaces")({
  component: SpacesTab,
});

/**
 * What a directory row shows for its status.
 *
 * A suite with a running deal gets the stage control itself — the same
 * `DealStageSelect` mounted in this building's page header and in the space
 * deal's own header — so a stage is not just read the same way down the whole
 * tree, it is *changed* the same way, through the same gate. A broker working
 * lease-up moves a suite from the directory without opening it.
 *
 * A suite with no deal has no stage to pick, so occupancy stays a muted, dot-less
 * pill: it is a fact about the asset, not a position on the ladder.
 */
function SuiteStatusControl({ row }: { row: SuiteRow }) {
  const deal = row.dealId ? getListing(row.dealId) : null;
  if (!deal) {
    return (
      // 14px, not the pill's 12px default: this sits in the same column as the
      // stage control on the deal rows above, and those read at body size.
      <StatusPill color="var(--stage-inactive)" dot={false} fontSize={14}>
        {row.status}
      </StatusPill>
    );
  }
  return (
    // The row itself is a Link to the space, so a click meant for the stage
    // control must not also navigate. Same guard `DealCard` puts around its
    // action slot. The menu renders in a portal, so item clicks never reach here.
    <span
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <DealStageSelect listing={deal} />
    </span>
  );
}

function SuiteTenant({ row, shellId }: { row: SuiteRow; shellId: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(row.tenantName ?? "");

  const commit = () => {
    const next = value.trim();
    const shell = getListing(shellId);
    const rows = shell?.marketing.spaceLeaseTerms ?? [];
    const existing = rows.find((t) => t.unitId === row.unitId);
    // Nothing to do when the trimmed value matches what's already on record —
    // opening the editor and blurring without typing must not write to the
    // store or claim a save happened. A genuine change (including clearing a
    // real override to blank, which reads as "" here too) still falls through.
    //
    // `row.tenantName` is the *resolved* value (override, else the unit's own
    // fact), so comparing a blank against it isn't enough: blanking a row whose
    // name comes only from the unit's own fact — no shell override present —
    // would look like a change even though there is nothing to clear, writing
    // an identical array and toasting a save that never happened.
    const noOverrideToClear = next === "" && !existing;
    if (next === (row.tenantName ?? "") || noOverrideToClear) {
      setEditing(false);
      return;
    }
    if (!shell) return;
    // A blank override is removed rather than stored, so the shell never
    // accumulates rows holding nothing and the row falls back to the unit's own
    // tenant name. This is the only way a shell reacquires space terms, and it
    // holds exactly one field's worth.
    const withoutUnit = rows.filter((t) => t.unitId !== row.unitId);
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
        onClick={() => {
          // Seed from the current display value rather than trusting mount-time
          // state: `row.tenantName` can change (e.g. a clear falling back to the
          // unit's own name) while this component stays mounted at the same
          // list position, and re-seeding only on open — not on every prop
          // change — avoids fighting in-progress typing.
          setValue(row.tenantName ?? "");
          setEditing(true);
        }}
      >
        {row.tenantName ?? "Add tenant name"}
        {row.leaseExpiration ? ` · thru ${formatMonthYear(row.leaseExpiration)}` : ""}
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

/**
 * A group heading inside the directory. Every group is a subset of one section,
 * so they sit one step below its "Spaces" heading rather than beside it, and the
 * rows below sit one step below them again: 20 → 17 → 14. Body colour, not muted
 * — muted would read as disabled rather than subordinate.
 *
 * `fs-large` and not `fs-7`: this theme's numeric scale stops at `fs-6` (20px)
 * and continues as named steps — `fs-large` 17, `fs-body` 14 (the default the
 * rows already inherit), `fs-small` 12. `fs-7` silently does nothing.
 */
const GROUP_HEADING = "fs-large fw-semibold mb-2";

function SuiteRowItem({
  row,
  listingId,
  canAddSpace,
  onStartDeal,
}: {
  row: SuiteRow;
  listingId: string;
  canAddSpace: boolean;
  onStartDeal: (unitId: string) => void;
}) {
  const shared = (
    <>
      <span className="fw-semibold">{row.label}</span>
      <span className="text-muted">{row.sqft.toLocaleString()} SF</span>
      <span className="text-muted">
        {row.leaseRate != null ? `$${row.leaseRate} ${row.leaseRateUnits}` : ""}
      </span>
      <span className="ms-auto d-flex align-items-center gap-3">
        <SuiteStatusControl row={row} />
      </span>
    </>
  );

  // A suite with a deal is a link to that deal's page. A suite without one is
  // not — there is nowhere to go, so the row carries whatever action it does
  // support instead.
  if (row.dealId) {
    return (
      <Link
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
    <div className="d-flex align-items-center gap-3 border rounded p-3">
      {shared}
      {row.status === "Occupied" ? (
        <SuiteTenant row={row} shellId={listingId} />
      ) : (
        canAddSpace && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onStartDeal(row.unitId)}
          >
            Start a deal
          </Button>
        )
      )}
    </div>
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
  const { deals, available, occupied } = groupSuites(rows);
  // Empty groups are dropped rather than rendered as a bare heading, so a
  // building with nothing vacant simply has no "Available spaces" — and the
  // top-margin rule below stays right whichever section happens to lead.
  const sections = [
    { title: "Active deals", rows: deals },
    { title: "Available spaces", rows: available },
    { title: "Occupied spaces", rows: occupied },
  ].filter((section) => section.rows.length > 0);
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
        sections.map((section, i) => (
          <div key={section.title} className={i > 0 ? "mt-4" : undefined}>
            <h3 className={GROUP_HEADING}>{section.title}</h3>
            <div className="d-flex flex-column gap-2">
              {section.rows.map((row) => (
                <SuiteRowItem
                  key={row.unitId}
                  row={row}
                  listingId={listingId}
                  canAddSpace={canAddSpace}
                  onStartDeal={startDeal}
                />
              ))}
            </div>
          </div>
        ))
      )}

      <AddSpaceModal
        parentDealId={listingId}
        open={addOpen}
        onOpenChange={setAddOpen}
      />
    </div>
  );
}
