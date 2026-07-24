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

import type { Listing } from "./types";

/** The two probability-weighted commission figures shown in the forecast stat. */
export interface CommissionForecast {
  /** The logged-in broker's expected share (primary internal broker). */
  you: number;
  /** The whole firm's expected gross commission on the deals. */
  brokerage: number;
}

/**
 * Expected commission across a set of deals, each figure discounted by the deal's
 * close probability. "Brokerage" is the full deal gross commission; "You" is the
 * primary internal broker's share (treated as the logged-in user).
 */
export function commissionForecast(deals: Listing[]): CommissionForecast {
  return deals.reduce<CommissionForecast>(
    (acc, deal) => {
      const p = deal.transaction.closeProbability / 100;
      acc.brokerage += deal.transaction.commissionAmount * p;
      acc.you += (deal.internalBrokers[0]?.grossCommission ?? 0) * p;
      return acc;
    },
    { you: 0, brokerage: 0 },
  );
}
