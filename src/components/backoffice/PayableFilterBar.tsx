import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEraser, faMagnifyingGlass } from "@fortawesome/pro-regular-svg-icons";
import { PAYABLE_STATUSES, type PayableStatus } from "#/data/payableIndex";
import {
  clearedPayableFilters,
  payableFilterChips,
  type PayableFilterState,
  type PayableYear,
} from "#/data/payableFilters";
import {
  FacetDropdown,
  type FacetDropdownFacet,
} from "#/components/properties/FacetDropdown";
import { SELECT_LOOK } from "#/components/backoffice/filterBarParts";
import { ContactChip } from "#/components/contacts/ContactChip";

/**
 * The payables index's toolbar.
 *
 * Two rows: the controls, then the chips for whatever is on. The sibling Back
 * Office toolbars are one row because they carry six facets and nothing is
 * switched on at rest; this one carries two and opens with Outstanding already
 * applied, so the chip row is never a surprise second line that appears out of
 * nowhere.
 *
 * No Brokers control and no Offices control. Brokers would duplicate the
 * grouping the whole page is, and Offices — the disabled placeholder
 * `filterBarParts` keeps for the reference designs that carry it — is absent
 * from this page's design, so adding it would be inventing a dead control
 * rather than honouring one.
 */
export function PayableFilterBar({
  filters,
  years,
  onChange,
}: {
  filters: PayableFilterState;
  /** The years any payable was raised in, newest first. */
  years: number[];
  onChange: (next: PayableFilterState) => void;
}) {
  const chips = payableFilterChips(filters);
  const canClear = chips.length > 0 || filters.search.trim() !== "";

  const statusFacet: FacetDropdownFacet = {
    title: "Status",
    options: PAYABLE_STATUSES.map((s) => ({ value: s, label: s })),
    selected: filters.statuses as Set<string>,
    toggle: (value: string) => {
      const statuses = new Set(filters.statuses);
      const status = value as PayableStatus;
      if (statuses.has(status)) statuses.delete(status);
      else statuses.add(status);
      onChange({ ...filters, statuses });
    },
    clear: () => onChange({ ...filters, statuses: new Set() }),
  };

  const yearLabel = (y: PayableYear) => (y === "all" ? "All time" : String(y));

  return (
    <div className="d-flex flex-column gap-3">
      <div className="d-flex align-items-center gap-2 flex-wrap">
        <div style={{ maxWidth: 340, flex: "1 1 260px" }}>
          <InputGroup>
            <InputGroup.Addon>
              <FontAwesomeIcon icon={faMagnifyingGlass} />
            </InputGroup.Addon>
            {/* Fully controlled by the parent, like the sibling toolbars' boxes:
                a local mirror buys nothing without a debounce and goes stale on
                reset, leaving a term on screen that is no longer applied. */}
            <Input
              type="search"
              placeholder="Search by broker, voucher, or amount"
              value={filters.search}
              onChange={(e) => onChange({ ...filters, search: e.target.value })}
            />
          </InputGroup>
        </div>

        {/* Boxed to a width: Blueprint's Select.Trigger is a block that fills
            its parent, so bare in a flex row it claims a line of its own. */}
        <div style={{ width: 150 }}>
          <Select
            value={String(filters.year)}
            onValueChange={(v) =>
              onChange({ ...filters, year: v === "all" ? "all" : Number(v) })
            }
          >
            <Select.Trigger>
              {/* The label as children, not a bare Select.Value — Value renders
                  the raw stored value, which here is a number or "all". */}
              <Select.Value>
                {filters.year === "all"
                  ? "Creation Date"
                  : yearLabel(filters.year)}
              </Select.Value>
            </Select.Trigger>
            <Select.Content>
              {/* Without this a payable raised outside every offered year would
                  be unreachable — an index whose rows cannot all be found is
                  worse than an extra option. */}
              <Select.Item value="all">All time</Select.Item>
              {years.map((y) => (
                <Select.Item key={y} value={String(y)}>
                  {String(y)}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </div>

        <FacetDropdown facet={statusFacet} className={SELECT_LOOK} />

        {canClear && (
          <Button
            variant="ghost"
            className="ms-auto"
            onClick={() => onChange(clearedPayableFilters())}
          >
            <FontAwesomeIcon icon={faEraser} />
            Clear Filters
          </Button>
        )}
      </div>

      {chips.length > 0 && (
        <div className="d-flex align-items-center gap-2 flex-wrap">
          {chips.map((chip) => (
            <ContactChip
              key={chip.key}
              label={chip.label}
              removeLabel={`Remove ${chip.label}`}
              onRemove={() => onChange(chip.clear(filters))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
