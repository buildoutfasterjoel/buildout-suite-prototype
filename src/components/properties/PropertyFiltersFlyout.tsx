import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Field } from "@buildoutinc/blueprint-react/ui/Field";
import { Offcanvas } from "@buildoutinc/blueprint-react/ui/Offcanvas";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import type { PropertyType } from "#/data/types";
import {
  PROPERTY_TYPES,
  TYPE_LABELS,
  PROPERTY_STATUSES,
  STATUS_LABELS,
} from "./propertyDisplay";
import {
  SIZE_BANDS,
  SIZE_BAND_LABELS,
  type SizeBand,
  type StageFacetValue,
} from "./propertyIndexFilters";

export interface PropertyFacetState {
  type: PropertyType | "all";
  size: SizeBand;
  status: StageFacetValue | "all";
}

/** Everything unset — what "Clear all" restores and what the pills count against. */
export const EMPTY_FACETS: PropertyFacetState = {
  type: "all",
  size: "all",
  status: "all",
};

export function countActiveFacets(f: PropertyFacetState): number {
  return (
    (f.type !== "all" ? 1 : 0) +
    (f.size !== "all" ? 1 : 0) +
    (f.status !== "all" ? 1 : 0)
  );
}

/**
 * The Properties filter flyout — the People index's Offcanvas pattern applied
 * here, so the toolbar carries one Filters button instead of a row of selects.
 * Opens from the left, like Contacts and Tasks.
 */
export function PropertyFiltersFlyout({
  open,
  onOpenChange,
  facets,
  onChange,
  /** Stage is a deal concept, so it's hidden on prospect records. */
  showStage,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  facets: PropertyFacetState;
  onChange: (next: PropertyFacetState) => void;
  showStage: boolean;
}) {
  const active = countActiveFacets(facets);

  return (
    <Offcanvas open={open} onOpenChange={onOpenChange}>
      <Offcanvas.Content side="left" style={{ width: "22rem" }}>
        <Offcanvas.Header>
          <Offcanvas.Title className="fs-5 fw-bold mb-0">
            Filters
          </Offcanvas.Title>
        </Offcanvas.Header>

        <Offcanvas.Body className="d-flex flex-column gap-4">
          <Field>
            <Field.Label>Property Type</Field.Label>
            <Select
              value={facets.type}
              onValueChange={(v) =>
                onChange({ ...facets, type: v as PropertyType | "all" })
              }
            >
              <Select.Trigger>
                <Select.Value>
                  {(v) =>
                    v === "all" ? "All types" : TYPE_LABELS[v as PropertyType]
                  }
                </Select.Value>
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="all">All types</Select.Item>
                {PROPERTY_TYPES.map((t) => (
                  <Select.Item key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </Field>

          <Field>
            <Field.Label>Building Size</Field.Label>
            <Select
              value={facets.size}
              onValueChange={(v) => onChange({ ...facets, size: v as SizeBand })}
            >
              <Select.Trigger>
                <Select.Value>
                  {(v) => SIZE_BAND_LABELS[v as SizeBand]}
                </Select.Value>
              </Select.Trigger>
              <Select.Content>
                {SIZE_BANDS.map((b) => (
                  <Select.Item key={b} value={b}>
                    {SIZE_BAND_LABELS[b]}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </Field>

          {showStage && (
            <Field>
              <Field.Label>Deal Stage</Field.Label>
              <Select
                value={facets.status}
                onValueChange={(v) =>
                  onChange({ ...facets, status: v as StageFacetValue | "all" })
                }
              >
                <Select.Trigger>
                  <Select.Value>
                    {(v) =>
                      v === "all"
                        ? "All stages"
                        : v === "none"
                          ? "No deal"
                          : STATUS_LABELS[v as Exclude<StageFacetValue, "none">]
                    }
                  </Select.Value>
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="all">All stages</Select.Item>
                  <Select.Item value="none">No deal</Select.Item>
                  {PROPERTY_STATUSES.map((s) => (
                    <Select.Item key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </Field>
          )}
        </Offcanvas.Body>

        <Offcanvas.Footer className="d-flex align-items-center gap-2">
          <span className="text-muted flex-grow-1">
            <span className="fw-bold text-body">{active}</span> selected
          </span>
          <Button variant="ghost" onClick={() => onChange(EMPTY_FACETS)}>
            Clear All
          </Button>
          <Button variant="primary" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </Offcanvas.Footer>
      </Offcanvas.Content>
    </Offcanvas>
  );
}
