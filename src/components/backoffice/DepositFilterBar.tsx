import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass } from "@fortawesome/pro-regular-svg-icons";
import type { DealType, PropertyType } from "#/data/types";
import { CHART_GRAINS, type ChartGrain } from "#/data/receivables";
import type { DepositFilterState, DepositYear } from "#/data/depositFilters";
import {
  FacetDropdown,
  type FacetDropdownFacet,
} from "#/components/properties/FacetDropdown";
import {
  BrokerCombobox,
  OfficesDropdown,
  SELECT_LOOK,
} from "#/components/backoffice/filterBarParts";
import {
  PROPERTY_TYPES,
  TYPE_LABELS,
} from "#/components/properties/propertyDisplay";

const DEAL_TYPES: DealType[] = ["Sale", "Lease"];

/** The facets rendered as checkbox dropdowns. Brokers is a combobox, not one. */
type FacetKey = "dealTypes" | "propertyTypes";

/**
 * The deposits index's toolbar.
 *
 * The receivables toolbar minus its two facets that have nothing to say here: a
 * deposit has no status, and a deal's stage is not a fact about the cash it
 * received. What is left is the same row in the same order, so moving between
 * the two pages does not move the controls under the user's cursor.
 */
export function DepositFilterBar({
  filters,
  brokerNames,
  years,
  onChange,
}: {
  filters: DepositFilterState;
  /** Every internal broker on the current book, sorted — the Brokers options. */
  brokerNames: string[];
  /** The years any deposit landed in, newest first. */
  years: number[];
  onChange: (next: DepositFilterState) => void;
}) {
  /** Toggle one option inside a facet, returning a fresh Set (never mutating). */
  function toggler<T extends string>(key: FacetKey) {
    return (value: string) => {
      const next = new Set(filters[key] as Set<string>);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      onChange({ ...filters, [key]: next as Set<T> });
    };
  }

  function clearer(key: FacetKey) {
    return () => onChange({ ...filters, [key]: new Set() });
  }

  const facets: (FacetDropdownFacet & { id: string })[] = [
    {
      id: "dealType",
      title: "Deal Type",
      options: DEAL_TYPES.map((t) => ({ value: t, label: t })),
      selected: filters.dealTypes as Set<string>,
      toggle: toggler<DealType>("dealTypes"),
      clear: clearer("dealTypes"),
    },
    {
      id: "propertyType",
      title: "Property Type",
      options: PROPERTY_TYPES.map((t) => ({ value: t, label: TYPE_LABELS[t] })),
      selected: filters.propertyTypes as Set<string>,
      toggle: toggler<PropertyType>("propertyTypes"),
      clear: clearer("propertyTypes"),
    },
  ];

  const yearLabel = (y: DepositYear) => (y === "all" ? "All time" : String(y));

  return (
    <div className="d-flex align-items-center gap-2 flex-wrap">
      <div style={{ maxWidth: 340, flex: "1 1 260px" }}>
        <InputGroup>
          <InputGroup.Addon>
            <FontAwesomeIcon icon={faMagnifyingGlass} />
          </InputGroup.Addon>
          {/* Fully controlled by the parent, like the receivables toolbar's
              box: a local mirror buys nothing without a debounce and goes stale
              on reset, leaving a term on screen that is no longer applied. */}
          <Input
            type="search"
            placeholder="Search by amount, reference, payer, or voucher name"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
          />
        </InputGroup>
      </div>

      {/* Both Selects are boxed to a width. Blueprint's Select.Trigger is a
          block that fills its parent, so bare in a flex row each one claimed a
          line of its own and pushed the toolbar to three rows. */}

      {/* Grain: how finely the chart cuts the year. Filters no row. */}
      <div style={{ width: 132 }}>
        <Select
          value={filters.grain}
          onValueChange={(v) => onChange({ ...filters, grain: v as ChartGrain })}
        >
          <Select.Trigger>
            {/* The label as children, not a bare Select.Value — Value renders
                the raw stored value, which here is the lower-cased key. */}
            <Select.Value>
              {CHART_GRAINS.find((g) => g.value === filters.grain)?.label}
            </Select.Value>
          </Select.Trigger>
          <Select.Content>
            {CHART_GRAINS.map((g) => (
              <Select.Item key={g.value} value={g.value}>
                {g.label}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
      </div>

      {/* Year: narrows the chart and the table together, so the bars always
          foot to the rows beneath them. */}
      <div style={{ width: 118 }}>
        <Select
          value={String(filters.year)}
          onValueChange={(v) =>
            onChange({ ...filters, year: v === "all" ? "all" : Number(v) })
          }
        >
          <Select.Trigger>
            <Select.Value>{yearLabel(filters.year)}</Select.Value>
          </Select.Trigger>
          <Select.Content>
            {years.map((y) => (
              <Select.Item key={y} value={String(y)}>
                {String(y)}
              </Select.Item>
            ))}
            {/* Without this a deposit that landed outside every offered year
                would be unreachable — an index whose rows cannot all be found
                is worse than an extra option. */}
            <Select.Item value="all">All time</Select.Item>
          </Select.Content>
        </Select>
      </div>

      <BrokerCombobox
        brokerNames={brokerNames}
        selected={filters.brokers}
        onChange={(brokers) => onChange({ ...filters, brokers })}
      />

      <OfficesDropdown noun="deposit" />

      {facets.map((facet) => (
        <FacetDropdown key={facet.id} facet={facet} className={SELECT_LOOK} />
      ))}
    </div>
  );
}
