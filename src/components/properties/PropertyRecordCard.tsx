import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHandshake } from "@fortawesome/pro-regular-svg-icons";
import type { Property } from "#/data/types";
import {
  TYPE_ICONS,
  TYPE_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
  formatSqFt,
  getPhotoUrl,
} from "./propertyDisplay";

export function PropertyRecordCard({
  property,
  dealCount,
}: {
  property: Property;
  dealCount: number;
}) {
  return (
    <div
      className="bg-card rounded border overflow-hidden h-100 d-flex flex-column"
      style={{ borderRadius: 6 }}
    >
      <div style={{ padding: 12 }} className="d-flex flex-column gap-2">
        <div
          className="position-relative overflow-hidden"
          style={{ height: 150, borderRadius: 4 }}
        >
          <img
            src={getPhotoUrl(property.id)}
            alt={property.name}
            className="w-100 h-100"
            style={{ objectFit: "cover", display: "block" }}
          />
          <span
            className="position-absolute d-inline-flex align-items-center gap-1 fw-semibold text-white"
            style={{
              left: 12,
              bottom: 12,
              backgroundColor: STATUS_COLORS[property.status],
              borderRadius: 6,
              padding: "3px 6px",
              fontSize: 10,
            }}
          >
            {STATUS_LABELS[property.status]}
          </span>
        </div>

        <div className="d-flex flex-column" style={{ gap: 2 }}>
          <div className="d-flex align-items-center gap-1 text-muted" style={{ fontSize: 10 }}>
            <FontAwesomeIcon icon={TYPE_ICONS[property.propertyType]} style={{ fontSize: 10 }} />
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
            {[property.street, property.city, property.state].filter(Boolean).join(", ")}
          </div>
        </div>
      </div>

      <div
        className="d-flex align-items-center border-top mt-auto"
        style={{ gap: 10, padding: 8 }}
      >
        <span className="text-muted flex-grow-1" style={{ fontSize: 11 }}>
          {property.buildingSqFt > 0 ? formatSqFt(property.buildingSqFt) : "—"}
        </span>
        <Badge variant="secondary" appearance="muted" className="d-inline-flex align-items-center gap-1">
          <FontAwesomeIcon icon={faHandshake} />
          {dealCount}
        </Badge>
      </div>
    </div>
  );
}
