import {
  faBuilding,
  faStore,
  faWarehouse,
  faBuildings,
  faLayerGroup,
  faMountainSun,
  faHotel,
  faLandmark,
} from "@fortawesome/pro-regular-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import type { PropertyType, PropertyStatus } from "#/data/types";

/** FontAwesome icon per property type (pro-regular). */
export const TYPE_ICONS: Record<PropertyType, IconDefinition> = {
  office: faBuilding,
  retail: faStore,
  industrial: faWarehouse,
  multifamily: faBuildings,
  "mixed-use": faLayerGroup,
  land: faMountainSun,
  hospitality: faHotel,
  "special-purpose": faLandmark,
};

/** Accent color per property type — used for the card header band + map pins. */
export const TYPE_COLORS: Record<PropertyType, string> = {
  office: "#2563eb",
  retail: "#db2777",
  industrial: "#ea580c",
  multifamily: "#7c3aed",
  "mixed-use": "#0891b2",
  land: "#16a34a",
  hospitality: "#d97706",
  "special-purpose": "#475569",
};

export const TYPE_LABELS: Record<PropertyType, string> = {
  office: "Office",
  retail: "Retail",
  industrial: "Industrial",
  multifamily: "Multifamily",
  "mixed-use": "Mixed-Use",
  land: "Land",
  hospitality: "Hospitality",
  "special-purpose": "Special Purpose",
};

export const STATUS_LABELS: Record<PropertyStatus, string> = {
  active: "Active",
  "under-contract": "Under Contract",
  sold: "Sold",
  "off-market": "Off Market",
  "coming-soon": "Coming Soon",
};

/** Status indicator dot color (Badge only supports primary/secondary/outline). */
export const STATUS_COLORS: Record<PropertyStatus, string> = {
  active: "#16a34a",
  "under-contract": "#d97706",
  sold: "#64748b",
  "off-market": "#94a3b8",
  "coming-soon": "#2563eb",
};

export const PROPERTY_TYPES = Object.keys(TYPE_LABELS) as PropertyType[];
export const PROPERTY_STATUSES = Object.keys(STATUS_LABELS) as PropertyStatus[];

export function formatPrice(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

export function formatSqFt(value: number): string {
  return `${value.toLocaleString()} SF`;
}

export function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}
