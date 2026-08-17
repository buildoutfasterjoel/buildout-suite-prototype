import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import {
  PROPERTY_STATUSES,
  PROPERTY_TYPES,
  STATUS_LABELS,
  TYPE_LABELS,
} from "#/components/properties/propertyDisplay";
import { FilterSelect } from "./PipelineFilterBar";
import {
  CLOSE_DATE_LABELS,
  DEAL_SIDE_LABELS,
  EMPTY_PIPELINE_FILTERS,
  type CloseDatePreset,
  type PipelineFilterState,
} from "./pipelineFilters";
import type { DealSide } from "#/data/types";

const CLOSE_DATE_PRESETS: CloseDatePreset[] = [
  "this-quarter",
  "this-year",
  "next-90",
  "past",
];

/**
 * *All* Filters, not *More* Filters: it repeats the inline controls as well as
 * the modal-only ones, so it is a complete surface rather than a leftovers
 * drawer and nobody has to remember which filter lives where. Both surfaces
 * write the same state, so a value set in one shows in the other.
 */
export function PipelineFilterModal({
  open,
  onOpenChange,
  filters,
  onChange,
  offices,
  brokers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: PipelineFilterState;
  onChange: (next: PipelineFilterState) => void;
  offices: string[];
  brokers: string[];
}) {
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <Modal.Content size="lg" scrollable centered>
        <Modal.Header>
          <Modal.Title>All Filters</Modal.Title>
          <Modal.Description>
            Every filter available on the Pipeline Report.
          </Modal.Description>
        </Modal.Header>

        <Modal.Body className="d-flex flex-column gap-3">
          <div>
            <label className="form-label small text-muted mb-1">
              Name, Address or Identifier
            </label>
            <Input
              value={filters.search}
              onChange={(e) => onChange({ ...filters, search: e.target.value })}
              aria-label="Search deals"
            />
          </div>

          <div className="d-flex gap-3 flex-wrap">
            <FilterSelect<string>
              label="Office"
              value={filters.office}
              options={offices}
              labelFor={(o) => o}
              onChange={(office) => onChange({ ...filters, office })}
              width={220}
            />
            <FilterSelect<string>
              label="Broker"
              value={filters.broker}
              options={brokers}
              labelFor={(b) => b}
              onChange={(broker) => onChange({ ...filters, broker })}
              width={220}
            />
            <FilterSelect
              label="Deal Side"
              value={filters.dealSide}
              options={["seller", "buyer"] as DealSide[]}
              labelFor={(s) => DEAL_SIDE_LABELS[s]}
              onChange={(dealSide) => onChange({ ...filters, dealSide })}
              width={200}
            />
          </div>

          <div className="d-flex gap-3 flex-wrap">
            <FilterSelect
              label="Deal Stage"
              value={filters.stage}
              options={PROPERTY_STATUSES}
              labelFor={(s) => STATUS_LABELS[s]}
              onChange={(stage) => onChange({ ...filters, stage })}
              width={200}
            />
            <FilterSelect
              label="Deal Type"
              value={filters.dealType}
              options={["Sale", "Lease"] as const}
              labelFor={(v) => v}
              onChange={(dealType) => onChange({ ...filters, dealType })}
              width={200}
            />
            <FilterSelect
              label="Property Type"
              value={filters.propertyType}
              options={PROPERTY_TYPES}
              labelFor={(t) => TYPE_LABELS[t]}
              onChange={(propertyType) => onChange({ ...filters, propertyType })}
              width={200}
            />
            <FilterSelect
              label="Close Date"
              value={filters.closeDate}
              options={CLOSE_DATE_PRESETS}
              labelFor={(p) => CLOSE_DATE_LABELS[p]}
              onChange={(closeDate) => onChange({ ...filters, closeDate })}
              width={200}
            />
          </div>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="ghost" onClick={() => onChange(EMPTY_PIPELINE_FILTERS)}>
            Reset Filter
          </Button>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  );
}
