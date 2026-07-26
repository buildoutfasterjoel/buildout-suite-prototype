import { describe, it, expect, vi } from "vitest";

vi.mock("#/ai/generate", () => ({
  generateBov: vi.fn(async () => ({ headline: "H", rationale: "R", occupancyNote: "N" })),
}));

import type { Property, UnderwritingResult } from "#/data/types";
import { useBovDraft, buildBovDraft, bovSummaryText } from "./useBovDraft";

const prop = ({ occupancyPct: 94, name: "Example Plaza", street: "12 King St", financialRecords: [{ occupancyPct: 78 }] } as unknown) as Property;
const result = ({
  strategy: "value-add", sections: [], inputs: { address: "12 King St", askingPrice: 6_200_000, buildingSqFt: 41_000, capRate: 0.058 },
  metrics: [
    { key: "netOperatingIncome", value: 400_000, label: "", display: "", format: "money" },
    { key: "goingInCapRate", value: 0.058, label: "", display: "", format: "percent" },
  ],
} as unknown) as UnderwritingResult;

describe("useBovDraft", () => {
  it("arms, sets, clears", () => {
    useBovDraft.getState().armFor("d1");
    expect(useBovDraft.getState().armedDealId).toBe("d1");
    useBovDraft.getState().clear();
    expect(useBovDraft.getState().armedDealId).toBeNull();
    expect(useBovDraft.getState().draft).toBeNull();
  });
});

describe("buildBovDraft", () => {
  it("computes an occupancy-adjusted range + attaches the generated spec", async () => {
    const d = await buildBovDraft("d1", prop, result);
    expect(d.dealId).toBe("d1");
    expect(d.mismatch.isMismatch).toBe(true);
    expect(d.valueHigh).toBeGreaterThan(d.valueLow);
    expect(d.spec.headline).toBe("H");
  });

  it("carries the property's own name onto the draft", async () => {
    const otherProp = ({ ...prop, name: "The Delgado Building" } as unknown) as Property;
    const d = await buildBovDraft("d1", otherProp, result);
    expect(d.propertyName).toBe("The Delgado Building");
  });
});

describe("bovSummaryText", () => {
  it("mentions the value range and flags the occupancy gap", async () => {
    const d = await buildBovDraft("d1", prop, result);
    const s = bovSummaryText(d);
    expect(s.toLowerCase()).toContain("occupancy");
  });

  it("names the draft's own property, not a hardcoded one", async () => {
    const otherProp = ({ ...prop, name: "The Delgado Building" } as unknown) as Property;
    const d = await buildBovDraft("d1", otherProp, result);
    const s = bovSummaryText(d);
    expect(s).toContain("The Delgado Building");
    expect(s).not.toContain("Example Plaza");
  });
});
