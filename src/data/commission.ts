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

import type { Listing, PropertyStatus } from "./types";

/**
 * The broker/brokerage split applied when a deal doesn't carry its own
 * `personalSplitPct` — the house rate for this prototype.
 */
export const DEFAULT_PERSONAL_SPLIT_PCT = 55;

/**
 * Plausible close-probability range per stage, low → high. The seed spreads
 * demo deals across each range so a stage's cards don't all read identically;
 * live transitions use the single representative value from
 * {@link closeProbabilityForStage}.
 *
 * Closed is certain and Lost is a dead loss, so both are points, not ranges.
 */
export const STAGE_CLOSE_PROBABILITY: Record<PropertyStatus, [number, number]> = {
  proposal: [5, 20],
  active: [25, 55],
  "under-contract": [65, 90],
  closed: [100, 100],
  inactive: [0, 0],
};

/**
 * The close probability a deal takes on when it lands in `stage` — the midpoint
 * of that stage's range. This is what makes the commission forecast move as
 * deals cross the board: the same commission is worth more the closer a deal is
 * to closing, and worth all of it once closed.
 */
export function closeProbabilityForStage(stage: PropertyStatus): number {
  const [low, high] = STAGE_CLOSE_PROBABILITY[stage];
  return Math.round((low + high) / 2);
}

/**
 * The close probability for a stage move. Terminal stages are absolute — Closed
 * is 100%, Lost is 0%, whatever anyone estimated before.
 *
 * Otherwise, advancing takes the higher of the deal's current estimate and the
 * new stage's midpoint. Advancing a deal must never lower its odds, and a broker
 * who hand-raised an Active deal to 95% knows something the stage baseline
 * doesn't — moving it to Under Contract keeps the 95% rather than resetting to
 * 78%. Moving backwards re-baselines to the stage, since a retreat is precisely
 * what disavows the earlier optimism.
 */
export function nextCloseProbability(
  from: PropertyStatus,
  to: PropertyStatus,
  current: number,
): number {
  const target = closeProbabilityForStage(to);
  if (to === "closed" || to === "inactive") return target;
  const advancing = target > closeProbabilityForStage(from);
  return advancing ? Math.max(current, target) : target;
}

/** The two probability-weighted commission figures shown in the forecast stat. */
export interface CommissionForecast {
  /** The logged-in broker's expected take-home, after their split with the house. */
  you: number;
  /** The whole firm's expected gross commission on the deals. */
  brokerage: number;
}

/**
 * Expected commission across a set of deals, each figure discounted by the deal's
 * close probability.
 *
 * "Brokerage" is the full deal gross commission. "You" is what the primary
 * internal broker (treated as the logged-in user) actually takes home: their
 * `grossCommission` (this broker's own share of the deal's commission, as
 * stored on the deal — not guaranteed to be net of every deduction) times
 * their personal split with the house. Similar to the "Broker Split $"
 * calculation on the Financials tab, but the two can diverge when a deal's
 * broker has no `personalSplitPct` set: the Financials tab falls back to 0%,
 * while this falls back to {@link DEFAULT_PERSONAL_SPLIT_PCT} so the pipeline
 * forecast still reads as a plausible take-home instead of zero.
 */
export function commissionForecast(deals: Listing[]): CommissionForecast {
  return deals.reduce<CommissionForecast>(
    (acc, deal) => {
      const p = deal.transaction.closeProbability / 100;
      const broker = deal.internalBrokers[0];
      const split =
        (broker?.personalSplitPct ?? DEFAULT_PERSONAL_SPLIT_PCT) / 100;
      acc.brokerage += deal.transaction.commissionAmount * p;
      acc.you += (broker?.grossCommission ?? 0) * split * p;
      return acc;
    },
    { you: 0, brokerage: 0 },
  );
}
