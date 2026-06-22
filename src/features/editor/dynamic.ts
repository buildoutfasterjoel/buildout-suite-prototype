import type { Property } from "#/data/types";
import type { Cell } from "./types";

/** Human label for each dynamic field — used by the future field-insertion UI. */
export const DYNAMIC_FIELD_LABELS: Partial<Record<keyof Property, string>> = {
  name: "Listing Name",
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
};

function currency(value: number): string {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

/** Resolve + format a single listing field. Returns "—" when unavailable. */
export function resolveField(
  key: keyof Property,
  format: Cell["format"],
  listing: Property | undefined,
): string {
  if (!listing) return "—";
  const raw = listing[key];
  if (raw == null) return "—";

  switch (format) {
    case "currency":
      return typeof raw === "number" ? currency(raw) : String(raw);
    case "currencyPerSf": {
      // raw is the per-SF number already; just format as currency.
      return typeof raw === "number" ? currency(raw) : String(raw);
    }
    case "percent":
      return typeof raw === "number" ? `${raw.toFixed(2)}%` : String(raw);
    default:
      return typeof raw === "number" ? raw.toLocaleString("en-US") : String(raw);
  }
}

/**
 * Resolve a cell's display value. Dynamic cells pull live data from the bound
 * listing and apply the cell's format hint; static cells return their value.
 */
export function resolveDynamic(cell: Cell, listing: Property | undefined): string {
  if (!cell.dynamicKey) return cell.value;
  if (!listing) return cell.value || "—";
  return resolveField(cell.dynamicKey, cell.format, listing);
}

/** Price per SF derived from the listing (not a raw field). */
export function pricePerSf(listing: Property | undefined): string {
  if (!listing || !listing.buildingSqFt) return "—";
  return `$${Math.round(listing.askingPrice / listing.buildingSqFt).toLocaleString("en-US")}`;
}
