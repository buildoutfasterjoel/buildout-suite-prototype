import { Link, useNavigate } from "@tanstack/react-router";
import { Table } from "@buildoutinc/blueprint-react/ui/Table";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLock } from "@fortawesome/pro-regular-svg-icons";
import type { SpaceRow } from "#/data/propertySpaces";
import { getListing } from "#/data/store";
import { DealStageBadge } from "#/components/deals/NewDealStageChip";
import { dealCardLinkProps, spaceAssetLink } from "#/components/deals/dealCardLink";
import { useOpenableSpaces } from "#/components/deals/useDealAccess";
import { formatSqFt } from "./propertyDisplay";
import { formatAskingRent, UNIT_TYPE_LABELS } from "./propertySpaceDisplay";
import { SpaceStatusDot } from "./SpaceStatusDot";

/** Em dash for an empty cell — the Contacts table convention. */
function Dash() {
  return <span className="text-muted">—</span>;
}

/**
 * The deal working this space, with its own stage. A deal this viewer may not
 * open renders the stage and a lock with no link — the same rule the deal
 * directory's locked row follows: you may know a suite is under contract, that
 * is the building's business, but you may not go there.
 */
function LinkedDealCell({ row }: { row: SpaceRow }) {
  // Hooks run unconditionally; an empty shell id resolves to an empty set.
  const openable = useOpenableSpaces(row.shellId ?? "");
  if (!row.dealId) return <Dash />;
  const deal = getListing(row.dealId);
  if (!deal) return <Dash />;
  // The same outlined stage chip the Properties index uses for a building's deal.
  const badge = <DealStageBadge value={deal.status} shape="space" />;
  if (!openable.has(deal.id)) {
    return (
      <span className="d-inline-flex align-items-center gap-2 text-muted">
        {badge}
        <FontAwesomeIcon icon={faLock} aria-label="You don't have access to this deal" />
      </span>
    );
  }
  return (
    // The row itself navigates to the space's asset page, so a click meant for
    // the deal link must not also fire the row. Same guard the deal directory
    // puts around its stage control.
    <Link
      {...dealCardLinkProps(deal)}
      className="d-inline-flex align-items-center gap-2 text-decoration-none"
      onClick={(e) => e.stopPropagation()}
    >
      {badge}
      <span>Deal #{deal.dealId}</span>
    </Link>
  );
}

/**
 * Every space on the property, one row each, in the order `propertySpaces`
 * fixed (headline status → floor → label). A table because the values are read
 * down a column — size against size, rent against rent — which is the
 * repeater-becomes-a-table test.
 */
export function SpacesRoster({ rows, propertyId }: { rows: SpaceRow[]; propertyId: string }) {
  const navigate = useNavigate();
  const open = (row: SpaceRow) => void navigate(spaceAssetLink(propertyId, row.unitId));

  return (
    <Table>
      <Table.Header>
        <Table.Row>
          <Table.Head>Space</Table.Head>
          <Table.Head>Floor</Table.Head>
          <Table.Head className="text-end">Size (SF)</Table.Head>
          <Table.Head>Type</Table.Head>
          <Table.Head>Status</Table.Head>
          <Table.Head>Asking rent</Table.Head>
          <Table.Head>Linked deal</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {rows.map((row) => {
          const rent = formatAskingRent(row.leaseRate, row.leaseRateUnits);
          return (
            <Table.Row
              key={row.unitId}
              role="link"
              tabIndex={0}
              style={{ cursor: "pointer" }}
              onClick={() => open(row)}
              onKeyDown={(e) => {
                if (e.key === "Enter") open(row);
              }}
            >
              <Table.Cell>
                <div className="fw-semibold text-nowrap">{row.label}</div>
                {/* Only when the label does not already carry the suite number —
                    "Suite 300" over "Suite 300" says nothing; "The Corner Suite"
                    over "Suite 300" does. */}
                {row.suite && !row.label.includes(row.suite) && (
                  <div className="text-muted fs-small">Suite {row.suite}</div>
                )}
              </Table.Cell>
              <Table.Cell>{row.floor ?? <Dash />}</Table.Cell>
              <Table.Cell className="text-end">{formatSqFt(row.sqft)}</Table.Cell>
              <Table.Cell>{UNIT_TYPE_LABELS[row.unitType]}</Table.Cell>
              <Table.Cell>
                <SpaceStatusDot status={row.status} />
              </Table.Cell>
              <Table.Cell>{rent ?? <Dash />}</Table.Cell>
              <Table.Cell>
                <LinkedDealCell row={row} />
              </Table.Cell>
            </Table.Row>
          );
        })}
      </Table.Body>
    </Table>
  );
}
