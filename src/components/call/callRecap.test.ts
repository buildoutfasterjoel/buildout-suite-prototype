import { describe, it, expect } from "vitest";
import { composeRecapReport } from "./callRecap";

describe("composeRecapReport", () => {
  it("leads with sentiment and key points and carries the drafts", () => {
    const r = composeRecapReport(
      {
        sentiment: "positive",
        keyPoints: ["Owner open to a valuation.", "Wants comps first."],
        tasks: [{ title: "Send comps", due: "Thursday" }],
        opportunity: { name: "123 East Bay", address: "123 East Bay St" },
      },
      "Marcus Pinckney",
    );
    expect(r.message).toContain("Marcus Pinckney");
    expect(r.message.toLowerCase()).toContain("positive");
    expect(r.message).toContain("Owner open to a valuation.");
    expect(r.tasks).toHaveLength(1);
    expect(r.opportunity?.address).toBe("123 East Bay St");
  });

  it("maps an empty (no-deal) opportunity to null", () => {
    const r = composeRecapReport(
      { sentiment: "neutral", keyPoints: [], tasks: [], opportunity: { name: "", address: "" } },
      "Jane Doe",
    );
    expect(r.tasks).toHaveLength(0);
    expect(r.opportunity).toBeNull();
    expect(r.message).toContain("Jane Doe");
  });
});
