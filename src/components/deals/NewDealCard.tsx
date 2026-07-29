import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faShareNodes } from "@fortawesome/pro-regular-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import type { Listing, PropertyStatus } from "#/data/types";
import { getProperty } from "#/data/store";
import {
  TYPE_ICONS,
  TYPE_LABELS,
  getPhotoUrl,
  formatPrice,
} from "#/components/properties/propertyDisplay";
import { dealHeadlineLabel } from "#/components/deals/dealDisplay";
import { NewDealStageChip } from "#/components/deals/NewDealStageChip";
import { CardBadge, BadgeDivider } from "#/components/deals/DealCardBadges";
import {
  relationshipBadge,
  relationshipTooltip,
  sideBadge,
  type DealRelationship,
} from "#/components/deals/newCardTokens";

/** "Aug 4" — the same short form the board card uses for a critical date. */
function shortDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/** The card's single call to action, when the stage offers one. */
export interface DealCardAction {
  icon: IconDefinition;
  label: string;
  /** Trailing count badge (the Leads count); omit for none. */
  count?: number;
  onClick: () => void;
}

/**
 * The redesigned deal card (Figma `deal-tile`). One component, two variants:
 *
 * - `contact` — on a contact's record. Shows the property photo, the contact's
 *   relationship to the deal, the stage chip, and up to one CTA.
 * - `board` — on the pipeline's kanban. Drops the photo, relationship badge,
 *   stage chip (the column *is* the stage) and CTA, steps the title down from
 *   17px to 14px, and adds a share count when the deal isn't yours alone.
 *
 * Nearly every value on the card is a number without a unit, so the things that
 * need explaining carry tooltips: the type glyph, both meta figures, the
 * relationship badge, and the gross.
 */
export function NewDealCard({
  listing,
  variant = "contact",
  relationship,
  contactName,
  inquiredOn,
  action,
  shareCount,
  onStageChange,
}: {
  listing: Listing;
  variant?: "contact" | "board";
  /** Contact variant: how the contact on this page relates to the deal. */
  relationship?: DealRelationship;
  contactName?: string;
  /** Formatted inquiry date, for the "Inquired" badge's tooltip. */
  inquiredOn?: string | null;
  action?: DealCardAction | null;
  /** Board variant: how many people can see the deal (badge shown when > 1). */
  shareCount?: number;
  onStageChange?: (next: PropertyStatus) => void;
}) {
  const board = variant === "board";
  const property = getProperty(listing.propertyId);
  const typeIcon = property ? TYPE_ICONS[property.propertyType] : null;
  const typeLabel = property ? TYPE_LABELS[property.propertyType] : "";
  const side = sideBadge(listing.dealSide, listing.dealType);
  const critical = shortDate(listing.transaction.nextCriticalDate);
  // The critical date is the next open task's due date, so name that milestone —
  // "Aug 4" alone doesn't say what happens on Aug 4.
  const criticalTask = listing.tasks.find(
    (t) => t.status !== "complete" && t.date,
  );
  // The deal-level commission the brokerage earns. The Financials tab splits it
  // per broker; the card shows the whole number.
  const gross = listing.transaction.commissionAmount;
  const rel = relationship ? relationshipBadge(relationship) : null;
  // A lost deal recedes: grey fill, no lift — it's history sitting in the
  // pipeline, not something to act on.
  const lost = listing.status === "inactive";

  return (
    <div
      className={`deal-tile${board ? " deal-tile--board" : ""}${
        lost ? " deal-tile--lost bg-storm-grey-100" : ""
      }`}
    >
      <div className="deal-tile__main">
        <div className="deal-tile__top">
          <div className="deal-tile__headings">
            <div className="deal-tile__title-row">
              {typeIcon && (
                <Tooltip>
                  <Tooltip.Trigger
                    render={
                      <span className="deal-tile__type-icon">
                        <FontAwesomeIcon icon={typeIcon} />
                      </span>
                    }
                  />
                  <Tooltip.Content>{typeLabel}</Tooltip.Content>
                </Tooltip>
              )}
              <span className="deal-tile__title" title={listing.name}>
                {listing.name}
              </span>
            </div>
            <div className="deal-tile__meta">
              <Tooltip>
                <Tooltip.Trigger
                  render={<span>{dealHeadlineLabel(listing)}</span>}
                />
                <Tooltip.Content>Transaction Value</Tooltip.Content>
              </Tooltip>
              {critical && (
                <>
                  <span className="deal-tile__meta-sep">•</span>
                  <Tooltip>
                    <Tooltip.Trigger render={<span>{critical}</span>} />
                    <Tooltip.Content>
                      {criticalTask
                        ? `Next critical date · ${criticalTask.label}`
                        : "Next critical date"}
                    </Tooltip.Content>
                  </Tooltip>
                </>
              )}
            </div>
          </div>
          {!board && (
            <img
              src={getPhotoUrl(listing.id)}
              alt=""
              className="deal-tile__photo"
            />
          )}
        </div>

        <div className="deal-tile__badges">
          <div className="deal-tile__badges-main">
            {rel && relationship && (
              <>
                <CardBadge
                  icon={rel.icon}
                  label={rel.label}
                  bg={rel.bg}
                  color={rel.color}
                  tooltip={relationshipTooltip(
                    relationship,
                    contactName ?? "This contact",
                    inquiredOn ?? null,
                  )}
                />
                <BadgeDivider />
              </>
            )}
            <CardBadge
              icon={side.icon}
              label={side.label}
              bg={side.bg}
              color={side.color}
              tooltip={side.tooltip}
            />
            {!board && onStageChange && (
              <NewDealStageChip value={listing.status} onChange={onStageChange} />
            )}
            {board && shareCount != null && shareCount > 1 && (
              <CardBadge
                icon={faShareNodes}
                label={shareCount}
                bg="#eceef2"
                color="#22262f"
                tooltip={`${shareCount} people have access`}
              />
            )}
          </div>
          {gross > 0 && (
            <Tooltip>
              <Tooltip.Trigger
                render={
                  <span className="deal-tile__gross">{formatPrice(gross)}</span>
                }
              />
              <Tooltip.Content>Broker gross commission</Tooltip.Content>
            </Tooltip>
          )}
        </div>
      </div>

      {!board && action && (
        <button
          type="button"
          className="deal-tile__cta"
          onClick={(e) => {
            e.stopPropagation();
            action.onClick();
          }}
        >
          <FontAwesomeIcon icon={action.icon} />
          {action.label}
          {action.count != null && (
            <span
              className="deal-tile__badge"
              style={{ backgroundColor: "#eceef2", color: "#22262f" }}
            >
              {action.count}
            </span>
          )}
        </button>
      )}
    </div>
  );
}
