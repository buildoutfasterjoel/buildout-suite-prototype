import { describe, expect, it } from "vitest";
import { commissionAmountFromPct, commissionPctFromAmount } from "./commission";

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
