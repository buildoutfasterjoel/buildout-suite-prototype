import type { Property } from "#/data/types";

/** Stable string hash — used to derive deterministic display facets. */
export function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Sale / Lease and Expiration aren't in the data model, so we derive them
 * deterministically per property. Stable across renders, so counts and
 * filtering behave like real fields for the prototype.
 */
export const SALE_LEASE_OPTIONS = ["Sale", "Lease", "Sale / Lease"] as const;
export type SaleLease = (typeof SALE_LEASE_OPTIONS)[number];

export function getSaleLease(p: Property): SaleLease {
  return SALE_LEASE_OPTIONS[hash(p.id + "sl") % SALE_LEASE_OPTIONS.length];
}

export const EXPIRATION_OPTIONS = [
  "Not Expired",
  "Next 30 Days",
  "Next 60 Days",
  "Expired",
] as const;
export type Expiration = (typeof EXPIRATION_OPTIONS)[number];

export function getExpiration(p: Property): Expiration {
  // Weighted toward "Not Expired" so the spread looks realistic.
  const n = hash(p.id + "exp") % 10;
  if (n < 5) return "Not Expired";
  if (n < 7) return "Next 30 Days";
  if (n < 9) return "Next 60 Days";
  return "Expired";
}
