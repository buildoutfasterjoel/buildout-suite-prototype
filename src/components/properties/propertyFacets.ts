import type { Listing } from "#/data/types";

/** Stable string hash — used to derive deterministic display facets. */
export function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export const SALE_LEASE_OPTIONS = ["Sale", "Lease"] as const;
export type SaleLease = (typeof SALE_LEASE_OPTIONS)[number];

/** A listing carries its own Sale / Lease type. */
export function getSaleLease(l: Listing): SaleLease {
  return l.dealType;
}

/**
 * Expiration isn't in the data model, so we derive it deterministically per
 * listing. Stable across renders, so counts and filtering behave like real fields.
 */
export const EXPIRATION_OPTIONS = [
  "Not Expired",
  "Next 30 Days",
  "Next 60 Days",
  "Expired",
] as const;
export type Expiration = (typeof EXPIRATION_OPTIONS)[number];

export function getExpiration(l: Listing): Expiration {
  // Weighted toward "Not Expired" so the spread looks realistic.
  const n = hash(l.id + "exp") % 10;
  if (n < 5) return "Not Expired";
  if (n < 7) return "Next 30 Days";
  if (n < 9) return "Next 60 Days";
  return "Expired";
}
