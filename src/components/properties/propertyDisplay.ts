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
  proposal: "Pitching",
  active: "Active",
  "under-contract": "Under Contract",
  closed: "Closed",
  inactive: "Lost",
};

/**
 * Stage indicator color per deal stage. Values are Blueprint palette tokens
 * exposed as CSS variables in `main.scss` (Badge only supports
 * primary/secondary/outline, so stages reference these directly).
 * For translucent fills, wrap in `color-mix()` rather than hex-alpha.
 */
export const STATUS_COLORS: Record<PropertyStatus, string> = {
  proposal: "var(--stage-proposal)", // harvest-gold-500
  active: "var(--stage-active)", // buildout-blue-500
  "under-contract": "var(--stage-under-contract)", // purple-heart-500
  closed: "var(--stage-closed)", // mountain-meadow-500
  inactive: "var(--stage-inactive)", // storm-grey-500
};

export const PROPERTY_TYPES = Object.keys(TYPE_LABELS) as PropertyType[];
export const PROPERTY_STATUSES = Object.keys(STATUS_LABELS) as PropertyStatus[];

export function formatPrice(value: number | null | undefined): string {
  if (value == null) return "—";
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

/** Stable hash so derived display values don't change between renders. */
export function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Deterministic 5-digit reference id shown on cards and the detail header. */
export function getRefId(id: string): number {
  return 10000 + (hash(id) % 90000);
}

/** Deterministic placeholder photo for a property. */
export function getPhotoUrl(id: string, w = 480, h = 280): string {
  return `https://picsum.photos/seed/${id}/${w}/${h}`;
}
