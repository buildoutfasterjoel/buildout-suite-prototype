import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/pro-regular-svg-icons";
import type { PropertyAvailability } from "#/data/propertySpaces";
import { formatSqFt } from "./propertyDisplay";
import { PropertyAvailabilityBar } from "./PropertyAvailabilityBar";

/**
 * `3 of 6 spaces available · 24,500 SF available` — the count only when the
 * headline is something a broker can act on (Available or Vacant); otherwise
 * the plain inventory line. The bar beside it is the composition.
 */
function summaryText(a: PropertyAvailability): string {
  const spaces = `${a.spaceCount} ${a.spaceCount === 1 ? "space" : "spaces"}`;
  const open = a.counts.Available + a.counts.Vacant;
  if (open > 0) {
    return `${open} of ${spaces} available · ${formatSqFt(a.availableSqft)} available`;
  }
  return `${spaces} · ${formatSqFt(a.totalSqft)}`;
}

export function SpacesSummaryStrip({
  availability,
  onAddSpace,
}: {
  availability: PropertyAvailability;
  onAddSpace: () => void;
}) {
  return (
    <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap">
      <div className="d-flex align-items-center gap-3">
        <h2 className="fs-6 fw-semibold mb-0">Spaces</h2>
        <span className="text-muted">{summaryText(availability)}</span>
        <PropertyAvailabilityBar availability={availability} width={160} />
      </div>
      <Button variant="primary" onClick={onAddSpace}>
        <FontAwesomeIcon icon={faPlus} />
        Add Space
      </Button>
    </div>
  );
}
