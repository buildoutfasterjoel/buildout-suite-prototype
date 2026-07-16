/**
 * The Sale Price / Gross Commission % / Gross Commission $ trio, with sale price
 * as the anchor. Both the Under Contract stage gate and the Edit Transaction
 * dialog use these so the math is identical in both places.
 */

/** Total gross commission $ from a sale price and rate, rounded to whole dollars. */
export function commissionAmountFromPct(salePrice: number, pct: number): number {
  return Math.round((salePrice * pct) / 100);
}

/**
 * Implied gross commission % from a dollar amount, to 2-decimal precision.
 * Returns 0 when salePrice <= 0 to avoid a divide-by-zero / nonsensical rate.
 */
export function commissionPctFromAmount(salePrice: number, amount: number): number {
  if (salePrice <= 0) return 0;
  return Math.round((amount / salePrice) * 10000) / 100;
}
