import { Collapsible } from "@buildoutinc/blueprint-react/ui/Collapsible";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronRight } from "@fortawesome/pro-regular-svg-icons";
import { useState } from "react";
import type { DealMarketing, Property } from "#/data/types";
import { MediaAssetGrid } from "./MediaAssetGrid";
import { MediaLinksSection } from "./MediaLinksSection";
import { VisualMediaGallery } from "./VisualMediaGallery";
import type { MediaScope } from "./mediaScope";

/**
 * Per-suite media at the building level: one collapsible per unit, each holding
 * the same four sections a space's own Media tab shows.
 *
 * Iterates `Property.units`, including units with no deal. Media describes
 * physical space, which exists whether or not a deal sits on it — a broker
 * photographing a vacant unworked suite needs somewhere to put the photo.
 */
export function BuildingMediaSpaces({
  property,
  marketing,
  patchMarketing,
}: {
  property: Property;
  marketing: DealMarketing;
  patchMarketing: (patch: Partial<DealMarketing>) => void;
}) {
  const [open, setOpen] = useState<string | null>(property.units[0]?.id ?? null);

  return (
    <div className="d-flex flex-column gap-2">
      <h3 className="fs-large fw-semibold mb-0">Spaces</h3>
      {property.units.map((unit) => {
        const scope: MediaScope = { marketing, patchMarketing, unitId: unit.id };
        const isOpen = open === unit.id;
        const counts = [
          (marketing.photos ?? []).filter((p) => p.unitId === unit.id).length,
          (marketing.visualMedia ?? []).filter((v) => v.unitId === unit.id).length,
          (marketing.links ?? []).filter((l) => l.unitId === unit.id).length,
        ];
        const total = counts.reduce((a, b) => a + b, 0);

        return (
          <Collapsible
            key={unit.id}
            open={isOpen}
            onOpenChange={(o) => setOpen(o ? unit.id : null)}
            className="border rounded"
          >
            <Collapsible.Trigger className="d-flex align-items-center gap-2 w-100 border-0 bg-transparent p-2 text-body">
              <FontAwesomeIcon
                icon={faChevronRight}
                style={{
                  fontSize: 12,
                  transition: "transform 0.15s ease",
                  transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
                }}
              />
              <span className="fw-semibold">{unit.label}</span>
              <span className="text-muted small ms-auto">
                {total === 0 ? "No media" : `${total} item${total === 1 ? "" : "s"}`}
              </span>
            </Collapsible.Trigger>
            <Collapsible.Content>
              <div className="d-flex flex-column gap-4 p-3 pt-0">
                <MediaAssetGrid
                  scope={scope}
                  kind="photo"
                  title="Space Photos"
                  emptyHint="No photos of this suite yet."
                />
                <MediaAssetGrid
                  scope={scope}
                  kind="floorPlan"
                  title="Floor Plan"
                  emptyHint="No floor plan uploaded for this suite."
                />
                <VisualMediaGallery scope={scope} />
                <MediaLinksSection scope={scope} />
              </div>
            </Collapsible.Content>
          </Collapsible>
        );
      })}
    </div>
  );
}
