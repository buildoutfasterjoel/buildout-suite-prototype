import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEraser,
  faMagnifyingGlass,
  faSliders,
} from "@fortawesome/pro-regular-svg-icons";
import {
  PROPERTY_STATUSES,
  PROPERTY_TYPES,
  STATUS_LABELS,
  TYPE_LABELS,
} from "#/components/properties/propertyDisplay";
import { ContactChip } from "#/components/contacts/ContactChip";
import {
  CLOSE_DATE_LABELS,
  CLOSE_DATE_PRESETS,
  DEAL_TYPE_OPTIONS,
  EMPTY_PIPELINE_FILTERS,
  pipelineFilterChips,
  type PipelineFilterState,
} from "./pipelineFilters";

/** "Any" is the empty selection. Select has no null value, so it needs a token. */
export const ANY = "__any__";

/**
 * One labelled single-select. Shared by the inline row and the modal so a
 * filter looks and behaves the same in both places.
 */
export function FilterSelect<T extends string>({
  label,
  value,
  options,
  labelFor,
  onChange,
  width,
}: {
  label: string;
  value: T | null;
  options: readonly T[];
  labelFor: (v: T) => string;
  onChange: (v: T | null) => void;
  width?: number;
}) {
  return (
    <div style={width ? { width } : undefined}>
      <label className="form-label small text-muted mb-1">{label}</label>
      <Select
        value={value ?? ANY}
        onValueChange={(v) => onChange(!v || v === ANY ? null : (v as T))}
      >
        <Select.Trigger>
          <Select.Value>
            {(v) => (!v || v === ANY ? "Any" : labelFor(v as T))}
          </Select.Value>
        </Select.Trigger>
        <Select.Content>
          <Select.Item value={ANY}>Any</Select.Item>
          {options.map((o) => (
            <Select.Item key={o} value={o}>
              {labelFor(o)}
            </Select.Item>
          ))}
        </Select.Content>
      </Select>
    </div>
  );
}

/**
 * The filter row stays ONE row and never wraps. The controls that do not fit
 * live only in the All Filters modal; the chips beneath keep every active
 * filter named on the page, so a modal-only filter can never change the row
 * count with no visible cause.
 */
export function PipelineFilterBar({
  filters,
  onChange,
  onOpenAll,
}: {
  filters: PipelineFilterState;
  onChange: (next: PipelineFilterState) => void;
  onOpenAll: () => void;
}) {
  const chips = pipelineFilterChips(filters);

  return (
    <div className="d-flex flex-column gap-2">
      <div className="d-flex align-items-end gap-2 flex-nowrap overflow-x-auto">
        <div style={{ minWidth: 220 }}>
          <label className="form-label small text-muted mb-1">
            Name, Address or Identifier
          </label>
          <div className="position-relative">
            <FontAwesomeIcon
              icon={faMagnifyingGlass}
              className="position-absolute text-muted"
              style={{ left: 10, top: "50%", transform: "translateY(-50%)" }}
            />
            <Input
              value={filters.search}
              onChange={(e) => onChange({ ...filters, search: e.target.value })}
              style={{ paddingLeft: 30 }}
              aria-label="Search deals"
            />
          </div>
        </div>

        <FilterSelect
          label="Deal Stage"
          value={filters.stage}
          options={PROPERTY_STATUSES}
          labelFor={(s) => STATUS_LABELS[s]}
          onChange={(stage) => onChange({ ...filters, stage })}
          width={150}
        />
        <FilterSelect
          label="Deal Type"
          value={filters.dealType}
          options={DEAL_TYPE_OPTIONS}
          labelFor={(v) => v}
          onChange={(dealType) => onChange({ ...filters, dealType })}
          width={130}
        />
        <FilterSelect
          label="Property Type"
          value={filters.propertyType}
          options={PROPERTY_TYPES}
          labelFor={(t) => TYPE_LABELS[t]}
          onChange={(propertyType) => onChange({ ...filters, propertyType })}
          width={160}
        />
        <FilterSelect
          label="Close Date"
          value={filters.closeDate}
          options={CLOSE_DATE_PRESETS}
          labelFor={(p) => CLOSE_DATE_LABELS[p]}
          onChange={(closeDate) => onChange({ ...filters, closeDate })}
          width={150}
        />

        <Button variant="outline" onClick={onOpenAll} className="flex-shrink-0">
          <FontAwesomeIcon icon={faSliders} />
          All Filters
        </Button>
      </div>

      {chips.length > 0 && (
        <div className="d-flex align-items-center gap-2 flex-wrap">
          {chips.map((chip) => (
            <ContactChip
              key={chip.key}
              appearance="muted"
              label={chip.label}
              removeLabel={`Remove ${chip.label}`}
              onRemove={() => onChange(chip.clear(filters))}
            />
          ))}
          {/* Clearing one filter at a time is fine at one chip and tedious at
              five, so the whole set gets a single control. It rides the chips
              row rather than the filter row because it is only meaningful when
              something is active, which is exactly when chips exist. */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange(EMPTY_PIPELINE_FILTERS)}
            className="ms-1"
          >
            <FontAwesomeIcon icon={faEraser} />
            Clear Filters
          </Button>
        </div>
      )}
    </div>
  );
}
