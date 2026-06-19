import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPencil,
  faSignHanging,
  faCalendarCircleExclamation,
} from "@fortawesome/pro-regular-svg-icons";
import type { Property } from "#/data/types";
import {
  TYPE_ICONS,
  TYPE_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
  formatPrice,
} from "./propertyDisplay";

/** Stable hash so derived display values don't change between renders. */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function photoUrl(id: string): string {
  return `https://picsum.photos/seed/${id}/480/280`;
}

const AVATAR_INITIALS = ["AE", "MK", "JL", "RS", "TC", "DP"];
const AVATAR_BG = ["#7422ce", "#0891b2", "#db2777", "#ea580c", "#16a34a"];

function AvatarGroup({ seed }: { seed: number }) {
  const shown = 2 + (seed % 2); // 2–3 avatars
  const more = 2 + (seed % 7);
  return (
    <div
      className="d-inline-flex align-items-center bg-white rounded-pill shadow-sm"
      style={{ padding: "2px 8px 2px 2px", gap: 4 }}
    >
      <div className="d-flex align-items-center">
        {Array.from({ length: shown }, (_, i) => (
          <span
            key={i}
            className="d-inline-flex align-items-center justify-content-center rounded-circle text-white"
            style={{
              width: 18,
              height: 18,
              marginRight: -8,
              fontSize: 9,
              border: "2px solid #fff",
              backgroundColor: AVATAR_BG[(seed + i) % AVATAR_BG.length],
            }}
          >
            {AVATAR_INITIALS[(seed + i) % AVATAR_INITIALS.length]}
          </span>
        ))}
      </div>
      <span className="text-muted" style={{ fontSize: 10 }}>
        +{more}
      </span>
    </div>
  );
}

export function PropertyCard({ property }: { property: Property }) {
  const seed = hash(property.id);
  const refId = 10000 + (seed % 90000);

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
            src={photoUrl(property.id)}
            alt={property.name}
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
              aria-label="Edit listing"
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
                backgroundColor: STATUS_COLORS[property.status],
                borderRadius: 6,
                padding: "3px 6px",
                fontSize: 10,
              }}
            >
              <FontAwesomeIcon icon={faSignHanging} style={{ fontSize: 9 }} />
              {STATUS_LABELS[property.status]}
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
            <FontAwesomeIcon
              icon={TYPE_ICONS[property.propertyType]}
              style={{ fontSize: 10 }}
            />
            <span>{TYPE_LABELS[property.propertyType]}</span>
          </div>
          <div
            className="fw-bold text-truncate"
            style={{ fontSize: 14, lineHeight: "19px", color: "#22262f" }}
            title={property.name}
          >
            {property.name}
          </div>
          <div className="text-muted text-truncate" style={{ fontSize: 12 }}>
            {property.city}, {property.state}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        className="d-flex align-items-center border-top mt-auto"
        style={{ gap: 10, padding: 8 }}
      >
        <span className="text-muted flex-grow-1" style={{ fontSize: 10 }}>
          {formatPrice(property.askingPrice)}
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
