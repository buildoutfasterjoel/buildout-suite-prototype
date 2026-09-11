import { Link } from "@tanstack/react-router";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Breadcrumb } from "@buildoutinc/blueprint-react/ui/Breadcrumb";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBuilding, faHandshake, faPencil } from "@fortawesome/pro-regular-svg-icons";
import type { Listing, Property, PropertyUnit } from "#/data/types";
import type { SpaceRow } from "#/data/propertySpaces";
import { dealCardLinkProps } from "#/components/deals/dealCardLink";
import { formatSqFt, getPhotoUrl } from "./propertyDisplay";
import { UNIT_TYPE_LABELS } from "./propertySpaceDisplay";
import { SpaceStatusDot } from "./SpaceStatusDot";

/**
 * The space asset page's own header. Deliberately not `SpaceDetailHeader`
 * (the deal-side space header): that one is built around a deal's stage, access
 * avatars and publish state, none of which a unit owns. This one says what the
 * space *is* — type, size, availability — and offers the way into its deal.
 *
 * Breadcrumb: Properties / {Property} / {Space}. The property crumb lands on the
 * Spaces tab rather than Overview — it is where this page was reached from and
 * where the sibling spaces are.
 */
export function SpaceRecordHeader({
  property,
  unit,
  row,
  deal,
  dealOpenable,
  onEdit,
  onCreateDeal,
  createDealBlockedReason,
}: {
  property: Property;
  unit: PropertyUnit;
  row: SpaceRow;
  /** The child deal on this space, if any. */
  deal: Listing | null;
  /** Whether this viewer may open `deal`. */
  dealOpenable: boolean;
  onEdit: () => void;
  /** Starts a deal on this space. Omitted until the flow is wired. */
  onCreateDeal?: () => void;
  /** When set, the create button renders disabled with this as its tooltip. */
  createDealBlockedReason?: string | null;
}) {
  const address = [property.street, property.city, property.state, property.zip].filter(Boolean).join(", ");

  return (
    <div className="bg-card border-bottom">
      <div className="container p-4">
        <div className="d-flex align-items-center gap-3">
          <div className="flex-shrink-0 d-none d-sm-block align-self-stretch" style={{ width: 164 }}>
            <img
              src={getPhotoUrl(unit.id, 328, 200)}
              alt={unit.label}
              style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 4, display: "block" }}
            />
          </div>

          <div className="flex-grow-1" style={{ minWidth: 0 }}>
            <Breadcrumb className="mb-1">
              <Breadcrumb.List>
                <Breadcrumb.Item>
                  <Breadcrumb.Link render={<Link to="/properties" />}>
                    <FontAwesomeIcon icon={faBuilding} />
                    Properties
                  </Breadcrumb.Link>
                </Breadcrumb.Item>
                <Breadcrumb.Separator />
                <Breadcrumb.Item>
                  <Breadcrumb.Link
                    render={<Link to="/properties/$propertyId/spaces" params={{ propertyId: property.id }} />}
                  >
                    {property.name}
                  </Breadcrumb.Link>
                </Breadcrumb.Item>
                <Breadcrumb.Separator />
                <Breadcrumb.Item>
                  <Breadcrumb.Page>{unit.label}</Breadcrumb.Page>
                </Breadcrumb.Item>
              </Breadcrumb.List>
            </Breadcrumb>
            <h1 className="fs-5 fw-semibold mb-0 text-truncate" title={unit.label}>
              {unit.label}
            </h1>
            <div className="text-muted text-truncate">{address}</div>
            <div className="d-flex align-items-center gap-2 mt-2 flex-wrap">
              <Badge variant="secondary" appearance="muted">
                {UNIT_TYPE_LABELS[unit.unitType]}
              </Badge>
              <Badge variant="secondary" appearance="muted">
                {formatSqFt(unit.sqft)}
              </Badge>
              <SpaceStatusDot status={row.status} className="fw-semibold ms-1" />
            </div>
          </div>

          <div className="d-flex align-items-center gap-2 flex-shrink-0">
            <Tooltip>
              <Tooltip.Trigger
                render={
                  <Button variant="ghost" size="icon" aria-label="Edit space" onClick={onEdit}>
                    <FontAwesomeIcon icon={faPencil} />
                  </Button>
                }
              />
              <Tooltip.Content>Edit space</Tooltip.Content>
            </Tooltip>

            {deal && dealOpenable ? (
              <Button variant="secondary" nativeButton={false} render={<Link {...dealCardLinkProps(deal)} />}>
                <FontAwesomeIcon icon={faHandshake} />
                View Deal
              </Button>
            ) : !deal && onCreateDeal ? (
              createDealBlockedReason ? (
                <Tooltip>
                  <Tooltip.Trigger
                    render={
                      <span className="d-inline-flex">
                        <Button variant="primary" disabled>
                          <FontAwesomeIcon icon={faHandshake} />
                          Create Deal
                        </Button>
                      </span>
                    }
                  />
                  <Tooltip.Content>{createDealBlockedReason}</Tooltip.Content>
                </Tooltip>
              ) : (
                <Button variant="primary" onClick={onCreateDeal}>
                  <FontAwesomeIcon icon={faHandshake} />
                  Create Deal
                </Button>
              )
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
