import { useNavigate } from "@tanstack/react-router";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { DropdownMenu } from "@buildoutinc/blueprint-react/ui/DropdownMenu";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEllipsisVertical,
  faFile,
  faUserGroup,
  faUpRightFromSquare,
  faCheckToSlot,
} from "@fortawesome/pro-regular-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import type { PropertyStatus } from "#/data/types";
import { getProperty } from "#/data/store";
import { useDataStore } from "#/data/dataStore";
import { requestStageChange } from "#/components/deals/useStageGate";
import {
  TYPE_ICONS,
  TYPE_LABELS,
  getPhotoUrl,
} from "#/components/properties/propertyDisplay";
import { dealHeadlineLabel } from "#/components/deals/dealDisplay";
import {
  SIDE_DISPLAY,
  SIDE_BADGE_COLORS,
} from "#/components/contacts/contactDisplay";
import { DealStageChip } from "#/components/deals/DealStageChip";
import { shouldIgnoreRowClick } from "#/components/contacts/rowClick";

function medDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * The AI-suggested next action for a deal, if any. Rule-based for now (an early
 * example, to be expanded with the AI team); returns null when nothing applies.
 */
function dealNextAction(
  status: PropertyStatus,
): { label: string; icon: IconDefinition } | null {
  if (status === "proposal") {
    return { label: "Build Underwriting", icon: faCheckToSlot };
  }
  return null;
}

/** A conditionally-shown quick link (Documents, Leads) with a count + open icon. */
function QuickLink({
  icon,
  label,
  count,
  onClick,
}: {
  icon: IconDefinition;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="contact-deal-card__link btn btn-link text-reset text-decoration-none d-flex align-items-center gap-2 w-100 px-2 py-0"
      style={{ height: 36 }}
      onClick={onClick}
    >
      <FontAwesomeIcon icon={icon} className="text-muted" />
      <span className="fw-semibold">{label}</span>
      <Badge variant="secondary" appearance="muted">
        {count}
      </Badge>
      <FontAwesomeIcon
        icon={faUpRightFromSquare}
        className="contact-deal-card__link-open text-muted ms-auto"
      />
    </button>
  );
}

/**
 * A contact's linked deal, rendered per the Figma structure:
 * 1. high-level info (thumbnail, name, projected rev · sqft · started date),
 * 2. meta chips (stage chip, side, property type),
 * 3. conditionally-visible quick links (Documents, Leads — shown when present),
 * 4. a conditionally-visible AI next action (e.g. "Build Underwriting").
 *
 * The whole card navigates to the deal on a plain click; interactive controls
 * (stage chip, ⋮ menu, quick links, AI action) are excluded via the shared guard.
 */
export function ContactDealCard({ listingId }: { listingId: string }) {
  const navigate = useNavigate();
  // Reactive so a committed stage transition (via the shared gate) re-renders
  // the card with the new status immediately.
  const listing = useDataStore((s) => s.listings.get(listingId));
  if (!listing) return null;

  const property = getProperty(listing.propertyId);
  const price = dealHeadlineLabel(listing);
  const sqft = `${(listing.marketing.availableSqFt ?? 0).toLocaleString()} SF`;
  const side = SIDE_DISPLAY[listing.dealSide];

  const docsCount = listing.documents?.length ?? 0;
  // "Leads" = interested parties on the opposite side of the represented one.
  const leadsCount =
    listing.dealSide === "seller"
      ? listing.buyerContactIds.length + listing.otherContactIds.length
      : listing.sellerContactIds.length + listing.otherContactIds.length;
  const nextAction = dealNextAction(listing.status);

  return (
    <div
      className="contact-deal-card position-relative bg-card border d-flex flex-column gap-3 p-3"
      onClick={(e) => {
        if (shouldIgnoreRowClick(e)) return;
        void navigate({
          to: "/listings/$listingId",
          params: { listingId },
        });
      }}
    >
      {/* Actions menu */}
      <div className="position-absolute" style={{ top: 6, right: 6 }}>
        <DropdownMenu>
          <DropdownMenu.Trigger
            render={
              <Button variant="ghost" size="icon-sm" aria-label="Deal actions">
                <FontAwesomeIcon
                  icon={faEllipsisVertical}
                  className="text-muted"
                />
              </Button>
            }
          />
          <DropdownMenu.Content align="end">
            <DropdownMenu.Item
              onClick={() =>
                void navigate({
                  to: "/listings/$listingId",
                  params: { listingId },
                })
              }
            >
              Open deal
            </DropdownMenu.Item>
            <DropdownMenu.Item>Edit</DropdownMenu.Item>
            <DropdownMenu.Item>Remove link</DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu>
      </div>

      {/* High-level info */}
      <div className="d-flex align-items-center gap-3" style={{ paddingRight: 24 }}>
        <img
          src={getPhotoUrl(listing.id)}
          alt=""
          className="flex-shrink-0"
          style={{
            width: 48,
            height: 48,
            objectFit: "cover",
            borderRadius: 6,
          }}
        />
        <div className="flex-grow-1" style={{ minWidth: 0 }}>
          <div
            className="fw-semibold text-truncate"
            style={{ fontSize: 17, lineHeight: "26px" }}
            title={listing.name}
          >
            {listing.name}
          </div>
          <div
            className="text-muted text-truncate"
            style={{ fontSize: 14, lineHeight: "19px" }}
          >
            {price} · {sqft} · started {medDate(listing.createdAt)}
          </div>
        </div>
      </div>

      {/* Meta chips */}
      <div className="d-flex flex-wrap align-items-center gap-2">
        <DealStageChip
          value={listing.status}
          onChange={(next) => requestStageChange(listing.id, next)}
          size="sm"
        />
        <Badge
          className="d-inline-flex align-items-center fw-semibold"
          style={{
            height: 20,
            padding: "0 4px",
            fontSize: 14,
            backgroundColor: SIDE_BADGE_COLORS[listing.dealSide].bg,
            color: SIDE_BADGE_COLORS[listing.dealSide].text,
          }}
        >
          {side.label}
        </Badge>
        {property && (
          <Badge
            variant="secondary"
            appearance="muted"
            className="d-inline-flex align-items-center gap-1 fw-semibold"
            style={{
              height: 20,
              padding: "0 4px",
              fontSize: 14,
              backgroundColor: "#eceef2",
            }}
          >
            <FontAwesomeIcon icon={TYPE_ICONS[property.propertyType]} />
            {TYPE_LABELS[property.propertyType]}
          </Badge>
        )}
      </div>

      {/* Conditionally-visible quick links */}
      {(docsCount > 0 || leadsCount > 0) && (
        <div className="border-top d-flex flex-column">
          {docsCount > 0 && (
            <QuickLink
              icon={faFile}
              label="Documents"
              count={docsCount}
              onClick={() =>
                void navigate({
                  to: "/listings/$listingId/documents",
                  params: { listingId },
                })
              }
            />
          )}
          {leadsCount > 0 && (
            <QuickLink
              icon={faUserGroup}
              label="Leads"
              count={leadsCount}
              onClick={() =>
                void navigate({
                  to: "/listings/$listingId/leads",
                  params: { listingId },
                })
              }
            />
          )}
        </div>
      )}

      {/* Conditionally-visible AI next action */}
      {nextAction && (
        <Button
          variant="outline"
          className="contact-deal-card__underwriting-btn w-100"
        >
          <FontAwesomeIcon icon={nextAction.icon} />
          {nextAction.label}
        </Button>
      )}
    </div>
  );
}
