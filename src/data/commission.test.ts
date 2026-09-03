import { describe, expect, it } from "vitest";
import type { Listing } from "./types";
import {
  commissionAmountFromPct,
  commissionPctFromAmount,
  commissionForecast,
  closeProbabilityForStage,
  nextCloseProbability,
  DEFAULT_PERSONAL_SPLIT_PCT,
  STAGE_CLOSE_PROBABILITY,
  splitNetCommission,
  commissionAllocation,
} from "./commission";

describe("commissionAmountFromPct", () => {
  it("computes whole-dollar commission from a rate", () => {
    expect(commissionAmountFromPct(2_000_000, 3)).toBe(60_000);
  });

  it("rounds to the nearest dollar", () => {
    expect(commissionAmountFromPct(1_234_567, 2.5)).toBe(30_864); // 30864.175 -> 30864
  });

  it("returns 0 for a zero rate", () => {
    expect(commissionAmountFromPct(2_000_000, 0)).toBe(0);
  });
});

describe("commissionPctFromAmount", () => {
  it("computes the implied rate to 2 decimals", () => {
    expect(commissionPctFromAmount(2_000_000, 61_000)).toBe(3.05);
  });

  it("rounds to 2 decimals", () => {
    expect(commissionPctFromAmount(1_234_567, 30_864)).toBe(2.5);
  });

  it("returns 0 when sale price is 0 (avoids divide-by-zero)", () => {
    expect(commissionPctFromAmount(0, 60_000)).toBe(0);
  });

  it("returns 0 when sale price is negative", () => {
    expect(commissionPctFromAmount(-5, 60_000)).toBe(0);
  });
});

/** Minimal Listing stub exposing only the fields commissionForecast reads. */
function dealStub(
  commissionAmount: number,
  closeProbability: number,
  grossCommission: number | undefined,
  personalSplitPct?: number,
): Listing {
  return {
    transaction: { commissionAmount, closeProbability },
    internalBrokers:
      grossCommission == null ? [] : [{ grossCommission, personalSplitPct }],
  } as unknown as Listing;
}

describe("commissionForecast", () => {
  it("returns zeros for an empty deal list", () => {
    expect(commissionForecast([])).toEqual({ you: 0, brokerage: 0 });
  });

  it("weights a single deal by close probability and the broker's split", () => {
    // brokerage = 100000 * 0.5 = 50000; you = 60000 * 0.5 * 0.5 = 15000
    expect(commissionForecast([dealStub(100_000, 50, 60_000, 50)])).toEqual({
      you: 15_000,
      brokerage: 50_000,
    });
  });

  it("sums weighted figures across multiple deals", () => {
    const deals = [
      dealStub(100_000, 50, 60_000, 50), // brokerage 50000, you 15000
      dealStub(200_000, 100, 80_000, 25), // brokerage 200000, you 20000
    ];
    expect(commissionForecast(deals)).toEqual({
      you: 35_000,
      brokerage: 250_000,
    });
  });

  it("falls back to the default house split when the broker has none", () => {
    expect(commissionForecast([dealStub(100_000, 100, 60_000)])).toEqual({
      you: 60_000 * (DEFAULT_PERSONAL_SPLIT_PCT / 100),
      brokerage: 100_000,
    });
  });

  it("takes home nothing on a 0% split", () => {
    expect(commissionForecast([dealStub(100_000, 100, 60_000, 0)])).toEqual({
      you: 0,
      brokerage: 100_000,
    });
  });

  it("contributes 0 to 'you' when a deal has no internal broker", () => {
    expect(commissionForecast([dealStub(100_000, 100, undefined)])).toEqual({
      you: 0,
      brokerage: 100_000,
    });
  });
});

describe("closeProbabilityForStage", () => {
  it("rises monotonically as a deal advances", () => {
    const ladder = [
      closeProbabilityForStage("proposal"),
      closeProbabilityForStage("active"),
      closeProbabilityForStage("under-contract"),
      closeProbabilityForStage("closed"),
    ];
    // This ordering is the whole feature: a deal nearer to closing is worth
    // more of its commission in the forecast.
    expect(ladder).toEqual([...ladder].sort((a, b) => a - b));
    expect(new Set(ladder).size).toBe(ladder.length);
  });

  it("is certain at Closed and worthless at Lost", () => {
    expect(closeProbabilityForStage("closed")).toBe(100);
    expect(closeProbabilityForStage("inactive")).toBe(0);
  });

  it("sits inside its stage's range", () => {
    for (const [stage, [low, high]] of Object.entries(STAGE_CLOSE_PROBABILITY)) {
      const p = closeProbabilityForStage(stage as keyof typeof STAGE_CLOSE_PROBABILITY);
      expect(p).toBeGreaterThanOrEqual(low);
      expect(p).toBeLessThanOrEqual(high);
    }
  });
});

describe("nextCloseProbability", () => {
  it("raises the odds on every forward step", () => {
    const pitching = closeProbabilityForStage("proposal");
    const toActive = nextCloseProbability("proposal", "active", pitching);
    const toUnderContract = nextCloseProbability("active", "under-contract", toActive);
    const toClosed = nextCloseProbability("under-contract", "closed", toUnderContract);

    expect(toActive).toBeGreaterThan(pitching);
    expect(toUnderContract).toBeGreaterThan(toActive);
    expect(toClosed).toBeGreaterThan(toUnderContract);
    expect(toClosed).toBe(100);
  });

  it("keeps a broker's higher estimate when advancing", () => {
    // Hand-raised to 95% on an Active deal: Under Contract's baseline is lower,
    // and advancing must never knock the odds down.
    expect(nextCloseProbability("active", "under-contract", 95)).toBe(95);
  });

  it("re-baselines to the stage when moving backwards", () => {
    expect(nextCloseProbability("under-contract", "active", 95)).toBe(
      closeProbabilityForStage("active"),
    );
  });

  it("is absolute at the terminal stages regardless of prior optimism", () => {
    expect(nextCloseProbability("active", "inactive", 95)).toBe(0);
    expect(nextCloseProbability("proposal", "closed", 5)).toBe(100);
  });

  it("weights the same commission higher as the deal advances", () => {
    const commissionAmount = 100_000;
    const forecastAt = (p: number) =>
      commissionForecast([dealStub(commissionAmount, p, 60_000, 50)]).brokerage;

    const pitching = forecastAt(closeProbabilityForStage("proposal"));
    const active = forecastAt(closeProbabilityForStage("active"));
    const underContract = forecastAt(closeProbabilityForStage("under-contract"));
    const closed = forecastAt(closeProbabilityForStage("closed"));

    expect(active).toBeGreaterThan(pitching);
    expect(underContract).toBeGreaterThan(active);
    expect(closed).toBeGreaterThan(underContract);
    // A closed deal contributes its commission in full.
    expect(closed).toBe(commissionAmount);
  });
});

describe("splitNetCommission", () => {
  const broker = (commissionSplitPct: number) => ({
    commissionSplitPct,
    grossCommission: 0,
  });

  it("gives a lone internal broker the whole net commission", () => {
    const { internal } = splitNetCommission({
      internal: [broker(100)],
      outside: [],
      netCommission: 100_000,
    });
    expect(internal[0].grossCommission).toBe(100_000);
  });

  it("settles the co-broke off the top and leaves the rest to the house", () => {
    const { outside, internal } = splitNetCommission({
      internal: [broker(40)],
      outside: [broker(60)],
      netCommission: 100_000,
    });
    expect(outside[0].grossCommission).toBe(60_000);
    expect(internal[0].grossCommission).toBe(40_000);
  });

  // The bug this function exists to prevent: both sides taking their own slice
  // of the same net paid a co-broked deal's brokers 160% of what it billed.
  it("never pays out more than the net commission, whatever the co-broke", () => {
    for (const coBroke of [40, 50, 60]) {
      const { outside, internal } = splitNetCommission({
        internal: [broker(100 - coBroke)],
        outside: [broker(coBroke)],
        netCommission: 1_763_867,
      });
      const paid = [...outside, ...internal].reduce(
        (total, b) => total + b.grossCommission,
        0,
      );
      expect(paid).toBe(1_763_867);
    }
  });

  it("hands the odd cent to the house rather than rounding it away", () => {
    // 33% of 100 rounds to 33 three times over, leaving 1 unaccounted.
    const { outside, internal } = splitNetCommission({
      internal: [broker(1)],
      outside: [broker(33), broker(33), broker(33)],
      netCommission: 100,
    });
    expect(outside.map((b) => b.grossCommission)).toEqual([33, 33, 33]);
    expect(internal[0].grossCommission).toBe(1);
  });

  it("divides the remainder between two internal brokers by their own shares", () => {
    const { internal } = splitNetCommission({
      internal: [broker(30), broker(10)],
      outside: [broker(60)],
      netCommission: 100_000,
    });
    expect(internal.map((b) => b.grossCommission)).toEqual([30_000, 10_000]);
  });

  it("pays nothing to internal brokers who carry no split at all", () => {
    const { internal } = splitNetCommission({
      internal: [broker(0)],
      outside: [broker(100)],
      netCommission: 100_000,
    });
    expect(internal[0].grossCommission).toBe(0);
  });
});

/** A deal carrying only the four figures `commissionAllocation` reads. */
function allocationStub({
  commissionAmount,
  deductions = [],
  outside = [],
  internal = [],
}: {
  commissionAmount: number;
  deductions?: number[];
  outside?: number[];
  internal?: number[];
}): Listing {
  return {
    transaction: {
      commissionAmount,
      backOffice: { preSplitDeductions: deductions.map((amount) => ({ amount })) },
    },
    outsideBrokers: outside.map((grossCommission) => ({ grossCommission })),
    internalBrokers: internal.map((grossCommission) => ({ grossCommission })),
  } as unknown as Listing;
}

describe("commissionAllocation", () => {
  it("counts the co-broke as allocated, not as leftover money", () => {
    // The bug this function exists to fix: the breakdown summed deductions and
    // internal brokers only, so a co-broked deal reported the outside broker's
    // share as unallocated.
    const deal = allocationStub({
      commissionAmount: 100_000,
      deductions: [10_000],
      outside: [40_000],
      internal: [50_000],
    });
    expect(commissionAllocation(deal)).toEqual({
      deductions: 10_000,
      outside: 40_000,
      internal: 50_000,
      allocated: 100_000,
      unallocated: 0,
    });
  });

  it("reports what nobody has been assigned", () => {
    const deal = allocationStub({ commissionAmount: 100_000, internal: [75_000] });
    expect(commissionAllocation(deal).unallocated).toBe(25_000);
  });

  it("goes negative when more is paid out than the deal earned", () => {
    const deal = allocationStub({
      commissionAmount: 100_000,
      deductions: [10_000],
      internal: [95_000],
    });
    expect(commissionAllocation(deal).unallocated).toBe(-5_000);
  });
});
