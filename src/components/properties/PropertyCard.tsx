import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPencil,
  faSignHanging,
  faCalendarCircleExclamation,
} from "@fortawesome/pro-regular-svg-icons";
import type { Listing } from "#/data/types";
import { getProperty } from "#/data/store";
import {
  TYPE_ICONS,
  TYPE_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
  hash,
  getRefId,
  getPhotoUrl,
} from "./propertyDisplay";
import { dealHeadlineLabel } from "#/components/deals/dealDisplay";
import { AvatarGroup } from "./AvatarGroup";

export function PropertyCard({ listing }: { listing: Listing }) {
  const seed = hash(listing.id);
  const refId = getRefId(listing.id);
  const property = getProperty(listing.propertyId);

  return (
    <div
      className="bg-card rounded border overflow-hidden h-100 d-flex flex-column"
      style={{ borderRadius: 6 }}
    >
      <div className="d-flex flex-column" style={{ padding: 12, gap: 8 }}>
        {/* Property image with overlays */}
        <div
          className="position-relative overflow-hidden"
          style={{ height: 166, borderRadius: 4 }}
        >
          <img
            src={getPhotoUrl(listing.id)}
            alt={listing.name}
            className="w-100 h-100"
            style={{ objectFit: "cover", display: "block" }}
          />

          {/* top-right: avatar group + edit */}
          <div
            className="position-absolute d-flex align-items-center gap-2"
            style={{ top: 12, right: 12 }}
          >
            <AvatarGroup seed={seed} />
            <Button
              variant="secondary"
              size="icon-sm"
              aria-label="Edit deal"
            >
              <FontAwesomeIcon icon={faPencil} />
            </Button>
          </div>

          {/* bottom: status + reference id */}
          <div
            className="position-absolute d-flex align-items-center justify-content-between"
            style={{ left: 12, right: 12, bottom: 12 }}
          >
            <span
              className="d-inline-flex align-items-center gap-1 fw-semibold text-white"
              style={{
                backgroundColor: STATUS_COLORS[listing.status],
                borderRadius: 6,
                padding: "3px 6px",
                fontSize: 10,
              }}
            >
              <FontAwesomeIcon icon={faSignHanging} style={{ fontSize: 9 }} />
              {STATUS_LABELS[listing.status]}
            </span>
            <span
              className="fw-semibold text-white"
              style={{
                backgroundColor: "#62748e",
                borderRadius: 6,
                padding: "3px 6px",
                fontSize: 10,
              }}
            >
              #{refId}
            </span>
          </div>
        </div>

        {/* Title block */}
        <div className="d-flex flex-column" style={{ gap: 2 }}>
          <div
            className="d-flex align-items-center gap-1 text-muted"
            style={{ fontSize: 10 }}
          >
            {property && (
              <FontAwesomeIcon
                icon={TYPE_ICONS[property.propertyType]}
                style={{ fontSize: 10 }}
              />
            )}
            <span>{property ? TYPE_LABELS[property.propertyType] : ""}</span>
          </div>
          <div
            className="fw-bold text-truncate"
            style={{ fontSize: 14, lineHeight: "19px", color: "#22262f" }}
            title={listing.name}
          >
            {listing.name}
          </div>
          <div className="text-muted text-truncate" style={{ fontSize: 12 }}>
            {property?.city}, {property?.state}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        className="d-flex align-items-center border-top mt-auto"
        style={{ gap: 10, padding: 8 }}
      >
        <span className="text-muted flex-grow-1" style={{ fontSize: 10 }}>
          {dealHeadlineLabel(listing)}
        </span>
        <FontAwesomeIcon
          icon={faCalendarCircleExclamation}
          className="text-muted"
          style={{ fontSize: 14 }}
        />
      </div>
    </div>
  );
}
