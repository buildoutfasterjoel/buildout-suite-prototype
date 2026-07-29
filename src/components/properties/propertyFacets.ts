import type { Listing } from "#/data/types";
import { hash, spread } from "#/components/properties/propertyDisplay";

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
  const n = spread(hash(`${l.id}#exp`), 10);
  if (n < 5) return "Not Expired";
  if (n < 7) return "Next 30 Days";
  if (n < 9) return "Next 60 Days";
  return "Expired";
}
