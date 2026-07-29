import { useNavigate } from "@tanstack/react-router";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowUpRightFromSquare } from "@fortawesome/pro-regular-svg-icons";
import { faLink as faLinkSolid } from "@fortawesome/pro-solid-svg-icons";
import type { Listing } from "#/data/types";
import { getListing, getProperty } from "#/data/store";
import {
  TYPE_ICONS,
  TYPE_LABELS,
  STATUS_LABELS,
  formatPrice,
} from "#/components/properties/propertyDisplay";
import { CardBadge, BadgeDivider } from "#/components/deals/DealCardBadges";
import { LINKED_DEAL_ICON, relationshipBadge } from "#/components/deals/newCardTokens";
import { shouldIgnoreRowClick } from "#/components/contacts/rowClick";

/**
 * A property the contact owns, in the redesigned card language: same shell,
 * type glyph, title and badge row as `NewDealCard`, so the two stack together
 * in the overview column without reading as different species.
 *
 * The differences are structural, not stylistic — a property has no stage, no
 * gross and no photo, so its second line carries the physical facts (price ·
 * size · units) and its badge row ends in a link out to the deal(s) on it.
 */
export function NewContactPropertyCard({
  propertyId,
  listingIds,
  contactName,
}: {
  propertyId: string;
  listingIds: string[];
  contactName: string;
}) {
  const navigate = useNavigate();
  const property = getProperty(propertyId);
  if (!property) return null;

  const listings = listingIds
    .map((id) => getListing(id))
    .filter((l): l is Listing => !!l);
  const multiple = listings.length > 1;
  const single = listings[0];
  const owner = relationshipBadge("owner");

  const meta = [
    formatPrice(property.askingPrice),
    `${property.buildingSqFt.toLocaleString()} SF`,
    property.residentialUnits != null
      ? `${property.residentialUnits} Units`
      : null,
  ]
    .filter(Boolean)
    .join(" • ");

  /** The stage-colored "Deal" badge — a button, since it navigates. */
  const dealBadge = (
    label: string,
    iconColor: string,
    ariaLabel: string,
    onClick: () => void,
  ) => (
    <button
      type="button"
      className="deal-tile__badge deal-tile__badge--outline"
      aria-label={ariaLabel}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <FontAwesomeIcon
        icon={faLinkSolid}
        className="deal-tile__badge-icon"
        style={{ color: iconColor }}
      />
      {label}
      <FontAwesomeIcon
        icon={faArrowUpRightFromSquare}
        className="deal-tile__badge-icon"
      />
    </button>
  );

  return (
    <div
      className="deal-tile deal-tile--property"
      onClick={(e) => {
        if (shouldIgnoreRowClick(e)) return;
        void navigate({
          to: "/properties/$propertyId",
          params: { propertyId: property.id },
        });
      }}
    >
      <div className="deal-tile__main">
        {/* No thumbnail here on purpose: with one, a property card and a deal
            card for the same building read as twins in the overview column. The
            missing image is the fastest "this is a property, not a deal" cue. */}
        <div className="deal-tile__headings">
          <div className="deal-tile__title-row">
            <Tooltip>
              <Tooltip.Trigger
                render={
                  <span className="deal-tile__type-icon">
                    <FontAwesomeIcon icon={TYPE_ICONS[property.propertyType]} />
                  </span>
                }
              />
              <Tooltip.Content>
                {TYPE_LABELS[property.propertyType]}
              </Tooltip.Content>
            </Tooltip>
            <span className="deal-tile__title" title={property.name}>
              {property.name}
            </span>
          </div>
          <span className="deal-tile__meta deal-tile__meta--muted">{meta}</span>
        </div>

        {/* Same order as the deal card: the deal link leads, then the divider
            carries the relationship badge (grouped, so a wrap keeps them
            together). With no deal on the property there's nothing to separate,
            so the divider drops out. */}
        <div className="deal-tile__badges-main">
          {multiple
            ? dealBadge(
                "Multiple Deals",
                LINKED_DEAL_ICON.inactive,
                `See all ${listings.length} deals on ${property.name}`,
                () =>
                  void navigate({
                    to: "/listings",
                    search: { q: property.street },
                  }),
              )
            : single &&
              dealBadge(
                "Deal",
                LINKED_DEAL_ICON[single.status],
                `Open the ${STATUS_LABELS[single.status]} deal`,
                () =>
                  void navigate({
                    to: "/listings/$listingId",
                    params: { listingId: single.id },
                  }),
              )}
          <span className="deal-tile__rel-group">
            {(multiple || single) && <BadgeDivider />}
            <CardBadge
              icon={owner.icon}
              label={owner.label}
              bg={owner.bg}
              color={owner.color}
              tooltip={`${contactName} owns the property`}
            />
          </span>
        </div>
      </div>
    </div>
  );
}
