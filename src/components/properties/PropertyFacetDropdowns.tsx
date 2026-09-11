import type { ReactNode } from "react";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Checkbox } from "@buildoutinc/blueprint-react/ui/Checkbox";
import { Field } from "@buildoutinc/blueprint-react/ui/Field";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { Popover } from "@buildoutinc/blueprint-react/ui/Popover";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCaretDown, faFolder } from "@fortawesome/pro-regular-svg-icons";
import { FilterButton } from "#/components/common/FilterButton";
import type { BuildingClass, DealType, PropertyType } from "#/data/types";
import { SPACE_STATUS_PRECEDENCE, type SpaceStatus } from "#/data/propertySpaces";
import { PROPERTY_STATUSES, STATUS_LABELS, TYPE_LABELS } from "./propertyDisplay";
import { SpaceStatusDot } from "./SpaceStatusDot";
import {
  EMPTY_FACETS,
  countActiveFacets,
  type FacetGroup,
  type LotUnit,
  type NumRange,
  type PropertyFacetState,
  type StageFacetValue,
} from "./propertyIndexFilters";

const PROPERTY_TYPES: PropertyType[] = [
  "office",
  "retail",
  "industrial",
  "land",
  "multifamily",
  "mixed-use",
  "special-purpose",
  "hospitality",
];
const BUILDING_CLASSES: BuildingClass[] = ["A+", "A", "B", "C"];

/** A list of checkboxes bound to an array facet. */
function CheckList<T extends string>({
  options,
  value,
  onChange,
  render,
}: {
  options: T[];
  value: T[];
  onChange: (next: T[]) => void;
  render: (v: T) => ReactNode;
}) {
  return (
    <div className="d-flex flex-column gap-1">
      {options.map((opt) => {
        const on = value.includes(opt);
        return (
          <label key={opt} className="d-flex align-items-center gap-2 mb-0" style={{ cursor: "pointer" }}>
            <Checkbox
              checked={on}
              onCheckedChange={(c) => onChange(c === true ? [...value, opt] : value.filter((v) => v !== opt))}
            />
            <span>{render(opt)}</span>
          </label>
        );
      })}
    </div>
  );
}

/** Min / Max inputs bound to a `NumRange`, with an optional trailing unit control. */
function RangeFields({
  label,
  value,
  onChange,
  placeholder = ["Min", "Max"],
  unit,
}: {
  label: string;
  value: NumRange;
  onChange: (next: NumRange) => void;
  placeholder?: [string, string];
  unit?: ReactNode;
}) {
  const num = (s: string) => (s.trim() === "" ? null : Number(s));
  return (
    <Field>
      <Field.Label>{label}</Field.Label>
      <div className="d-flex align-items-center gap-2">
        <Input
          type="number"
          placeholder={placeholder[0]}
          value={value.min ?? ""}
          onChange={(e) => onChange({ ...value, min: num(e.target.value) })}
          aria-label={`${label} minimum`}
        />
        <span className="text-muted">–</span>
        <Input
          type="number"
          placeholder={placeholder[1]}
          value={value.max ?? ""}
          onChange={(e) => onChange({ ...value, max: num(e.target.value) })}
          aria-label={`${label} maximum`}
        />
        {unit}
      </div>
    </Field>
  );
}

/** A fixed-width unit chip beside a range — `SF`, `FT` — or a unit switch. */
function UnitSelect<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <Select items={options} value={value} onValueChange={(v) => onChange(v as T)}>
      <Select.Trigger style={{ width: 96 }}>
        <Select.Value />
      </Select.Trigger>
      <Select.Content>
        {options.map((o) => (
          <Select.Item key={o.value} value={o.value}>
            {o.label}
          </Select.Item>
        ))}
      </Select.Content>
    </Select>
  );
}

function UnitChip({ children }: { children: ReactNode }) {
  return (
    <span className="text-muted fw-semibold flex-shrink-0" style={{ width: 28 }}>
      {children}
    </span>
  );
}

/**
 * One toolbar dropdown: the shared `FilterButton` — grey stroke, going purple
 * with the count in the label when anything in the group is set — and the
 * fields in a Popover beneath.
 */
function FacetPopover({
  label,
  count,
  width = 360,
  children,
}: {
  label: string;
  count: number;
  width?: number;
  children: ReactNode;
}) {
  return (
    <Popover>
      <Popover.Trigger render={<FilterButton label={label} count={count} />} />
      <Popover.Content align="start" className="p-3" style={{ width, maxWidth: "calc(100vw - 32px)" }}>
        {children}
      </Popover.Content>
    </Popover>
  );
}

function GroupHeading({ children }: { children: ReactNode }) {
  return <div className="fw-semibold mb-2">{children}</div>;
}

/**
 * The Properties toolbar's filter dropdowns, after Buildout's own property
 * index: All Properties · Property & Building · Availability · Location · View ·
 * Sale/Lease. Each group's fields are the production ones this data can back
 * (see `propertyIndexFilters.ts` for what was left out and why), plus our
 * Space Availability facet under Availability.
 *
 * Prospecting shows the building facts only — Property Type, Number of Units,
 * Building Size, Lot Size — because a public record has no deals or spaces.
 */
export function PropertyFacetDropdowns({
  mode,
  facets,
  onChange,
  ownedCount,
  markets,
  submarkets,
}: {
  mode: "owned" | "prospect";
  facets: PropertyFacetState;
  onChange: (next: PropertyFacetState) => void;
  ownedCount: number;
  /** Distinct values in the current source, for the Location selects. */
  markets: string[];
  submarkets: string[];
}) {
  const set = <K extends keyof PropertyFacetState>(key: K, value: PropertyFacetState[K]) =>
    onChange({ ...facets, [key]: value });
  const count = (g: FacetGroup) => countActiveFacets(facets, g);

  const typeList = (
    <CheckList
      options={PROPERTY_TYPES}
      value={facets.types}
      onChange={(v) => set("types", v)}
      render={(t) => TYPE_LABELS[t]}
    />
  );
  const buildingSize = (
    <RangeFields
      label="Building Size"
      value={facets.buildingSize}
      onChange={(v) => set("buildingSize", v)}
      unit={<UnitChip>SF</UnitChip>}
    />
  );
  const lotSize = (
    <RangeFields
      label="Lot Size"
      value={facets.lotSize}
      onChange={(v) => set("lotSize", v)}
      unit={
        <UnitSelect<LotUnit>
          value={facets.lotUnit}
          options={[
            { value: "sf", label: "SF" },
            { value: "acres", label: "Acres" },
          ]}
          onChange={(v) => set("lotUnit", v)}
        />
      }
    />
  );
  const units = <RangeFields label="Number of Units" value={facets.units} onChange={(v) => set("units", v)} />;

  if (mode === "prospect") {
    return (
      <>
        <FacetPopover label="Property Type" count={facets.types.length > 0 ? 1 : 0} width={260}>
          {typeList}
        </FacetPopover>
        <FacetPopover label="Number of Units" count={countActiveFacets({ ...EMPTY_FACETS, units: facets.units })} width={320}>
          {units}
        </FacetPopover>
        <FacetPopover
          label="Building Size"
          count={countActiveFacets({ ...EMPTY_FACETS, buildingSize: facets.buildingSize })}
          width={340}
        >
          {buildingSize}
        </FacetPopover>
        <FacetPopover
          label="Lot Size"
          count={countActiveFacets({ ...EMPTY_FACETS, lotSize: facets.lotSize })}
          width={380}
        >
          {lotSize}
        </FacetPopover>
      </>
    );
  }

  return (
    <>
      {/* The saved-view selector leads the row and carries a real count. Inert:
          saved views are not built. */}
      <Button variant="outline" className="filter-btn">
        <FontAwesomeIcon icon={faFolder} />
        All Properties ({ownedCount})
        <FontAwesomeIcon icon={faCaretDown} />
      </Button>

      <FacetPopover label="Property & Building" count={count("property")} width={640}>
        <div className="row g-4">
          <div className="col-6 d-flex flex-column gap-3">
            <div>
              <GroupHeading>Property Type</GroupHeading>
              {typeList}
            </div>
            <div>
              <GroupHeading>Building Class</GroupHeading>
              <CheckList
                options={BUILDING_CLASSES}
                value={facets.classes}
                onChange={(v) => set("classes", v)}
                render={(c) => c}
              />
            </div>
            <Field>
              <Field.Label>APN Number</Field.Label>
              <Input placeholder="Parcel Number" value={facets.apn} onChange={(e) => set("apn", e.target.value)} />
            </Field>
          </div>
          <div className="col-6 d-flex flex-column gap-3">
            <GroupHeading>Building Information</GroupHeading>
            {buildingSize}
            <div className="form-text mt-n2">
              The building, or any space in it. Matching spaces unfold under the row.
            </div>
            {lotSize}
            {units}
            <RangeFields
              label="Ceiling Height"
              value={facets.ceilingHeight}
              onChange={(v) => set("ceilingHeight", v)}
              unit={<UnitChip>FT</UnitChip>}
            />
            <RangeFields
              label="Year Built"
              value={facets.yearBuilt}
              onChange={(v) => set("yearBuilt", v)}
              placeholder={["Year", "Year"]}
            />
            <RangeFields
              label="Available SF"
              value={facets.availableSf}
              onChange={(v) => set("availableSf", v)}
              placeholder={["Available SF", "Available SF"]}
              unit={<UnitChip>SF</UnitChip>}
            />
          </div>
        </div>
      </FacetPopover>

      <FacetPopover label="Availability" count={count("availability")} width={520}>
        <div className="row g-4">
          <div className="col-6">
            <GroupHeading>Deal Stage</GroupHeading>
            <CheckList<StageFacetValue>
              options={[...PROPERTY_STATUSES, "none"]}
              value={facets.statuses}
              onChange={(v) => set("statuses", v)}
              render={(s) => (s === "none" ? "No deal" : STATUS_LABELS[s])}
            />
          </div>
          <div className="col-6">
            <GroupHeading>Space Availability</GroupHeading>
            <CheckList<SpaceStatus>
              options={[...SPACE_STATUS_PRECEDENCE]}
              value={facets.spaceStatuses}
              onChange={(v) => set("spaceStatuses", v)}
              render={(s) => <SpaceStatusDot status={s} />}
            />
            <div className="form-text mt-2">
              Buildings with at least one space in this state. Matching spaces unfold under the row.
            </div>
          </div>
        </div>
      </FacetPopover>

      <FacetPopover label="Location" count={count("location")} width={420}>
        <div className="d-flex flex-column gap-3">
          <Field>
            <Field.Label>Market</Field.Label>
            <Select
              items={[{ value: "", label: "Select a Market" }, ...markets.map((m) => ({ value: m, label: m }))]}
              value={facets.market}
              onValueChange={(v) => set("market", (v as string) ?? "")}
            >
              <Select.Trigger>
                <Select.Value>{(v) => (v ? String(v) : "Select a Market")}</Select.Value>
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="">Select a Market</Select.Item>
                {markets.map((m) => (
                  <Select.Item key={m} value={m}>
                    {m}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </Field>
          <Field>
            <Field.Label>Submarket</Field.Label>
            <Select
              items={[{ value: "", label: "Select a Submarket" }, ...submarkets.map((m) => ({ value: m, label: m }))]}
              value={facets.submarket}
              onValueChange={(v) => set("submarket", (v as string) ?? "")}
            >
              <Select.Trigger>
                <Select.Value>{(v) => (v ? String(v) : "Select a Submarket")}</Select.Value>
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="">Select a Submarket</Select.Item>
                {submarkets.map((m) => (
                  <Select.Item key={m} value={m}>
                    {m}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </Field>
          <div className="row g-2">
            <div className="col-7">
              <Field>
                <Field.Label>City</Field.Label>
                <Input value={facets.city} onChange={(e) => set("city", e.target.value)} />
              </Field>
            </div>
            <div className="col-5">
              <Field>
                <Field.Label>State</Field.Label>
                <Input value={facets.state} onChange={(e) => set("state", e.target.value)} />
              </Field>
            </div>
            <div className="col-5">
              <Field>
                <Field.Label>Zip</Field.Label>
                <Input value={facets.zip} onChange={(e) => set("zip", e.target.value)} />
              </Field>
            </div>
            <div className="col-7">
              <Field>
                <Field.Label>County</Field.Label>
                <Input value={facets.county} onChange={(e) => set("county", e.target.value)} />
              </Field>
            </div>
          </div>
        </div>
      </FacetPopover>

      <FacetPopover label="View" count={count("view")} width={260}>
        <div className="d-flex flex-column gap-2">
          <label className="d-flex align-items-center gap-2 mb-0" style={{ cursor: "pointer" }}>
            <Checkbox checked={facets.activeDeals} onCheckedChange={(c) => set("activeDeals", c === true)} />
            <span>Active Deals</span>
          </label>
          <label className="d-flex align-items-center gap-2 mb-0" style={{ cursor: "pointer" }}>
            <Checkbox checked={facets.activeListings} onCheckedChange={(c) => set("activeListings", c === true)} />
            <span>Active Listings</span>
          </label>
        </div>
      </FacetPopover>

      <FacetPopover label="Sale/Lease" count={count("saleLease")} width={420}>
        <div className="d-flex flex-column gap-3">
          <CheckList<DealType>
            options={["Sale", "Lease"]}
            value={facets.dealTypes}
            onChange={(v) => set("dealTypes", v)}
            render={(t) => t}
          />
          <RangeFields label="Sales Price" value={facets.salePrice} onChange={(v) => set("salePrice", v)} />
          <RangeFields
            label="Sale Date"
            value={facets.saleYear}
            onChange={(v) => set("saleYear", v)}
            placeholder={["Year", "Year"]}
          />
          <RangeFields label="Price/SF" value={facets.pricePerSf} onChange={(v) => set("pricePerSf", v)} />
          <RangeFields label="Price/Unit" value={facets.pricePerUnit} onChange={(v) => set("pricePerUnit", v)} />
          <RangeFields
            label="Cap Rate"
            value={facets.capRate}
            onChange={(v) => set("capRate", v)}
            unit={<UnitChip>%</UnitChip>}
          />
        </div>
      </FacetPopover>
    </>
  );
}
