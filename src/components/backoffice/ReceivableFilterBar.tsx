import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCaretDown,
  faMagnifyingGlass,
  faUserGroupSimple,
} from "@fortawesome/pro-regular-svg-icons";
import type { DealType, PropertyStatus, PropertyType } from "#/data/types";
import {
  CHART_GRAINS,
  RECEIVABLE_STATUSES,
  type ChartGrain,
  type ReceivableStatus,
} from "#/data/receivables";
import type {
  ReceivableFilterState,
  ReceivableYear,
} from "#/data/receivableFilters";
import {
  FacetDropdown,
  type FacetDropdownFacet,
} from "#/components/properties/FacetDropdown";
import {
  PROPERTY_TYPES,
  PROPERTY_STATUSES,
  STATUS_LABELS,
  TYPE_LABELS,
} from "#/components/properties/propertyDisplay";

const DEAL_TYPES: DealType[] = ["Sale", "Lease"];

/** Every facet whose value is a Set on the filter state. */
type FacetKey =
  | "statuses"
  | "brokers"
  | "stages"
  | "dealTypes"
  | "propertyTypes";

/**
 * The disabled Offices control.
 *
 * Nothing in the data model carries an office — not a deal, not a broker, not a
 * property. It renders greyed rather than being dropped because the reference
 * design carries it and the real product has offices the prototype has not
 * modelled; a control that appears later in a different position is a worse
 * surprise than one that is visibly not ready. The tooltip says why, so it does
 * not read as broken.
 *
 * This and Other Credits are the only two inert controls on the page. Nothing
 * else may join them.
 */
function OfficesDropdown() {
  return (
    <Tooltip>
      <Tooltip.Trigger
        render={
          // A span wrapper, because a disabled button fires no pointer events
          // and would never surface the tooltip that explains it.
          <span className="d-inline-flex">
            <Button
              variant="outline"
              disabled
              className="d-inline-flex align-items-center gap-2 text-nowrap"
            >
              All Offices
              <FontAwesomeIcon icon={faCaretDown} />
            </Button>
          </span>
        }
      />
      <Tooltip.Content>
        Offices aren't set up yet — every receivable is in one book.
      </Tooltip.Content>
    </Tooltip>
  );
}

/**
 * The receivables index's toolbar.
 *
 * Grain and year sit first, next to the search box, because they are the two
 * controls the chart above reads — the facets after them narrow the table and
 * the chart alike, but only these two change what the chart is a picture OF.
 */
export function ReceivableFilterBar({
  filters,
  brokerNames,
  years,
  onChange,
}: {
  filters: ReceivableFilterState;
  /** Every internal broker on the current book, sorted — the Brokers options. */
  brokerNames: string[];
  /** The years any receivable is due in, newest first. */
  years: number[];
  onChange: (next: ReceivableFilterState) => void;
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
      id: "status",
      title: "Status",
      options: RECEIVABLE_STATUSES.map((s) => ({ value: s, label: s })),
      selected: filters.statuses as Set<string>,
      toggle: toggler<ReceivableStatus>("statuses"),
      clear: clearer("statuses"),
    },
    {
      id: "stage",
      title: "Deal Stage",
      options: PROPERTY_STATUSES.map((s) => ({
        value: s,
        label: STATUS_LABELS[s],
      })),
      selected: filters.stages as Set<string>,
      toggle: toggler<PropertyStatus>("stages"),
      clear: clearer("stages"),
    },
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

  const brokerFacet: FacetDropdownFacet = {
    title: "All Brokers",
    options: brokerNames.map((n) => ({ value: n, label: n })),
    selected: filters.brokers as Set<string>,
    toggle: toggler<string>("brokers"),
    clear: clearer("brokers"),
  };

  const yearLabel = (y: ReceivableYear) =>
    y === "all" ? "All time" : String(y);

  return (
    <div className="d-flex align-items-center gap-2 flex-wrap">
      <div style={{ maxWidth: 340, flex: "1 1 260px" }}>
        <InputGroup>
          <InputGroup.Addon>
            <FontAwesomeIcon icon={faMagnifyingGlass} />
          </InputGroup.Addon>
          {/* Fully controlled by the parent, like the voucher toolbar's box: a
              local mirror buys nothing without a debounce and goes stale on
              reset, leaving a term on screen that is no longer applied. */}
          <Input
            type="search"
            placeholder="Search by payer, voucher, invoice number, amount due"
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
            {/* Without this a receivable due outside every offered year would
                be unreachable — an index whose rows cannot all be found is
                worse than an extra option. */}
            <Select.Item value="all">All time</Select.Item>
          </Select.Content>
        </Select>
      </div>

      <FacetDropdown facet={facets[0]} />

      <OfficesDropdown />

      {/* The people icon marks the one facet whose options are names drawn from
          the data rather than a fixed vocabulary. */}
      <FacetDropdown facet={brokerFacet} icon={faUserGroupSimple} />

      {facets.slice(1).map((facet) => (
        <FacetDropdown key={facet.id} facet={facet} />
      ))}
    </div>
  );
}
