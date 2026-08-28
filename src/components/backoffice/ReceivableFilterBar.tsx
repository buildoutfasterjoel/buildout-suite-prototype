import { useState } from "react";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Combobox } from "@buildoutinc/blueprint-react/ui/Combobox";
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

/**
 * What makes a facet trigger read as one of Blueprint's Selects.
 *
 * `form-select` is the class `Select.Trigger` itself carries, and
 * `hidden-indicator` is the modifier it pairs with it — that combination drops
 * the background-image caret and the padding reserved for it, leaving the
 * component's own `<FontAwesomeIcon>` to sit at the right edge under
 * `.form-select svg { margin-left: auto }`. Applied to the facet buttons so the
 * whole toolbar reads as one family rather than as Selects beside Buttons.
 *
 * `w-auto` is not optional: `.form-select` is `width: 100%`, which is right for
 * a form field in a column and wrong for a toolbar control — without it every
 * facet claims a row of its own and the bar becomes six stacked lines.
 */
const SELECT_LOOK = "form-select hidden-indicator w-auto";

/**
 * The facets rendered as checkbox dropdowns. `brokers` is deliberately absent —
 * it is a combobox now, and it writes its Set directly.
 */
type FacetKey = "statuses" | "stages" | "dealTypes" | "propertyTypes";

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
              className={`d-inline-flex align-items-center gap-2 text-nowrap ${SELECT_LOOK}`}
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
 * The Brokers filter — a multi-select combobox rather than a checkbox facet.
 *
 * The one facet whose options are *names drawn from the book* rather than a
 * fixed vocabulary. That list grows with the brokerage, and a popover of
 * checkboxes stops working the moment it is longer than a screen; typing to
 * narrow is the only thing that scales. The chips also state the current
 * selection in the toolbar itself, which a "2" badge on a closed dropdown
 * cannot.
 *
 * `value` is derived from the Set on every render rather than mirrored in local
 * state, so a reset from the empty state clears the chips too.
 */
function BrokerCombobox({
  brokerNames,
  selected,
  onChange,
}: {
  brokerNames: string[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  // The typed text is genuinely local — it is not a filter, and it is cleared
  // on each pick so the next name starts from the whole list.
  const [inputValue, setInputValue] = useState("");

  return (
    // Grows with its chips but stops before it can push the rest of the toolbar
    // off the row; past the cap the chips wrap inside the control.
    <div style={{ minWidth: 200, maxWidth: 380, flex: "1 1 200px" }}>
      <Combobox
        multiple
        items={brokerNames}
        value={[...selected]}
        inputValue={inputValue}
        onInputValueChange={(v: string) => setInputValue(v)}
        onValueChange={(v: string[]) => {
          onChange(new Set(v));
          setInputValue("");
        }}
      >
        <Combobox.InputGroup>
          <InputGroup.Addon>
            <FontAwesomeIcon icon={faUserGroupSimple} />
          </InputGroup.Addon>
          <Combobox.Chips>
            <Combobox.Value>
              {(value: string[]) => (
                <>
                  {value.map((name) => (
                    <Combobox.Chip key={name}>{name}</Combobox.Chip>
                  ))}
                  {/* The placeholder doubles as the control's label, which is
                      why it only shows while nothing is picked — with chips in
                      the box, "All Brokers" would be contradicting them. */}
                  <Combobox.Input
                    placeholder={value.length ? "" : "All Brokers"}
                  />
                </>
              )}
            </Combobox.Value>
          </Combobox.Chips>
          <InputGroup.Addon>
            <Combobox.Trigger />
          </InputGroup.Addon>
        </Combobox.InputGroup>
        <Combobox.Content>
          <Combobox.Empty className="text-muted">
            No matching brokers
          </Combobox.Empty>
          <Combobox.List>
            {(item: string) => (
              <Combobox.Item key={item} value={item}>
                {item}
              </Combobox.Item>
            )}
          </Combobox.List>
        </Combobox.Content>
      </Combobox>
    </div>
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

      <FacetDropdown facet={facets[0]} className={SELECT_LOOK} />

      <OfficesDropdown />

      <BrokerCombobox
        brokerNames={brokerNames}
        selected={filters.brokers}
        onChange={(brokers) => onChange({ ...filters, brokers })}
      />

      {facets.slice(1).map((facet) => (
        <FacetDropdown key={facet.id} facet={facet} className={SELECT_LOOK} />
      ))}
    </div>
  );
}
