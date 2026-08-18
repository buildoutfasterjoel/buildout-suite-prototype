import type { DealMarketing, Property } from "#/data/types";
import type { Cell, DynamicKey } from "./types";

/** Everything a document can bind to — the asset's facts and the deal's copy. */
export interface DocumentData {
  property: Property | undefined;
  marketing: DealMarketing | undefined;
}

/** Human label for each dynamic field — used by layers and the breadcrumb. */
export const DYNAMIC_FIELD_LABELS: Partial<Record<DynamicKey, string>> = {
  name: "Deal Name",
  askingPrice: "Asking Price",
  buildingSqFt: "Building SF",
  lotSqFt: "Lot SF",
  capRate: "Cap Rate",
  noi: "Net Operating Income",
  street: "Street Address",
  city: "City",
  state: "State",
  zip: "Zip Code",
  county: "County",
  propertyType: "Property Type",
  yearBuilt: "Year Built",
  buildingClass: "Building Class",
  parkingSpaces: "Parking Spaces",
  "marketing.saleTitle": "Sale Title",
  "marketing.saleDescription": "Sale Description",
  "marketing.saleBullets": "Sale Bullets",
  "marketing.leaseTitle": "Lease Title",
  "marketing.leaseDescription": "Lease Description",
  "marketing.leaseBullets": "Lease Bullets",
  "marketing.locationDescription": "Location Description",
};

function currency(value: number): string {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

/**
 * The raw value behind a key, before formatting. Row pruning tests this rather
 * than the display string, so a legitimate `0` is never mistaken for missing
 * data the way the em dash would be.
 */
export function resolveFieldValue(key: DynamicKey, data: DocumentData): unknown {
  if (key.startsWith("marketing.")) {
    const field = key.slice("marketing.".length) as keyof DealMarketing;
    return data.marketing?.[field];
  }
  return data.property?.[key as keyof Property];
}

/** Whether a resolved value has nothing to print. `0` and `false` are values. */
export function isEmptyValue(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/** Resolve + format a single bound field. Returns "—" when unavailable. */
export function resolveField(
  key: DynamicKey,
  format: Cell["format"],
  data: DocumentData,
): string {
  const raw = resolveFieldValue(key, data);
  if (isEmptyValue(raw)) return "—";

  switch (format) {
    case "currency":
    case "currencyPerSf":
      return typeof raw === "number" ? currency(raw) : String(raw);
    case "percent":
      return typeof raw === "number" ? `${raw.toFixed(2)}%` : String(raw);
    case "boolean":
      return raw ? "Yes" : "No";
    default:
      if (Array.isArray(raw)) return raw.join(", ");
      return typeof raw === "number" ? raw.toLocaleString("en-US") : String(raw);
  }
}

/**
 * Resolve a cell's display value. Dynamic cells pull live data and apply the
 * cell's format hint; static cells return their own value.
 */
export function resolveDynamic(cell: Cell, data: DocumentData): string {
  if (!cell.dynamicKey) return cell.value;
  return resolveField(cell.dynamicKey, cell.format, data);
}

/** Price per SF derived from the property (not a raw field). */
export function pricePerSf(property: Property | undefined): string {
  if (!property || !property.buildingSqFt) return "—";
  return `$${Math.round(property.askingPrice / property.buildingSqFt).toLocaleString("en-US")}`;
}
