import { Link } from "@tanstack/react-router";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUser,
  faCalendarCircleExclamation,
  faSignHanging,
  faMagnifyingGlassDollar,
} from "@fortawesome/pro-regular-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import type { Listing, Contact, DealSide } from "#/data/types";
import { getContact } from "#/data/store";
import { TYPE_ICONS, TYPE_LABELS, formatPrice } from "../properties/propertyDisplay";

/** Label, icon, and accent color per deal side. */
const SIDE_DISPLAY: Record<
  DealSide,
  { label: string; icon: IconDefinition; color: string }
> = {
  seller: { label: "Seller", icon: faSignHanging, color: "var(--side-seller)" },
  buyer: {
    label: "Buyer",
    icon: faMagnifyingGlassDollar,
    color: "var(--side-buyer)",
  },
};

/**
 * The primary contact on a deal — the party the broker represents, so a
 * buyer-side deal leads with the buyer and a sell-side deal with the seller.
 */
export function getPrimaryContact(listing: Listing): Contact | undefined {
  const order =
    listing.dealSide === "buyer"
      ? [listing.buyerContactIds, listing.sellerContactIds, listing.otherContactIds]
      : [listing.sellerContactIds, listing.buyerContactIds, listing.otherContactIds];
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

/** Presentational card body — reused for both the column card and the drag overlay. */
export function DealCardView({ listing }: { listing: Listing }) {
  const contact = getPrimaryContact(listing);
  const sideDisplay = SIDE_DISPLAY[listing.dealSide];
  const isLease = listing.dealType === "Lease";
  const price =
    isLease && listing.leaseRate != null
      ? `$${listing.leaseRate}/SF`
      : formatPrice(listing.askingPrice);
  const critical = formatCriticalDate(listing.nextCriticalDate);

  return (
    <div
      className="bg-card rounded border d-flex flex-column"
      style={{ borderRadius: 6, padding: 12, gap: 8 }}
    >
      {/* Property type + deal side */}
      <div className="d-flex flex-column" style={{ gap: 2 }}>
        <div className="d-flex align-items-center gap-2">
          <div
            className="d-flex align-items-center gap-1 text-muted"
            style={{ fontSize: 10 }}
          >
            <FontAwesomeIcon
              icon={TYPE_ICONS[listing.propertyType]}
              style={{ fontSize: 10 }}
            />
            <span>{TYPE_LABELS[listing.propertyType]}</span>
          </div>
          <span
            className="d-inline-flex align-items-center gap-1 fw-semibold text-nowrap"
            style={{
              backgroundColor: `color-mix(in srgb, ${sideDisplay.color} 12%, transparent)`,
              color: sideDisplay.color,
              borderRadius: 6,
              padding: "2px 6px",
              fontSize: 10,
            }}
          >
            <FontAwesomeIcon icon={sideDisplay.icon} style={{ fontSize: 9 }} />
            {sideDisplay.label}
          </span>
        </div>
        <div
          className="fw-semibold text-truncate"
          style={{ fontSize: 13, lineHeight: "18px", color: "#22262f" }}
          title={listing.name}
        >
          {listing.name}
        </div>
        <div className="text-muted text-truncate" style={{ fontSize: 11 }}>
          {listing.city}, {listing.state}
        </div>
      </div>

      {/* Attached person */}
      <div className="d-flex align-items-center gap-2 text-truncate">
        <span
          className="d-inline-flex align-items-center justify-content-center rounded-circle text-white flex-shrink-0 fw-semibold"
          style={{
            width: 22,
            height: 22,
            fontSize: 9,
            backgroundColor: "#62748e",
          }}
        >
          {contact ? (
            initials(contact)
          ) : (
            <FontAwesomeIcon icon={faUser} style={{ fontSize: 10 }} />
          )}
        </span>
        <span className="text-truncate" style={{ fontSize: 12 }}>
          {contact
            ? `${contact.firstName} ${contact.lastName}`
            : "Unassigned"}
        </span>
      </div>

      {/* Footer: price + next critical date */}
      <div
        className="d-flex align-items-center justify-content-between border-top"
        style={{ paddingTop: 8 }}
      >
        <span className="fw-semibold" style={{ fontSize: 12, color: "#22262f" }}>
          {price}
        </span>
        {critical && (
          <span
            className="d-inline-flex align-items-center gap-1 text-muted"
            style={{ fontSize: 11 }}
          >
            <FontAwesomeIcon
              icon={faCalendarCircleExclamation}
              style={{ fontSize: 12 }}
            />
            {critical}
          </span>
        )}
      </div>
    </div>
  );
}

/** Draggable, click-through deal card for a board column. */
export function DealCard({ listing }: { listing: Listing }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: listing.id,
    data: { stage: listing.status, listingId: listing.id },
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
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
