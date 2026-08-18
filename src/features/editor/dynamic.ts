import type { DealMarketing, Property } from "#/data/types";
import type { Cell, DynamicKey, ListBlock } from "./types";

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

/**
 * Default formatting for an inline token. A whole-block or table-cell binding
 * carries its own `format` hint, but a token written mid-sentence has nowhere to
 * put one and liquid filters are deliberately out of scope — so the format is a
 * property of the field itself. Anything absent here formats as text, which
 * already handles thousands separators and joins arrays.
 */
export const INLINE_FIELD_FORMAT: Partial<Record<DynamicKey, Cell["format"]>> = {
  askingPrice: "currency",
  noi: "currency",
  capRate: "percent",
  yearBuilt: "year",
};

/** One selectable field in the "Insert Field" picker. */
export interface InlineFieldOption {
  key: DynamicKey;
  label: string;
}

/** A titled section of the picker. */
export interface InlineFieldGroup {
  label: string;
  items: InlineFieldOption[];
}

/**
 * The fields the "Insert Field" picker offers, grouped so the list can be
 * skimmed by section rather than read end to end. The keys are the same
 * vocabulary `DYNAMIC_FIELD_LABELS` names; the grouping is presentation only.
 * Labels are resolved here rather than at the call site so the picker can
 * filter on them.
 */
const INLINE_FIELD_KEYS: { label: string; keys: DynamicKey[] }[] = [
  { label: "Deal", keys: ["name"] },
  { label: "Location", keys: ["street", "city", "state", "zip", "county"] },
  {
    label: "Building",
    keys: [
      "propertyType",
      "buildingSqFt",
      "lotSqFt",
      "yearBuilt",
      "buildingClass",
      "parkingSpaces",
    ],
  },
  { label: "Financials", keys: ["askingPrice", "capRate", "noi"] },
  {
    label: "Marketing Copy",
    keys: [
      "marketing.saleTitle",
      "marketing.saleDescription",
      "marketing.saleBullets",
      "marketing.leaseTitle",
      "marketing.leaseDescription",
      "marketing.leaseBullets",
      "marketing.locationDescription",
    ],
  },
];

export const INLINE_FIELD_GROUPS: InlineFieldGroup[] = INLINE_FIELD_KEYS.map(
  (group) => ({
    label: group.label,
    items: group.keys.map((key) => ({
      key,
      label: DYNAMIC_FIELD_LABELS[key] ?? key,
    })),
  }),
);

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
    case "year":
      // Years are identifiers, not quantities — `toLocaleString` would render
      // 1960 as "1,960".
      return String(raw);
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

/** The items a list block renders — its binding when set, else its static items. */
export function resolveList(block: ListBlock, data: DocumentData): string[] {
  if (!block.dynamicKey) return block.items;
  const raw = resolveFieldValue(block.dynamicKey, data);
  return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === "string") : [];
}

/** Price per SF derived from the property (not a raw field). */
export function pricePerSf(property: Property | undefined): string {
  if (!property || !property.buildingSqFt) return "—";
  return `$${Math.round(property.askingPrice / property.buildingSqFt).toLocaleString("en-US")}`;
}
