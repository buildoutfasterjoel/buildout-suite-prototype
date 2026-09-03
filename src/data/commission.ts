/**
 * The Sale Price / Gross Commission % / Gross Commission $ trio, with sale price
 * as the anchor. Both the Under Contract stage gate and the Deal form's
 * Transaction Terms group use these so the math is identical in both places.
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

import type { DealBroker, Listing, PropertyStatus } from "./types";

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

/**
 * How a deal's net commission divides between the brokers on it.
 *
 * One rule for both sides: **`commissionSplitPct` is a share of the same pool**,
 * the commission net of pre-split deductions. So the percentages across both
 * lists sum to 100, and the grosses sum to the net.
 *
 * The order matters, and it is the order the money actually leaves. A co-broke
 * is settled off the top, and the house's own people divide what is left — so
 * the outside brokers are paid first here, and the internal ones take the exact
 * remainder rather than a second percentage of the same net. Giving both sides
 * their own slice of the net is the bug this function exists to prevent: a
 * co-broked deal's brokers were owed 135-160% of what the deal had billed, which
 * surfaced as a $0.00 house split on the Deposits index.
 *
 * The remainder is divided by each internal broker's share of the internal
 * total, not by their raw percentage, so the last cent lands somewhere instead
 * of being rounded away. With one internal broker — every seeded deal today —
 * that is simply the whole remainder.
 *
 * Generic over the broker so both the seeded `DealBroker` and a suite's copy of
 * one go through the same arithmetic; only `commissionSplitPct` is read and only
 * `grossCommission` is written.
 */
export function splitNetCommission<
  T extends { commissionSplitPct: number; grossCommission: number },
>({
  outside,
  internal,
  netCommission,
}: {
  outside: T[];
  internal: T[];
  netCommission: number;
}): { outside: T[]; internal: T[] } {
  const paidOutside = outside.map((b) => ({
    ...b,
    grossCommission: Math.round(netCommission * (b.commissionSplitPct / 100)),
  }));

  const remainder =
    netCommission - paidOutside.reduce((total, b) => total + b.grossCommission, 0);
  const internalPct = internal.reduce((total, b) => total + b.commissionSplitPct, 0);
  const paidInternal = internal.map((b) => ({
    ...b,
    // A deal whose internal brokers carry no split between them — the whole
    // co-broke case, or a voucher mid-edit — pays them nothing rather than
    // dividing by zero.
    grossCommission:
      internalPct > 0
        ? Math.round(remainder * (b.commissionSplitPct / internalPct))
        : 0,
  }));

  return { outside: paidOutside, internal: paidInternal };
}

/**
 * The pool both broker lists split: gross commission less every pre-split
 * deduction. `commissionSplitPct` is a share of *this*, on both sides — see
 * {@link splitNetCommission}.
 */
export function dealNetCommission(deal: Listing): number {
  return (
    deal.transaction.commissionAmount - commissionAllocation(deal).deductions
  );
}

/**
 * Re-derive every broker's `grossCommission` from their split % and the deal's
 * current net.
 *
 * Gross $ is derived data that happens to be *stored* on the broker, and until
 * this existed nothing put it back in agreement with the deal. A deal created
 * before its commission was known kept a $0 gross at a 100% split, so entering
 * 3% on the deal later left the voucher drawing the whole gross as unallocated
 * — with a $0 broker split beside it — and the voucher could never be
 * submitted.
 *
 * Percent-of-net for both lists, deliberately NOT
 * {@link splitNetCommission}'s outside-first remainder: the remainder rule
 * always consumes the whole net, which would make `unallocated` structurally
 * zero and the voucher's submit gate meaningless. Here a deal whose brokers
 * account for 60% still reports the other 40% as unallocated, which is the
 * truth the gate exists to state.
 */
export function reconcileBrokerGross(deal: Listing): Listing {
  const net = dealNetCommission(deal);
  const pay = (b: DealBroker): DealBroker => ({
    ...b,
    grossCommission: commissionAmountFromPct(net, b.commissionSplitPct),
  });
  const outsideBrokers = deal.outsideBrokers.map(pay);
  const internalBrokers = deal.internalBrokers.map(pay);

  // A split that accounts for the whole net pays the last internal broker the
  // exact remainder rather than their own rounded percentage. Two brokers on
  // 50% of an odd net each round up, which left the voucher reporting a $1
  // over-allocation that no percentage could clear. The house absorbs the cent
  // for the same reason `splitNetCommission` gives it the remainder: a
  // co-broke's figure is owed to somebody outside the firm.
  //
  // A split that does NOT sum to 100 keeps its shortfall or its excess. That is
  // the truth the voucher's submit gate exists to state, and rounding it into
  // the last broker is what would hide it.
  const totalPct = [...outsideBrokers, ...internalBrokers].reduce(
    (t, b) => t + b.commissionSplitPct,
    0,
  );
  const last = internalBrokers.length - 1;
  if (totalPct === 100 && last >= 0) {
    const others = [...outsideBrokers, ...internalBrokers.slice(0, last)].reduce(
      (t, b) => t + b.grossCommission,
      0,
    );
    internalBrokers[last] = { ...internalBrokers[last], grossCommission: net - others };
  }

  return { ...deal, internalBrokers, outsideBrokers };
}

/**
 * `next`, with every broker's Gross $ re-derived when the deal's net commission
 * moved — the guard {@link reconcileBrokerGross} is always called behind.
 *
 * Only writes that move the net re-derive: typing a broker's Gross $ on the
 * voucher is a legitimate write of its own, and re-deriving on every patch
 * would snap it back to a whole multiple of their percentage.
 */
export function reconcileBrokerGrossIfMoved(prev: Listing, next: Listing): Listing {
  return dealNetCommission(next) === dealNetCommission(prev)
    ? next
    : reconcileBrokerGross(next);
}

/** How a deal's gross commission divides, and what is left over. */
export interface CommissionAllocation {
  /** Taken off the top, before anyone is paid. */
  deductions: number;
  /** The co-broke's share of the net. */
  outside: number;
  /** The house's own brokers' share of the net. */
  internal: number;
  /** deductions + outside + internal. */
  allocated: number;
  /**
   * Gross commission minus everything allocated. Negative when the voucher
   * pays out more than the deal earned — not clamped, because a voucher that
   * over-allocates is as wrong as one that under-allocates, and clamping was
   * exactly what let it read as "Unallocated $0.00" and look settled.
   */
  unallocated: number;
}

/**
 * Where a deal's gross commission has gone — what the voucher's Gross
 * Commission Breakdown draws, and what its Submit gate reads.
 *
 * **Outside brokers count.** The breakdown left them out and reported their
 * co-broke as unallocated money: 9 of the 31 seeded vouchers showed an orange
 * slice for commission that was already paid to a co-broker. Both readers go
 * through here so the figure the broker is blocked on is the figure on screen.
 */
export function commissionAllocation(deal: Listing): CommissionAllocation {
  const total = (amounts: number[]) => amounts.reduce((sum, n) => sum + n, 0);
  const deductions = total(
    deal.transaction.backOffice.preSplitDeductions.map((d) => d.amount),
  );
  const outside = total(deal.outsideBrokers.map((b) => b.grossCommission));
  const internal = total(deal.internalBrokers.map((b) => b.grossCommission));
  const allocated = deductions + outside + internal;
  return {
    deductions,
    outside,
    internal,
    allocated,
    unallocated: deal.transaction.commissionAmount - allocated,
  };
}
