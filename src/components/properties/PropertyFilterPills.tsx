import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { ContactChip } from "#/components/contacts/ContactChip";
import { TYPE_LABELS, STATUS_LABELS } from "./propertyDisplay";
import {
  EMPTY_FACETS,
  activeFacetKeys,
  type NumRange,
  type PropertyFacetState,
  type StageFacetValue,
} from "./propertyIndexFilters";

interface Pill {
  key: string;
  label: string;
  clear: (f: PropertyFacetState) => PropertyFacetState;
}

const n = (v: number) => v.toLocaleString();

/** `≥ 10,000 SF` · `≤ 50,000 SF` · `10,000 – 50,000 SF`. */
export function rangeLabel(r: NumRange, unit = "", fmt: (v: number) => string = n): string {
  // `%` hugs the number; every other unit gets a space (`10,000 SF`).
  const u = unit === "%" ? "%" : unit ? ` ${unit}` : "";
  if (r.min != null && r.max != null) return `${fmt(r.min)} – ${fmt(r.max)}${u}`;
  if (r.min != null) return `≥ ${fmt(r.min)}${u}`;
  return `≤ ${fmt(r.max as number)}${u}`;
}

const money = (v: number) => `$${n(v)}`;

/** One pill per active facet, worded the way the dropdown labels it. */
function pillFor(f: PropertyFacetState, key: keyof PropertyFacetState): Pill | null {
  const clear = (k: keyof PropertyFacetState) => (prev: PropertyFacetState) =>
    ({ ...prev, [k]: EMPTY_FACETS[k] }) as PropertyFacetState;
  const range = (label: string, r: NumRange, unit = "", fmt?: (v: number) => string): Pill => ({
    key,
    label: `${label}: ${rangeLabel(r, unit, fmt)}`,
    clear: clear(key),
  });
  switch (key) {
    case "types":
      return { key, label: `Type: ${f.types.map((t) => TYPE_LABELS[t]).join(", ")}`, clear: clear(key) };
    case "classes":
      return { key, label: `Class: ${f.classes.join(", ")}`, clear: clear(key) };
    case "buildingSize":
      return range("Building Size", f.buildingSize, "SF");
    case "lotSize":
      return range("Lot Size", f.lotSize, f.lotUnit === "acres" ? "Acres" : "SF");
    case "units":
      return range("Units", f.units);
    case "ceilingHeight":
      return range("Ceiling", f.ceilingHeight, "FT");
    case "yearBuilt":
      return range("Built", f.yearBuilt, "", String);
    case "availableSf":
      return range("Available SF", f.availableSf, "SF");
    case "apn":
      return { key, label: `APN: ${f.apn.trim()}`, clear: clear(key) };
    case "statuses":
      return {
        key,
        label: `Stage: ${f.statuses
          .map((s: StageFacetValue) => (s === "none" ? "No deal" : STATUS_LABELS[s]))
          .join(", ")}`,
        clear: clear(key),
      };
    case "spaceStatuses":
      return { key, label: `Spaces: ${f.spaceStatuses.join(", ")}`, clear: clear(key) };
    case "market":
      return { key, label: `Market: ${f.market}`, clear: clear(key) };
    case "submarket":
      return { key, label: `Submarket: ${f.submarket}`, clear: clear(key) };
    case "city":
      return { key, label: `City: ${f.city.trim()}`, clear: clear(key) };
    case "state":
      return { key, label: `State: ${f.state.trim()}`, clear: clear(key) };
    case "zip":
      return { key, label: `Zip: ${f.zip.trim()}`, clear: clear(key) };
    case "county":
      return { key, label: `County: ${f.county.trim()}`, clear: clear(key) };
    case "activeDeals":
      return { key, label: "Active Deals", clear: clear(key) };
    case "activeListings":
      return { key, label: "Active Listings", clear: clear(key) };
    case "dealTypes":
      return { key, label: f.dealTypes.join(" & "), clear: clear(key) };
    case "salePrice":
      return range("Sales Price", f.salePrice, "", money);
    case "saleYear":
      return range("Sold", f.saleYear, "", String);
    case "pricePerSf":
      return range("Price/SF", f.pricePerSf, "", money);
    case "pricePerUnit":
      return range("Price/Unit", f.pricePerUnit, "", money);
    case "capRate":
      return range("Cap Rate", f.capRate, "%", (v) => String(v));
    case "lotUnit":
      return null;
  }
}

/**
 * Active filters as removable pills under the toolbar — the People index's
 * pattern. This row is the only thing telling you why the result count is what
 * it is, so it renders whenever anything is set and disappears entirely when
 * nothing is.
 */
export function PropertyFilterPills({
  facets,
  onChange,
}: {
  facets: PropertyFacetState;
  onChange: (next: PropertyFacetState) => void;
}) {
  const pills = activeFacetKeys(facets)
    .map((k) => pillFor(facets, k))
    .filter((p): p is Pill => p != null);
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
      <Button variant="ghost" size="sm" onClick={() => onChange(EMPTY_FACETS)}>
        Clear all
      </Button>
    </div>
  );
}
