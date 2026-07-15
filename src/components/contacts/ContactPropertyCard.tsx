import { useNavigate } from "@tanstack/react-router";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLink } from "@fortawesome/pro-regular-svg-icons";
import type { PropertyStatus } from "#/data/types";
import { getListing, getProperty } from "#/data/store";
import { TYPE_LABELS, formatPrice } from "#/components/properties/propertyDisplay";
import {
  SIDE_DISPLAY,
  SIDE_BADGE_COLORS,
} from "#/components/contacts/contactDisplay";
import { STAGE_CHIP_COLORS } from "#/components/deals/DealStageChip";
import { STATUS_LABELS } from "#/components/properties/propertyDisplay";
import { shouldIgnoreRowClick } from "#/components/contacts/rowClick";

/** Deal statuses that still count as an "active" (open) deal on the property. */
const ACTIVE_DEAL_STATUSES = new Set<PropertyStatus>([
  "proposal",
  "active",
  "under-contract",
]);

/**
 * A property the contact owns, rendered as a card (reusing the deal card's
 * chrome). When there's an active deal on the property, a stage-colored "Deal"
 * badge links to that deal; clicking the card navigates to the property.
 *
 * Property data is deal-derived (one card per linked deal), so `listingId`
 * identifies both the deal and — via its property — the owned property.
 */
export function ContactPropertyCard({ listingId }: { listingId: string }) {
  const navigate = useNavigate();
  const listing = getListing(listingId);
  const property = listing ? getProperty(listing.propertyId) : undefined;
  if (!listing || !property) return null;

  const meta = [
    formatPrice(property.askingPrice),
    TYPE_LABELS[property.propertyType],
    `${property.buildingSqFt.toLocaleString()} SF`,
    property.residentialUnits != null
      ? `${property.residentialUnits} Units`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const side = SIDE_DISPLAY[listing.dealSide];
  const hasActiveDeal = ACTIVE_DEAL_STATUSES.has(listing.status);
  const sc = STAGE_CHIP_COLORS[listing.status];

  return (
    <div
      className="contact-deal-card position-relative bg-card border d-flex flex-column gap-2 p-3"
      onClick={(e) => {
        if (shouldIgnoreRowClick(e)) return;
        void navigate({
          to: "/properties/$propertyId",
          params: { propertyId: property.id },
        });
      }}
    >
      <div>
        <div
          className="fw-semibold"
          style={{ fontSize: 17, lineHeight: "26px" }}
        >
          {property.name}
        </div>
        <div className="text-muted" style={{ fontSize: 14, lineHeight: "19px" }}>
          {meta}
        </div>
      </div>
      <div className="d-flex flex-wrap align-items-center gap-2">
        <Badge
          variant="secondary"
          appearance="muted"
          style={{ backgroundColor: "#eceef2" }}
        >
          Owner
        </Badge>
        {hasActiveDeal && (
          <button
            type="button"
            className="badge border d-inline-flex align-items-center gap-1"
            style={{
              backgroundColor: sc.bg,
              borderColor: sc.border,
              color: sc.text,
            }}
            aria-label={`Open the ${STATUS_LABELS[listing.status]} deal`}
            onClick={(e) => {
              e.stopPropagation();
              void navigate({
                to: "/listings/$listingId",
                params: { listingId },
              });
            }}
          >
            <FontAwesomeIcon icon={faLink} />
            Deal
          </button>
        )}
        <Badge
          variant="secondary"
          style={{
            backgroundColor: SIDE_BADGE_COLORS[listing.dealSide].bg,
            color: SIDE_BADGE_COLORS[listing.dealSide].text,
          }}
        >
          {side.label}
        </Badge>
      </div>
    </div>
  );
}
