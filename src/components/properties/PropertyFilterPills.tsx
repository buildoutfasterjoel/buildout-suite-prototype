import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import type { PropertyType } from "#/data/types";
import { ContactChip } from "#/components/contacts/ContactChip";
import { TYPE_LABELS, STATUS_LABELS } from "./propertyDisplay";
import { SIZE_BAND_LABELS, type StageFacetValue } from "./propertyIndexFilters";
import {
  EMPTY_FACETS,
  type PropertyFacetState,
} from "./PropertyFiltersFlyout";

interface Pill {
  key: string;
  label: string;
  clear: (f: PropertyFacetState) => PropertyFacetState;
}

function stageLabel(status: StageFacetValue): string {
  return status === "none"
    ? "No deal"
    : STATUS_LABELS[status as Exclude<StageFacetValue, "none">];
}

function pillsFor(f: PropertyFacetState): Pill[] {
  const pills: Pill[] = [];
  if (f.type !== "all") {
    pills.push({
      key: "type",
      label: `Type: ${TYPE_LABELS[f.type as PropertyType]}`,
      clear: (prev) => ({ ...prev, type: "all" }),
    });
  }
  if (f.size !== "all") {
    pills.push({
      key: "size",
      label: `Size: ${SIZE_BAND_LABELS[f.size]}`,
      clear: (prev) => ({ ...prev, size: "all" }),
    });
  }
  if (f.status !== "all") {
    pills.push({
      key: "status",
      label: `Stage: ${stageLabel(f.status)}`,
      clear: (prev) => ({ ...prev, status: "all" }),
    });
  }
  return pills;
}

/**
 * Active filters as removable pills under the toolbar — the People index's
 * pattern. With the controls themselves behind a flyout, this row is the only
 * thing telling you why the result count is what it is, so it renders whenever
 * anything is set and disappears entirely when nothing is.
 */
export function PropertyFilterPills({
  facets,
  onChange,
}: {
  facets: PropertyFacetState;
  onChange: (next: PropertyFacetState) => void;
}) {
  const pills = pillsFor(facets);
  if (pills.length === 0) return null;

  return (
    <div className="d-flex align-items-center gap-2 flex-wrap">
      {pills.map((p) => (
        <ContactChip
          key={p.key}
          label={p.label}
          removeLabel={`Remove ${p.label}`}
          onRemove={() => onChange(p.clear(facets))}
        />
      ))}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onChange(EMPTY_FACETS)}
      >
        Clear all
      </Button>
    </div>
  );
}
