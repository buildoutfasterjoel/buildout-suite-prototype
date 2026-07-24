import { describe, it, expect } from "vitest";
import type { Property } from "#/data/types";
import type { UnderwritingResult } from "#/data/types";
import { computeOccupancyMismatch, bovValueRange } from "./occupancyMismatch";

const prop = (stated: number, actual?: number): Property =>
  ({ occupancyPct: stated, financialRecords: actual == null ? [] : [{ occupancyPct: actual }] } as unknown as Property);

const result = (noi: number, cap: number): UnderwritingResult =>
  ({
    strategy: "value-add", sections: [], inputs: { address: "x", askingPrice: 6_200_000, buildingSqFt: 41_000, capRate: cap },
    metrics: [
      { key: "netOperatingIncome", label: "NOI", value: noi, display: "", format: "money" },
      { key: "goingInCapRate", label: "Cap", value: cap, display: "", format: "percent" },
    ],
  } as unknown as UnderwritingResult);

describe("computeOccupancyMismatch", () => {
  it("flags a >=10pt gap", () => {
    expect(computeOccupancyMismatch(prop(94, 78))).toEqual({ stated: 94, actual: 78, gapPts: 16, isMismatch: true });
  });
  it("no mismatch when close", () => {
    expect(computeOccupancyMismatch(prop(94, 92)).isMismatch).toBe(false);
  });
  it("no records → actual = stated, no mismatch", () => {
    expect(computeOccupancyMismatch(prop(94)).isMismatch).toBe(false);
  });
});

describe("bovValueRange", () => {
  it("adjusts value down for the actual occupancy, 10k-rounded", () => {
    const m = computeOccupancyMismatch(prop(94, 78));
    const { low, high } = bovValueRange(result(400_000, 0.058), m);
    // adjNoi = 400000 * (78/94) = 331914.9; mid = /0.058 = 5,722,671; low ~5,436,540 high ~6,008,800
    expect(low % 10_000).toBe(0);
    expect(high).toBeGreaterThan(low);
    expect(high).toBeLessThan(6_200_000); // below asking because occupancy is lower than stated
  });
  it("no mismatch → occFactor 1", () => {
    const m = computeOccupancyMismatch(prop(94, 92));
    const { low, high } = bovValueRange(result(400_000, 0.058), m);
    expect(high).toBeGreaterThan(low);
  });
});
