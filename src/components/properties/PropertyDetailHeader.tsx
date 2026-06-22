import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPencil,
  faSignHanging,
  faUserGear,
  faEllipsisVertical,
} from "@fortawesome/pro-regular-svg-icons";
import type { Property } from "#/data/types";
import {
  STATUS_LABELS,
  hash,
  getRefId,
  getPhotoUrl,
} from "./propertyDisplay";
import { AvatarGroup } from "./AvatarGroup";

/**
 * Full-bleed page header for a property — spans the viewport and sits flush under
 * the global nav, while its content is constrained to the centered `.container`.
 */
export function PropertyDetailHeader({ property }: { property: Property }) {
  const seed = hash(property.id);
  const refId = getRefId(property.id);
  const address = `${property.street}, ${property.city}, ${property.state} ${property.zip}`;

  return (
    <div className="bg-white border-bottom">
      <div className="container py-3">
        <div className="d-flex align-items-center gap-3">
          {/* Thumbnail */}
          <img
            src={getPhotoUrl(property.id, 328, 164)}
            alt={property.name}
            className="flex-shrink-0 d-none d-sm-block"
            style={{
              width: 164,
              height: 82,
              objectFit: "cover",
              borderRadius: 4,
            }}
          />

          {/* Identity */}
          <div className="flex-grow-1" style={{ minWidth: 0 }}>
            <h1 className="fs-4 fw-semibold mb-0 text-truncate" title={property.name}>
              {property.name}
            </h1>
            <div className="text-muted text-truncate">{address}</div>
            <div className="d-flex align-items-center gap-2 mt-2">
              <Badge variant="secondary" appearance="muted">
                <FontAwesomeIcon icon={faSignHanging} className="me-1" />
                {STATUS_LABELS[property.status]}
              </Badge>
              <Badge variant="secondary" appearance="muted">
                #{refId}
              </Badge>
            </div>
          </div>

          {/* Actions */}
          <div className="d-flex align-items-center gap-2 flex-shrink-0">
            <AvatarGroup seed={seed} size="default" />
            <Button variant="ghost" size="icon" aria-label="Manage access">
              <FontAwesomeIcon icon={faUserGear} />
            </Button>
            <Button variant="primary">
              <FontAwesomeIcon icon={faPencil} className="me-2" />
              Edit Listing
            </Button>
            <Button variant="ghost" size="icon" aria-label="More options">
              <FontAwesomeIcon icon={faEllipsisVertical} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
