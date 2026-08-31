import { describe, it, expect } from "vitest";
import type { Property, UnderwritingResult } from "#/data/types";
import { bovPricingFor, bovRangeText } from "./bovPricing";

const prop = ({ occupancyPct: 94, name: "Example Plaza", street: "12 King St", financialRecords: [{ occupancyPct: 78 }] } as unknown) as Property;
const evenProp = ({ ...prop, name: "Steady Court", financialRecords: [{ occupancyPct: 92 }] } as unknown) as Property;
const result = ({
  strategy: "value-add", sections: [], inputs: { address: "12 King St", askingPrice: 6_200_000, buildingSqFt: 41_000, capRate: 0.058 },
  metrics: [
    { key: "netOperatingIncome", value: 400_000, label: "", display: "", format: "money" },
    { key: "goingInCapRate", value: 0.058, label: "", display: "", format: "percent" },
  ],
} as unknown) as UnderwritingResult;

describe("bovPricingFor", () => {
  it("computes an occupancy-adjusted range and names the gap", () => {
    const p = bovPricingFor(prop, result);
    expect(p.mismatch.isMismatch).toBe(true);
    expect(p.valueHigh).toBeGreaterThan(p.valueLow);
    expect(p.occupancyNote).toContain("94%");
    expect(p.occupancyNote).toContain("78%");
    // The note has to say the range already accounts for the gap, or it reads
    // as a caveat undermining the number instead of explaining it.
    expect(p.occupancyNote).toMatch(/underwritten to the lower/i);
  });

  it("says nothing about occupancy when the books agree", () => {
    expect(bovPricingFor(evenProp, result).occupancyNote).toBe("");
  });

  it("carries the property's own name", () => {
    expect(bovPricingFor(evenProp, result).propertyName).toBe("Steady Court");
  });

  /**
   * The hole this module closes: the wizard's email used to price off
   * `askingPrice * 0.97 … * 1.05` while claiming to be drafted from the
   * underwrite. A range that just brackets the asking price means the
   * underwriting changed nothing, which is the bug.
   */
  it("prices off the underwrite, not off the asking price", () => {
    const p = bovPricingFor(prop, result);
    const asking = result.inputs.askingPrice;
    expect([p.valueLow, p.valueHigh]).not.toEqual([asking * 0.97, asking * 1.05]);
  });

  /**
   * Pure and synchronous. An async price is what let the email step open with
   * an empty body when a store write cancelled the in-flight request.
   */
  it("is deterministic — same inputs, same numbers, no awaiting", () => {
    expect(bovPricingFor(prop, result)).toEqual(bovPricingFor(prop, result));
  });
});

describe("bovRangeText", () => {
  it("reads as a money range", () => {
    expect(bovRangeText(bovPricingFor(prop, result))).toMatch(/^\$\d+\.\dM – \$\d+\.\dM$/);
  });

  /**
   * A sub-million building has to keep its range. In millions both ends round
   * to the same "$0.2M" and the BOV quotes a range that isn't one.
   */
  it("drops to thousands below a million so the range survives", () => {
    const small = ({
      ...result,
      inputs: { ...result.inputs, askingPrice: 171_000 },
      metrics: [
        { key: "netOperatingIncome", value: 11_800, label: "", display: "", format: "money" },
        { key: "goingInCapRate", value: 0.069, label: "", display: "", format: "percent" },
      ],
    } as unknown) as UnderwritingResult;
    const text = bovRangeText(bovPricingFor(evenProp, small));
    expect(text).toMatch(/^\$\d+K – \$\d+K$/);
    expect(text.split(" – ")[0]).not.toBe(text.split(" – ")[1]);
  });
});
