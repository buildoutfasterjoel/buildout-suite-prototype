import type { Property, UnderwritingResult } from "#/data/types";
import {
  computeOccupancyMismatch,
  bovValueRange,
  type OccupancyMismatch,
} from "#/components/deals/underwriting/occupancyMismatch";

/**
 * What the BOV is worth and why — priced off the underwriting run the broker
 * just approved, not off the asking price.
 *
 * **Synchronous, deliberately.** This started as an async call that also
 * generated a narrative headline, and the BOV email step awaited it before
 * drafting. Two things were wrong with that. The narrative had no reader once
 * the rail's BOV card was removed — only the range and the occupancy note ever
 * reach the email. And awaiting anything here put a network round-trip between
 * opening the email step and seeing a draft, which raced the wizard's own store
 * writes: the placement step files a document, the listing changes, the pricing
 * effect re-runs and cancels its own in-flight request, and the modal sits
 * empty forever. `computeOccupancyMismatch` and `bovValueRange` are pure. There
 * is nothing here to wait for.
 */
export interface BovPricing {
  propertyName: string;
  valueLow: number;
  valueHigh: number;
  /** Set when marketing's occupancy contradicts the T-12 — worth saying out loud. */
  mismatch: OccupancyMismatch;
  /** The mismatch in a sentence, ready to drop into the email. "" when there isn't one. */
  occupancyNote: string;
}

const money = (n: number) => `$${(n / 1_000_000).toFixed(1)}M`;

/** Price the BOV from the approved run. Pure — same inputs, same numbers. */
export function bovPricingFor(
  property: Property,
  result: UnderwritingResult,
): BovPricing {
  const mismatch = computeOccupancyMismatch(property);
  const { low, high } = bovValueRange(result, mismatch);
  return {
    propertyName: property.name,
    valueLow: low,
    valueHigh: high,
    mismatch,
    // Says what the gap is AND what was done about it. "Marketing shows 94%,
    // the T-12 reflects 78%" on its own reads as a caveat; the second clause is
    // the part that tells the owner the number in front of them already
    // accounts for it.
    occupancyNote: mismatch.isMismatch
      ? `the marketing shows ${mismatch.stated}% occupancy while the T-12 reflects ` +
        `${mismatch.actual}% — a ${mismatch.gapPts}-point gap. The range above is ` +
        `underwritten to the lower in-place figure, not the marketed one.`
      : "",
  };
}

/** "$4.9M – $5.4M" — the headline range, as the BOV email quotes it. */
export function bovRangeText(pricing: BovPricing): string {
  return `${money(pricing.valueLow)} – ${money(pricing.valueHigh)}`;
}
