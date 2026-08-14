import { describe, expect, it } from "vitest";
import { formatCalcAmount, formatCalcPercent } from "#/components/deals/edit/calcFormat";

describe("formatCalcAmount", () => {
  it("is blank, not '0', when there is no value", () => {
    expect(formatCalcAmount(null)).toBe("");
  });

  it("rounds and groups thousands", () => {
    expect(formatCalcAmount(3412282.4)).toBe("3,412,282");
    expect(formatCalcAmount(170614.5)).toBe("170,615");
  });

  it("formats a real zero as 0", () => {
    expect(formatCalcAmount(0)).toBe("0");
  });
});

describe("formatCalcPercent", () => {
  it("is blank, not '0.00%', when there is no value", () => {
    expect(formatCalcPercent(null)).toBe("");
  });

  it("carries two decimals and a percent sign", () => {
    expect(formatCalcPercent(5.5)).toBe("5.50%");
  });
});
