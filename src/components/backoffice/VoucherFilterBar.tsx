import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Calendar } from "@buildoutinc/blueprint-react/ui/Calendar";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { Popover } from "@buildoutinc/blueprint-react/ui/Popover";
import { RadioGroup } from "@buildoutinc/blueprint-react/ui/RadioGroup";
import { Separator } from "@buildoutinc/blueprint-react/ui/Separator";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCaretDown,
  faMagnifyingGlass,
  faUserGroupSimple,
} from "@fortawesome/pro-regular-svg-icons";
import type { DealType, PropertyStatus, PropertyType } from "#/data/types";
import {
  CLOSE_DATE_PRESETS,
  CLOSE_DATE_LABELS,
  type CloseDatePreset,
  type VoucherFilterState,
} from "#/data/voucherFilters";
import {
  VOUCHER_STATUSES,
  VOUCHER_STATUS_LABELS,
  type VoucherStatus,
} from "#/data/vouchers";
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

/** `yyyy-mm-dd` in local time — matches how close dates are stored. */
function isoDay(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** A stored `yyyy-mm-dd` as a local Date, for handing back to the Calendar. */
function fromIsoDay(iso: string | null): Date | undefined {
  if (!iso) return undefined;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function shortDate(iso: string | null): string {
  const d = fromIsoDay(iso);
  return d
    ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "…";
}

/**
 * The date window: a single-select list, plus a range calendar revealed only by
 * the Custom option.
 *
 * The options do not all read the same date — see `CLOSE_DATE_PRESETS` — which
 * is why the two that are about closing say so in their labels.
 *
 * A radio list rather than a Select because the options are sentences, and
 * because Custom has to expand in place — a Select closes on choice, which would
 * shut the calendar the moment you asked for it.
 */
function CloseDateDropdown({
  value,
  from,
  to,
  onChange,
}: {
  value: CloseDatePreset;
  from: string | null;
  to: string | null;
  onChange: (next: {
    closeDate: CloseDatePreset;
    customFrom: string | null;
    customTo: string | null;
  }) => void;
}) {
  // Custom's full label ("Custom range of close date") is a sentence, and as a
  // trigger it pushes the rest of the toolbar onto a second row. Once a range is
  // picked the dates say it more precisely anyway.
  const label =
    value === "custom"
      ? from || to
        ? `${shortDate(from)} – ${shortDate(to)}`
        : "Custom range"
      : CLOSE_DATE_LABELS[value];

  return (
    <Popover>
      <Popover.Trigger
        render={
          <Button
            variant="outline"
            className="d-inline-flex align-items-center gap-2 text-nowrap"
          >
            {label}
            <FontAwesomeIcon icon={faCaretDown} />
          </Button>
        }
      />
      <Popover.Content side="bottom" align="start" sideOffset={6} style={{ minWidth: 260 }}>
        <Popover.Body className="d-flex flex-column gap-2">
          <RadioGroup
            value={value}
            onValueChange={(v) =>
              onChange({
                closeDate: v as CloseDatePreset,
                // Dropping the bounds on the way out of Custom keeps a stale
                // range from silently applying if it is picked again later.
                customFrom: v === "custom" ? from : null,
                customTo: v === "custom" ? to : null,
              })
            }
          >
            {CLOSE_DATE_PRESETS.map((preset) => (
              <label
                key={preset.value}
                className="d-flex align-items-center gap-2 mb-0"
                style={{ cursor: "pointer" }}
              >
                <RadioGroup.Item value={preset.value} />
                <span>{preset.label}</span>
              </label>
            ))}
          </RadioGroup>

          {value === "custom" && (
            <>
              <Separator />
              {/* Rendered inline rather than behind a second popover: a popover
                  inside a popover fights for focus and dismissal. */}
              <Calendar
                mode="range"
                selected={{ from: fromIsoDay(from), to: fromIsoDay(to) }}
                onSelect={(range) =>
                  onChange({
                    closeDate: "custom",
                    customFrom: range?.from ? isoDay(range.from) : null,
                    customTo: range?.to ? isoDay(range.to) : null,
                  })
                }
              />
              <div className="text-muted fs-small">
                {from || to
                  ? `Closed ${shortDate(from)} – ${shortDate(to)}`
                  : "Pick a start and end date."}
              </div>
            </>
          )}
        </Popover.Body>
      </Popover.Content>
    </Popover>
  );
}

/**
 * The voucher index's toolbar.
 *
 * Every dropdown is a real filter over data the rows carry — there is no Offices
 * control, because nothing on a deal references an office, and a control that
 * cannot filter is worse than a missing one. Brokers are drawn from the deals
 * themselves rather than the user roster, for the same reason.
 */
export function VoucherFilterBar({
  filters,
  brokerNames,
  onChange,
}: {
  filters: VoucherFilterState;
  /** Every internal broker on the current book, sorted — the Brokers options. */
  brokerNames: string[];
  onChange: (next: VoucherFilterState) => void;
}) {
  /** Toggle one option inside a facet, returning a fresh Set (never mutating). */
  function toggler<T extends string>(
    key: "statuses" | "dealTypes" | "stages" | "propertyTypes" | "brokers",
  ) {
    return (value: string) => {
      const next = new Set(filters[key] as Set<string>);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      onChange({ ...filters, [key]: next as Set<T> });
    };
  }

  function clearer(
    key: "statuses" | "dealTypes" | "stages" | "propertyTypes" | "brokers",
  ) {
    return () => onChange({ ...filters, [key]: new Set() });
  }

  const facets: (FacetDropdownFacet & { id: string })[] = [
    {
      id: "status",
      title: "Voucher Status",
      options: VOUCHER_STATUSES.map((s) => ({
        value: s,
        label: VOUCHER_STATUS_LABELS[s],
      })),
      selected: filters.statuses as Set<string>,
      toggle: toggler<VoucherStatus>("statuses"),
      clear: clearer("statuses"),
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
  ];

  const brokerFacet: FacetDropdownFacet = {
    title: "All Brokers",
    options: brokerNames.map((n) => ({ value: n, label: n })),
    selected: filters.brokers as Set<string>,
    toggle: toggler<string>("brokers"),
    clear: clearer("brokers"),
  };

  const propertyTypeFacet: FacetDropdownFacet = {
    title: "Property Type",
    options: PROPERTY_TYPES.map((t) => ({ value: t, label: TYPE_LABELS[t] })),
    selected: filters.propertyTypes as Set<string>,
    toggle: toggler<PropertyType>("propertyTypes"),
    clear: clearer("propertyTypes"),
  };

  return (
    <div className="d-flex align-items-center gap-2 flex-wrap">
      <div style={{ maxWidth: 300, flex: "1 1 220px" }}>
        <InputGroup>
          <InputGroup.Addon>
            <FontAwesomeIcon icon={faMagnifyingGlass} />
          </InputGroup.Addon>
          {/* Fully controlled by the parent's filter state — no local mirror.
              A mirror bought nothing (there is no debounce) and went stale on
              reset, leaving the box showing a term that was no longer applied. */}
          <Input
            type="search"
            placeholder="Search name, address, or identifier"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
          />
        </InputGroup>
      </div>

      {facets.map((facet) => (
        <FacetDropdown key={facet.id} facet={facet} />
      ))}

      <CloseDateDropdown
        value={filters.closeDate}
        from={filters.customFrom}
        to={filters.customTo}
        onChange={(next) => onChange({ ...filters, ...next })}
      />

      {/* The people icon marks the one facet whose options are names drawn from
          the data rather than a fixed vocabulary. */}
      <FacetDropdown facet={brokerFacet} icon={faUserGroupSimple} />

      <FacetDropdown facet={propertyTypeFacet} />
    </div>
  );
}

/** Count badge shown beside the toolbar when anything is filtering. */
export function ActiveFilterCount({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <Badge variant="primary">
      {count} {count === 1 ? "filter" : "filters"}
    </Badge>
  );
}
