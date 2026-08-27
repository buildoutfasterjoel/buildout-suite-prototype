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

  it("splits the headline from the detail so the card can stack them", () => {
    const r = composeRecapReport(
      {
        sentiment: "positive",
        keyPoints: ["Owner open to a valuation.", "Wants comps first."],
        tasks: [],
        opportunity: { name: "", address: "" },
      },
      "Rosa Delgado",
    );
    expect(r.headline).toContain("Rosa Delgado");
    expect(r.headline).not.toContain("Owner open to a valuation.");
    expect(r.detail).toBe("Owner open to a valuation. Wants comps first.");
    // `message` stays headline + detail — it's what gets spoken.
    expect(r.message).toBe(`${r.headline} ${r.detail}`);
  });

  it("leaves the detail empty (and the message just the headline) with no key points", () => {
    const r = composeRecapReport(
      { sentiment: "neutral", keyPoints: ["  "], tasks: [], opportunity: { name: "", address: "" } },
      "Jane Doe",
    );
    expect(r.detail).toBe("");
    expect(r.message).toBe(r.headline);
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
