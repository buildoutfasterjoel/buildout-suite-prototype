import { Link } from "@tanstack/react-router";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBuildingCircleArrowRight,
  faCircleCheck,
} from "@fortawesome/pro-regular-svg-icons";
import type { Property } from "#/data/types";
import { DealStageBadge } from "#/components/deals/NewDealStageChip";
import { TYPE_LABELS, formatSqFt, getPhotoUrl } from "./propertyDisplay";

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
}: {
  property: Property;
  mode: "owned" | "prospect";
  selected: boolean;
  onSelect: () => void;
  /** Prospect mode only — add this record to the company database. */
  onAdd?: () => void;
  /** Prospect mode only — the record has already been added. */
  inDatabase?: boolean;
}) {
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
      className={`bg-card border rounded d-flex align-items-stretch w-100 text-start${
        selected ? " border-primary" : ""
      }`}
      style={{ gap: 12, padding: 12, cursor: "pointer" }}
    >
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
        {mode === "owned" && property.status && (
          <div className="mt-1">
            <DealStageBadge value={property.status} />
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
  );
}
