import { Link, useNavigate } from "@tanstack/react-router";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBuildingCircleArrowRight,
  faCircleCheck,
} from "@fortawesome/pro-regular-svg-icons";
import type { Property } from "#/data/types";
import type { SpaceRow } from "#/data/propertySpaces";
import { spaceAssetLink } from "#/components/deals/dealCardLink";
import { DealStageBadge } from "#/components/deals/NewDealStageChip";
import { TYPE_LABELS, formatSqFt, getPhotoUrl } from "./propertyDisplay";
import {
  formatAvailabilityHeadline,
  propertyAvailability,
} from "#/data/propertySpaces";

/** How many matching spaces a row unfolds before handing off to the Spaces tab. */
const MAX_UNFOLDED_SPACES = 6;

/** "Retail • Multi-Tenant • 10,716 SF" — the meta line under the address. */
function metaLine(property: Property): string {
  const size =
    property.propertyType === "land"
      ? `${(property.lotSqFt / 43560).toFixed(2)} Acres`
      : property.buildingSqFt > 0
        ? formatSqFt(property.buildingSqFt)
        : null;
  return [TYPE_LABELS[property.propertyType], property.propertySubtype, size]
    .filter(Boolean)
    .join(" • ");
}

/**
 * One property in the left-hand results rail — the shared row for both modes.
 *
 * The two modes differ only in the trailing control: your own properties carry
 * their deal stage, a prospect carries the Add Property action (or, once added,
 * a settled "in your database" check).
 */
export function PropertyListRow({
  property,
  mode,
  selected,
  onSelect,
  onAdd,
  inDatabase = false,
  matchedSpaces,
}: {
  property: Property;
  mode: "owned" | "prospect";
  selected: boolean;
  onSelect: () => void;
  /** Prospect mode only — add this record to the company database. */
  onAdd?: () => void;
  /** Prospect mode only — the record has already been added. */
  inDatabase?: boolean;
  /**
   * The spaces that satisfy the active space-level facets, when any is set.
   * The row unfolds exactly these — "2 of 6 spaces match" — so a filter that
   * describes suites shows the suites it found, on the row, rather than
   * surfacing the building and leaving the reader to guess. Empty otherwise.
   */
  matchedSpaces?: SpaceRow[];
}) {
  const navigate = useNavigate();
  // Your own record only: a prospect has no deals, so nothing to derive from.
  const availability =
    mode === "owned" ? propertyAvailability(property.id) : null;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      aria-pressed={selected}
      className={`bg-card border rounded d-flex flex-column w-100 text-start${
        selected ? " border-primary" : ""
      }`}
      style={{ padding: 12, cursor: "pointer" }}
    >
      <div className="d-flex align-items-stretch" style={{ gap: 12 }}>
        <div className="d-flex flex-column flex-grow-1" style={{ minWidth: 0 }}>
          <div className="fw-semibold text-truncate" style={{ fontSize: 14 }}>
            {property.street || property.name}
          </div>
          <div className="text-muted text-truncate" style={{ fontSize: 12 }}>
            {property.city}, {property.state} {property.zip}
          </div>
          {/* Under the address, not trailing the meta line: the meta line's
            length varies per record, so a badge appended to it landed at a
            different x on every row. Anchored here it forms a clean column.
            No deal means no stage — the slot is simply absent, not "none". */}
          {/* Stage badge and, inline to its right, the space availability headline
            the record's header carries — "Available · 1 of 6 spaces". Text only:
            a second coloured dot beside the stage chip's competed with it. Either
            can be absent (no deal / no spaces); the row is there when one is. */}
          {mode === "owned" && (property.status || availability) && (
            <div className="mt-1 d-flex align-items-center gap-2 flex-wrap">
              {property.status && <DealStageBadge value={property.status} />}
              {availability && (
                <span
                  className="text-muted text-nowrap"
                  style={{ fontSize: 12 }}
                >
                  {formatAvailabilityHeadline(availability)}
                </span>
              )}
            </div>
          )}
          <div
            className="text-muted text-truncate mt-auto pt-3"
            style={{ fontSize: 12 }}
          >
            {metaLine(property)}
          </div>
        </div>

        <img
          src={getPhotoUrl(property.id, 320, 200)}
          alt=""
          className="flex-shrink-0"
          style={{
            width: 160,
            height: 96,
            objectFit: "cover",
            borderRadius: 4,
            display: "block",
          }}
        />

        {mode === "prospect" && (
          // Fixed width so swapping the Add button for the "Added" badge doesn't
          // reflow the row under the pointer that just clicked it.
          <div
            className="d-flex flex-column align-items-center justify-content-center gap-2 flex-shrink-0"
            style={{ width: 76 }}
          >
            {inDatabase ? (
              <>
                <Badge
                  variant="secondary"
                  appearance="muted"
                  className="d-inline-flex align-items-center gap-1"
                >
                  <FontAwesomeIcon icon={faCircleCheck} />
                  Added
                </Badge>
                {/* The record is yours now, so the useful next move is opening
                  it — the row itself still opens the prospect flyout. */}
                <Button
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  onClick={(e) => e.stopPropagation()}
                  render={
                    <Link
                      to="/properties/$propertyId"
                      params={{ propertyId: property.id }}
                    />
                  }
                >
                  View
                </Button>
              </>
            ) : (
              <Tooltip>
                <Tooltip.Trigger
                  render={
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label={`Add ${property.street || property.name} to your properties`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onAdd?.();
                      }}
                    >
                      <FontAwesomeIcon icon={faBuildingCircleArrowRight} />
                    </Button>
                  }
                />
                <Tooltip.Content>Add Property</Tooltip.Content>
              </Tooltip>
            )}
          </div>
        )}
      </div>
      {/* Below the whole top row, not inside the text column: spanning the
          card's full width is what gives the space lines room for two columns
          beside a 160px photo. */}
      {matchedSpaces && matchedSpaces.length > 0 && availability && (
        <div className="mt-2 pt-2 border-top" style={{ fontSize: 12 }}>
          <div className="text-muted mb-1">
            {matchedSpaces.length} of {availability.spaceCount}{" "}
            {availability.spaceCount === 1 ? "space" : "spaces"}{" "}
            {matchedSpaces.length === 1 ? "matches" : "match"}
          </div>
          {/* Left-aligned, read down the columns, each line a taller hit
              target. Plain buttons rather than `.btn-link`: `.btn` centres its
              content, which read as a ragged indent down the list. Status
              stays a trailing word: a coloured dot per line and a fixed label
              column were tried and read as noise and gaps, not clarity.
              Capped at six so a 24-suite tower doesn't become the page; the
              rest are one click away on the Spaces tab. */}
          <div className="property-row__spaces">
            {matchedSpaces.slice(0, MAX_UNFOLDED_SPACES).map((s) => (
              // Each line opens the space's own page. Stopped before the row,
              // whose click opens the property.
              <button
                key={s.unitId}
                type="button"
                className="property-row__space"
                onClick={(e) => {
                  e.stopPropagation();
                  void navigate(spaceAssetLink(property.id, s.unitId));
                }}
              >
                <span className="fw-semibold text-nowrap">{s.label}</span>
                <span className="text-muted text-truncate property-row__space-meta">
                  {[s.floor != null ? `Fl ${s.floor}` : null, formatSqFt(s.sqft), s.status]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </button>
            ))}
          </div>
          {matchedSpaces.length > MAX_UNFOLDED_SPACES && (
            // Its own line under the columns, not a seventh item dangling in
            // one of them.
            <Link
              to="/properties/$propertyId/spaces"
              params={{ propertyId: property.id }}
              className="property-row__space text-primary text-decoration-none"
              onClick={(e) => e.stopPropagation()}
            >
              and {matchedSpaces.length - MAX_UNFOLDED_SPACES} more
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
