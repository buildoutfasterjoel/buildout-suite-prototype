import { useNavigate } from "@tanstack/react-router";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLink } from "@fortawesome/pro-regular-svg-icons";
import type { Listing, PropertyStatus } from "#/data/types";
import { getListing, getProperty } from "#/data/store";
import { TYPE_LABELS, formatPrice } from "#/components/properties/propertyDisplay";
import { SIDE_DISPLAY } from "#/components/contacts/contactDisplay";
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
 * chrome). One card per *property* — a property with several of the contact's
 * deals still shows a single card. Clicking the card navigates to the property.
 *
 * The deal chip adapts to the deal count:
 * - one deal → a stage-colored "Deal" badge linking to that deal, plus the
 *   deal's Buyer/Seller badge;
 * - multiple deals → a grey "Multiple Deals" badge (Buyer/Seller hidden, since
 *   sides can differ) that opens the Deals page filtered to this address.
 */
export function ContactPropertyCard({
  propertyId,
  listingIds,
}: {
  propertyId: string;
  listingIds: string[];
}) {
  const navigate = useNavigate();
  const property = getProperty(propertyId);
  if (!property) return null;

  const listings = listingIds
    .map((id) => getListing(id))
    .filter((l): l is Listing => !!l);
  const multiple = listings.length > 1;
  const single = listings[0];

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

  const hasActiveDeal = !!single && ACTIVE_DEAL_STATUSES.has(single.status);
  const grey = STAGE_CHIP_COLORS.inactive;

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
        {multiple ? (
          <button
            type="button"
            className="badge border d-inline-flex align-items-center gap-1"
            style={{
              backgroundColor: grey.bg,
              borderColor: grey.border,
              color: grey.text,
            }}
            aria-label={`See all ${listings.length} deals on ${property.name}`}
            onClick={(e) => {
              e.stopPropagation();
              void navigate({ to: "/listings", search: { q: property.street } });
            }}
          >
            <FontAwesomeIcon icon={faLink} />
            Multiple Deals
          </button>
        ) : (
          single && (
            <>
              {hasActiveDeal && (
                <button
                  type="button"
                  className="badge border d-inline-flex align-items-center gap-1"
                  style={{
                    backgroundColor: STAGE_CHIP_COLORS[single.status].bg,
                    borderColor: STAGE_CHIP_COLORS[single.status].border,
                    color: STAGE_CHIP_COLORS[single.status].text,
                  }}
                  aria-label={`Open the ${STATUS_LABELS[single.status]} deal`}
                  onClick={(e) => {
                    e.stopPropagation();
                    void navigate({
                      to: "/listings/$listingId",
                      params: { listingId: single.id },
                    });
                  }}
                >
                  <FontAwesomeIcon icon={faLink} />
                  Deal
                </button>
              )}
              <Badge
                variant="secondary"
                appearance="muted"
                style={{ backgroundColor: "#eceef2" }}
              >
                {SIDE_DISPLAY[single.dealSide].label}
              </Badge>
            </>
          )
        )}
      </div>
    </div>
  );
}
