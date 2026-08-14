import { describe, expect, it } from "vitest";
import { visibleDealGroups } from "#/components/deals/edit/dealFormGroups";

const ids = (shape: Parameters<typeof visibleDealGroups>[0]) =>
  visibleDealGroups(shape).map((g) => g.id);

describe("visibleDealGroups", () => {
  it("shows every group for a sale", () => {
    expect(ids("sale")).toEqual(["setup", "terms", "financials"]);
  });

  it("drops financials for every lease shape", () => {
    expect(ids("flat-lease")).not.toContain("financials");
    expect(ids("space")).not.toContain("financials");
    expect(ids("shell")).not.toContain("financials");
  });

  it("drops terms for a shell, whose spaces carry the transactions", () => {
    expect(ids("shell")).toEqual(["setup"]);
  });

  it("keeps terms for a flat lease and a space", () => {
    expect(ids("flat-lease")).toEqual(["setup", "terms"]);
    expect(ids("space")).toEqual(["setup", "terms"]);
  });

  it("always leads with setup", () => {
    for (const shape of ["sale", "flat-lease", "shell", "space"] as const) {
      expect(ids(shape)[0]).toBe("setup");
    }
  });
});
