import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useDraggable } from "@dnd-kit/core";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUser,
  faCalendarCircleExclamation,
  faSignHanging,
  faMagnifyingGlassDollar,
  faVectorSquare,
} from "@fortawesome/pro-regular-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import type { Listing, Contact, DealSide } from "#/data/types";
import { getContact, getListing, getProperty } from "#/data/store";
import { isUmbrella, spacesStageBreakdown } from "#/data/leaseSpaces";
import { DealStageBadge } from "./DealStageBadge";
import { dealHeadlineLabel } from "./dealDisplay";
import {
  TYPE_ICONS,
  TYPE_LABELS,
} from "../properties/propertyDisplay";

/**
 * Icon + accent color per deal side, plus the label per deal type — a Sale reads
 * Seller/Buyer, a Lease reads Landlord/Tenant.
 */
const SIDE_DISPLAY: Record<
  DealSide,
  { icon: IconDefinition; color: string; Sale: string; Lease: string }
> = {
  seller: {
    icon: faSignHanging,
    color: "var(--side-seller)",
    Sale: "Seller",
    Lease: "Landlord",
  },
  buyer: {
    icon: faMagnifyingGlassDollar,
    color: "var(--side-buyer)",
    Sale: "Buyer",
    Lease: "Tenant",
  },
};

/**
 * The primary contact on a deal — the party the broker represents, so a
 * buyer-side deal leads with the buyer and a sell-side deal with the seller.
 */
export function getPrimaryContact(listing: Listing): Contact | undefined {
  const order =
    listing.dealSide === "buyer"
      ? [
          listing.buyerContactIds,
          listing.sellerContactIds,
          listing.otherContactIds,
        ]
      : [
          listing.sellerContactIds,
          listing.buyerContactIds,
          listing.otherContactIds,
        ];
  for (const ids of order) {
    if (ids[0]) return getContact(ids[0]);
  }
  return undefined;
}

function initials(c: Contact): string {
  return `${c.firstName[0] ?? ""}${c.lastName[0] ?? ""}`.toUpperCase();
}

function formatCriticalDate(date: string | null): string | null {
  if (!date) return null;
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/**
 * Presentational deal card — the universal card used across the suite (Deals
 * board, contact detail, and the AI assistant). Optional slots let a context
 * add its own chrome without forking the card:
 * - `showStatus` renders a stage badge (off on the board, where the column is the stage).
 * - `action` renders a top-right control (e.g. a per-deal menu); its clicks are
 *   isolated so they don't trigger a wrapping card link.
 * - `footer` renders extra content inside the card (e.g. plan progress + lead).
 */
export function DealCardView({
  listing,
  showStatus = false,
  action,
  footer,
}: {
  listing: Listing;
  showStatus?: boolean;
  action?: ReactNode;
  footer?: ReactNode;
}) {
  const contact = getPrimaryContact(listing);
  const property = getProperty(listing.propertyId);
  const sideDisplay = SIDE_DISPLAY[listing.dealSide];
  const price = dealHeadlineLabel(listing);
  const critical = formatCriticalDate(listing.transaction.nextCriticalDate);
  // The critical date is the next open task's due date — name that milestone.
  const criticalTask = listing.tasks.find(
    (t) => t.status !== "complete" && t.date,
  );
  // Lost deals get a muted background to set them apart from the active pipeline.
  const isLost = listing.status === "inactive";
  // Umbrella parents roll up their child space deals' stages; children get a flair instead.
  const rollup = isUmbrella(listing.id)
    ? spacesStageBreakdown(listing.id)
    : null;
  // A child space card leads with its suite label + the building address (so the
  // suite is visible rather than truncated off the end of the full deal name);
  // a top-level deal keeps its own name + town.
  const isChild = listing.parentDealId != null;
  const unitLabel = property?.units.find((u) => u.id === listing.unitId)?.label;
  const cardTitle = isChild ? (unitLabel ?? listing.name) : listing.name;
  const cardSubtitle = property
    ? isChild
      ? [property.street, property.city, property.state].filter(Boolean).join(", ")
      : [property.city, property.state].filter(Boolean).join(", ")
    : "";
  // The leading type chip is icon-only (label in a tooltip) to leave room for
  // the rep badge: a child reads "Space", a top-level deal its property type.
  const typeIcon = isChild
    ? faVectorSquare
    : property
      ? TYPE_ICONS[property.propertyType]
      : null;
  const typeLabel = isChild
    ? "Space"
    : property
      ? TYPE_LABELS[property.propertyType]
      : "";

  return (
    <div
      className={`rounded border d-flex flex-column ${isLost ? "bg-storm-grey-100" : "bg-card"}`}
      style={{ borderRadius: 6, padding: 12, gap: 8 }}
    >
      {/* Property type + deal side */}
      <div className="d-flex flex-column" style={{ gap: 2 }}>
        <div className="d-flex align-items-center gap-2">
          {typeIcon && (
            <Tooltip>
              <Tooltip.Trigger
                render={
                  <span className="d-inline-flex align-items-center text-muted fs-small">
                    <FontAwesomeIcon icon={typeIcon} />
                  </span>
                }
              />
              <Tooltip.Content>{typeLabel}</Tooltip.Content>
            </Tooltip>
          )}
          <span
            className="d-inline-flex align-items-center gap-1 fw-semibold text-nowrap fs-small"
            style={{
              backgroundColor: `color-mix(in srgb, ${sideDisplay.color} 12%, transparent)`,
              color: sideDisplay.color,
              borderRadius: 6,
              padding: "2px 6px",
            }}
          >
            <FontAwesomeIcon icon={sideDisplay.icon} />
            {sideDisplay[listing.dealType]}
          </span>
          {(showStatus || action) && (
            <div className="ms-auto d-flex align-items-center gap-2">
              {showStatus && <DealStageBadge stage={listing.status} />}
              {action && (
                <span
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                >
                  {action}
                </span>
              )}
            </div>
          )}
        </div>
        <div
          className="fw-semibold text-truncate"
          style={{ color: "#22262f" }}
          title={cardTitle}
        >
          {cardTitle}
        </div>
        <div className="text-muted text-truncate fs-small">{cardSubtitle}</div>
      </div>

      {/* Attached person */}
      <div className="d-flex align-items-center gap-2 text-truncate">
        <Avatar size="sm" className="flex-shrink-0">
          <Avatar.Fallback className="fw-semibold">
            {contact ? initials(contact) : <FontAwesomeIcon icon={faUser} />}
          </Avatar.Fallback>
        </Avatar>
        <span className="text-truncate">
          {contact ? `${contact.firstName} ${contact.lastName}` : "Unassigned"}
        </span>
      </div>

      {/* Footer: price + next critical date */}
      <div
        className="d-flex align-items-center justify-content-between border-top"
        style={{ paddingTop: 8 }}
      >
        <span className="fw-semibold" style={{ color: "#22262f" }}>
          {price}
        </span>
        <div className="d-flex align-items-center gap-3">
          {rollup && (
            <Tooltip>
              <Tooltip.Trigger
                render={
                  <span className="d-inline-flex align-items-center gap-1 text-muted fs-small">
                    <FontAwesomeIcon icon={faVectorSquare} />
                    {rollup.total}
                  </span>
                }
              />
              <Tooltip.Content>
                {rollup.total} {rollup.total === 1 ? "space" : "spaces"} in this deal
              </Tooltip.Content>
            </Tooltip>
          )}
          {critical && (
            <Tooltip>
              <Tooltip.Trigger
                render={
                  <span className="d-inline-flex align-items-center gap-1 text-muted fs-small">
                    <FontAwesomeIcon icon={faCalendarCircleExclamation} />
                    {critical}
                  </span>
                }
              />
              <Tooltip.Content>
                {criticalTask
                  ? `Next critical date · ${criticalTask.label}`
                  : "Next critical date"}
              </Tooltip.Content>
            </Tooltip>
          )}
        </div>
      </div>

      {footer && (
        <div className="border-top" style={{ paddingTop: 8 }}>
          {footer}
        </div>
      )}
    </div>
  );
}

/**
 * Store-backed, clickable deal card — looks up the listing by id and links to
 * its workspace. The universal entry point for contexts that only have a deal
 * id (the AI assistant, the contact page). Renders nothing if the id is unknown.
 */
export function DealCardById({
  listingId,
  showStatus = false,
  action,
  footer,
}: {
  listingId: string;
  showStatus?: boolean;
  action?: ReactNode;
  footer?: ReactNode;
}) {
  const listing = getListing(listingId);
  if (!listing) return null;
  return (
    <Link
      to="/listings/$listingId"
      params={{ listingId }}
      className="text-decoration-none text-reset d-block"
    >
      <DealCardView
        listing={listing}
        showStatus={showStatus}
        action={action}
        footer={footer}
      />
    </Link>
  );
}

/** Draggable, click-through deal card for a board column. */
export function DealCard({ listing }: { listing: Listing }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: listing.id,
    data: { stage: listing.status, listingId: listing.id },
  });

  // The source stays in place (dimmed) while the DragOverlay follows the cursor.
  return (
    <div
      ref={setNodeRef}
      style={{
        opacity: isDragging ? 0.4 : 1,
        cursor: "grab",
        touchAction: "none",
      }}
      {...attributes}
      {...listeners}
    >
      <Link
        to="/listings/$listingId"
        params={{ listingId: listing.id }}
        className="text-decoration-none text-reset d-block"
      >
        <DealCardView listing={listing} />
      </Link>
    </div>
  );
}
