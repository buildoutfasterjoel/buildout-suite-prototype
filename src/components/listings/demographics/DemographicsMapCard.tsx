import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRotateRight } from "@fortawesome/pro-regular-svg-icons";
import type { DemographicRing } from "#/data/listingDemographics";
import { Section } from "../listingWidgets";
import { RingsEditor } from "./RingsEditor";
import { DemographicsMap } from "./DemographicsMap";

function formatRelativeTime(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function DemographicsMapCard({
  center,
  savedRings,
  draftRings,
  onDraftRingsChange,
  onSave,
  lastRefreshedAt,
  onRefresh,
}: {
  center: { lat: number; lng: number };
  savedRings: DemographicRing[];
  draftRings: DemographicRing[];
  onDraftRingsChange: (rings: DemographicRing[]) => void;
  onSave: () => void;
  lastRefreshedAt: string;
  onRefresh: () => void;
}) {
  const dirty = JSON.stringify(draftRings) !== JSON.stringify(savedRings);

  return (
    <Section
      title="Radius Map"
      action={
        <div className="d-flex align-items-center gap-3">
          <span className="text-muted d-flex align-items-center gap-1" style={{ fontSize: 13 }}>
            Last refreshed {formatRelativeTime(lastRefreshedAt)}
            <Tooltip>
              <Tooltip.Trigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Refresh demographic data"
                    onClick={onRefresh}
                  >
                    <FontAwesomeIcon icon={faArrowRotateRight} />
                  </Button>
                }
              />
              <Tooltip.Content side="top">Refresh</Tooltip.Content>
            </Tooltip>
          </span>
          <Button variant="primary" size="sm" disabled={!dirty} onClick={onSave}>
            Save Changes
          </Button>
        </div>
      }
    >
      <div className="row g-3">
        <div className="col-12 col-md-9">
          <div style={{ height: 460 }}>
            <DemographicsMap center={center} rings={savedRings} />
          </div>
        </div>
        <div className="col-12 col-md-3">
          <RingsEditor rings={draftRings} onChange={onDraftRingsChange} />
        </div>
      </div>
    </Section>
  );
}
