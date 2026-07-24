import { describe, expect, it } from "vitest";
import type { Listing } from "./types";
import { commissionAmountFromPct, commissionPctFromAmount, commissionForecast } from "./commission";

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
): Listing {
  return {
    transaction: { commissionAmount, closeProbability },
    internalBrokers: grossCommission == null ? [] : [{ grossCommission }],
  } as unknown as Listing;
}

describe("commissionForecast", () => {
  it("returns zeros for an empty deal list", () => {
    expect(commissionForecast([])).toEqual({ you: 0, brokerage: 0 });
  });

  it("weights a single deal by close probability", () => {
    // brokerage = 100000 * 0.5 = 50000; you = 60000 * 0.5 = 30000
    expect(commissionForecast([dealStub(100_000, 50, 60_000)])).toEqual({
      you: 30_000,
      brokerage: 50_000,
    });
  });

  it("sums weighted figures across multiple deals", () => {
    const deals = [
      dealStub(100_000, 50, 60_000), // brokerage 50000, you 30000
      dealStub(200_000, 100, 80_000), // brokerage 200000, you 80000
    ];
    expect(commissionForecast(deals)).toEqual({
      you: 110_000,
      brokerage: 250_000,
    });
  });

  it("contributes 0 to 'you' when a deal has no internal broker", () => {
    expect(commissionForecast([dealStub(100_000, 100, undefined)])).toEqual({
      you: 0,
      brokerage: 100_000,
    });
  });
});
