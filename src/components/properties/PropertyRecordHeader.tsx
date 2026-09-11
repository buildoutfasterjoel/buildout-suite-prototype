import { Link } from "@tanstack/react-router";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Breadcrumb } from "@buildoutinc/blueprint-react/ui/Breadcrumb";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBuilding, faHandshake, faPencil, faPlus } from "@fortawesome/pro-regular-svg-icons";
import type { Listing, Property } from "#/data/types";
import { dealCardLinkProps } from "#/components/deals/dealCardLink";
import {
  formatAvailabilityBreakdown,
  formatAvailabilityHeadline,
  type PropertyAvailability,
} from "#/data/propertySpaces";
import { useCreateDeal } from "#/data/useCreateDeal";
import { TYPE_ICONS, TYPE_LABELS, STATUS_LABELS, getPhotoUrl } from "./propertyDisplay";
import { SpaceStatusDot } from "./SpaceStatusDot";

/**
 * The Property record's top rail — the same three-column shape as the deal
 * page's `PropertyDetailHeader` (thumbnail · identity · actions) so a property
 * and a deal read as the same kind of page.
 *
 * Not to be confused with `PropertyDetailHeader`, which is the *deal* page's
 * header despite its name.
 *
 * The badge row carries two different facts side by side and must not blur
 * them: `property.status` is the stage of the deal on the property (absent when
 * there is none), and the availability headline is derived from the spaces
 * (absent when there are none). A property with neither shows just its type.
 */
export function PropertyRecordHeader({
  property,
  deals,
  availability,
  sectionLabel,
}: {
  property: Property;
  /** Every deal on the property; the header looks for the building's own. */
  deals: Listing[];
  /** From `propertyAvailability`; null when the property has no spaces. */
  availability: PropertyAvailability | null;
  /** The current section's label, or null on the record's root. */
  sectionLabel: string | null;
}) {
  // The building's deal, if it has one: a top-level deal (a space deal is the
  // suite's, not the building's). A live one first, so a building whose old
  // deal was lost and which has a new one open links to the new one.
  const buildingDeals = deals.filter((d) => d.parentDealId == null);
  const buildingDeal =
    buildingDeals.find((d) => d.status !== "inactive" && d.status !== "closed") ?? buildingDeals[0] ?? null;
  const address = [property.street, property.city, property.state, property.zip]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="bg-card border-bottom">
      <div className="container p-4">
        <div className="d-flex align-items-center gap-3">
          <div className="flex-shrink-0 d-none d-sm-block align-self-stretch" style={{ width: 164 }}>
            <img
              src={getPhotoUrl(property.id, 328, 200)}
              alt={property.name}
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
                  {sectionLabel ? (
                    <Breadcrumb.Link
                      render={<Link to="/properties/$propertyId" params={{ propertyId: property.id }} />}
                    >
                      {property.name}
                    </Breadcrumb.Link>
                  ) : (
                    <Breadcrumb.Page>{property.name}</Breadcrumb.Page>
                  )}
                </Breadcrumb.Item>
                {sectionLabel && (
                  <>
                    <Breadcrumb.Separator />
                    <Breadcrumb.Item>
                      <Breadcrumb.Page>{sectionLabel}</Breadcrumb.Page>
                    </Breadcrumb.Item>
                  </>
                )}
              </Breadcrumb.List>
            </Breadcrumb>
            <h1 className="fs-5 fw-semibold mb-0 text-truncate" title={property.name}>
              {property.name}
            </h1>
            <div className="text-muted text-truncate">{address}</div>
            <div className="d-flex align-items-center gap-2 mt-2 flex-wrap">
              <Badge variant="secondary" appearance="muted">
                <FontAwesomeIcon icon={TYPE_ICONS[property.propertyType]} />
                {TYPE_LABELS[property.propertyType]}
              </Badge>
              {/* A property with no deal shows no stage — the Create Deal button
                  to the right is the thing that would give it one. */}
              {property.status && (
                <Badge variant="secondary" appearance="muted">
                  {STATUS_LABELS[property.status]}
                </Badge>
              )}
              {/* The headline alone — no segmented bar up here; the full
                  breakdown the bar carried is on hover instead. The bar still
                  draws on the Spaces tab's strip and the space page's property card. */}
              {availability && (
                <Tooltip>
                  <Tooltip.Trigger
                    render={
                      <span className="ms-1" style={{ cursor: "help" }} tabIndex={0}>
                        <SpaceStatusDot status={availability.headline} className="fw-semibold">
                          {formatAvailabilityHeadline(availability)}
                        </SpaceStatusDot>
                      </span>
                    }
                  />
                  <Tooltip.Content>{formatAvailabilityBreakdown(availability)}</Tooltip.Content>
                </Tooltip>
              )}
            </div>
          </div>

          <div className="d-flex align-items-center gap-2 flex-shrink-0">
            {/* Edit is a placeholder for now — the property form isn't wired.
                Named on the button, not the tooltip, for screen readers. */}
            <Tooltip>
              <Tooltip.Trigger
                render={
                  <Button variant="ghost" size="icon" aria-label="Edit property">
                    <FontAwesomeIcon icon={faPencil} />
                  </Button>
                }
              />
              <Tooltip.Content>Edit property</Tooltip.Content>
            </Tooltip>
            {/* One building, one deal: once it has one, the way in is the way to
                it, not a second Create. */}
            {buildingDeal ? (
              <Button variant="secondary" nativeButton={false} render={<Link {...dealCardLinkProps(buildingDeal)} />}>
                <FontAwesomeIcon icon={faHandshake} />
                View Deal
              </Button>
            ) : (
              <Button variant="primary" onClick={() => useCreateDeal.getState().openFor({ property })}>
                <FontAwesomeIcon icon={faPlus} />
                Create Deal
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
