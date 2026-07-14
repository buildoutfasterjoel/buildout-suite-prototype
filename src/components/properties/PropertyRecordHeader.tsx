import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/pro-regular-svg-icons";
import type { Property } from "#/data/types";
import { useCreateDeal } from "#/data/useCreateDeal";
import { TYPE_ICONS, TYPE_LABELS, STATUS_LABELS, getPhotoUrl } from "./propertyDisplay";

export function PropertyRecordHeader({ property }: { property: Property }) {
  return (
    <div className="border-bottom bg-card">
      <div className="container py-4 d-flex align-items-center gap-3 flex-wrap">
        <img
          src={getPhotoUrl(property.id, 96, 96)}
          alt={property.name}
          style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8 }}
        />
        <div className="flex-grow-1" style={{ minWidth: 0 }}>
          <div className="d-flex align-items-center gap-2 text-muted fs-small">
            <FontAwesomeIcon icon={TYPE_ICONS[property.propertyType]} />
            {TYPE_LABELS[property.propertyType]}
            <Badge variant="secondary" appearance="muted">{STATUS_LABELS[property.status]}</Badge>
          </div>
          <h1 className="h4 mb-0 text-truncate">{property.name}</h1>
          <div className="text-muted text-truncate">
            {[property.street, property.city, property.state, property.zip].filter(Boolean).join(", ")}
          </div>
        </div>
        <Button variant="primary" onClick={() => useCreateDeal.getState().openFor({ property })}>
          <FontAwesomeIcon icon={faPlus} />
          Create Deal
        </Button>
      </div>
    </div>
  );
}
