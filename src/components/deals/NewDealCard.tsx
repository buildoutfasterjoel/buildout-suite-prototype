import { useNavigate } from "@tanstack/react-router";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faShareNodes, faVectorSquare } from "@fortawesome/pro-regular-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import type { Listing, PropertyStatus } from "#/data/types";
import { getProperty } from "#/data/store";
import { isUmbrella, spacesStageBreakdown } from "#/data/leaseSpaces";
import {
  TYPE_ICONS,
  TYPE_LABELS,
  getPhotoUrl,
  formatPrice,
} from "#/components/properties/propertyDisplay";
import { dealHeadlineLabel } from "#/components/deals/dealDisplay";
import { NewDealStageChip } from "#/components/deals/NewDealStageChip";
import { dealShape } from "#/data/dealShape";
import {
  CardBadge,
  BadgeDivider,
  CLASSIC_BADGE,
} from "#/components/deals/DealCardBadges";
import {
  relationshipBadge,
  relationshipTooltip,
  sideBadge,
  propertyAddress,
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
  const navigate = useNavigate();
  const board = variant === "board";
  const property = getProperty(listing.propertyId);
  // A space deal is a type of its own on the card, as it was on the old one:
  // the vector-square glyph says "Space" where a building says its asset class,
  // and the title is the suite's label rather than the long "Building — Suite"
  // deal name, which would truncate the suite off the end.
  const isSpace = listing.parentDealId != null;
  const unitLabel = isSpace
    ? property?.units.find((u) => u.id === listing.unitId)?.label
    : undefined;
  const typeIcon = isSpace
    ? faVectorSquare
    : property
      ? TYPE_ICONS[property.propertyType]
      : null;
  const typeLabel = isSpace ? "Space" : property ? TYPE_LABELS[property.propertyType] : "";
  const title = unitLabel ?? listing.name;
  // A lease shell rolls its spaces up — the count the old card carried, so a
  // building with six suites in play says so before you open it.
  const rollup = isUmbrella(listing.id) ? spacesStageBreakdown(listing.id) : null;
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
          {!board && (
            <img
              src={getPhotoUrl(listing.id)}
              alt=""
              className="deal-tile__photo"
            />
          )}
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
              <Tooltip>
                <Tooltip.Trigger
                  render={<span className="deal-tile__title">{title}</span>}
                />
                <Tooltip.Content>
                  {propertyAddress(property) ?? listing.name}
                </Tooltip.Content>
              </Tooltip>
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
        </div>

        <div className="deal-tile__badges">
          <div className="deal-tile__badges-main">
            {!board && onStageChange && (
              <NewDealStageChip
                value={listing.status}
                shape={dealShape(listing)}
                onChange={onStageChange}
              />
            )}
            {/* Classic leads the row: it says which page this deal opens, so it
                is read before the deal's own facts rather than after them. */}
            {listing.isClassic && <CardBadge {...CLASSIC_BADGE} />}
            <CardBadge
              icon={side.icon}
              label={side.label}
              bg={side.bg}
              color={side.color}
              tooltip={side.tooltip}
            />
            {/* The divider belongs to the relationship badge, not to the row —
                kept in one nowrap group so a wrap carries the rule down with it
                and it still reads as a separation from the badges above. */}
            {rel && relationship && (
              <span className="deal-tile__rel-group">
                <BadgeDivider />
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
              </span>
            )}
            {/* The rollup is a way in, not just a count: it opens the property's
                Spaces tab, where every suite and its deal are laid out. Outlined
                like the property card's "Deal" badge, because it is a link out
                rather than a state. Stops the click so the card beneath does not
                also open the shell. */}
            {rollup && (
              <Tooltip>
                <Tooltip.Trigger
                  render={
                    <button
                      type="button"
                      className="deal-tile__badge deal-tile__badge--outline"
                      aria-label={`See the ${rollup.total} ${rollup.total === 1 ? "space" : "spaces"} on this property`}
                      onClick={(e) => {
                        e.stopPropagation();
                        void navigate({
                          to: "/properties/$propertyId/spaces",
                          params: { propertyId: listing.propertyId },
                        });
                      }}
                    >
                      <FontAwesomeIcon icon={faVectorSquare} className="deal-tile__badge-icon" />
                      {rollup.total}
                    </button>
                  }
                />
                <Tooltip.Content>
                  {rollup.total} {rollup.total === 1 ? "space" : "spaces"} in this deal · open the Spaces tab
                </Tooltip.Content>
              </Tooltip>
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
