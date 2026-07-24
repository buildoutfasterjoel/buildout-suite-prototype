import { describe, it, expect } from "vitest";
import { FilterSpec, EmailDraftSpec, CallListSpec, ProspectSpec } from "./schemas";
import { CallTurnSpec, CallRecapSpec } from "./schemas";

describe("schemas", () => {
  it("accepts a valid filter spec", () => {
    const r = FilterSpec.safeParse({
      search: "chicago", savedView: "stale", assetClass: "Office",
      saleLease: "Sale", explanation: "Stale Chicago office for sale.",
    });
    expect(r.success).toBe(true);
  });

  it("rejects an out-of-enum savedView", () => {
    const r = FilterSpec.safeParse({ search: "", savedView: "bogus", assetClass: null, saleLease: null, explanation: "x" });
    expect(r.success).toBe(false);
  });

  it("accepts nullable assetClass/saleLease", () => {
    const r = FilterSpec.safeParse({ search: "", savedView: "all", assetClass: null, saleLease: null, explanation: "Everything." });
    expect(r.success).toBe(true);
  });

  it("clamps call-list score bounds", () => {
    const bad = CallListSpec.safeParse({ headline: "h", calls: [{ contactId: "c1", score: 140, reason: "r" }] });
    expect(bad.success).toBe(false);
  });

  it("requires prospect verdict enum", () => {
    expect(ProspectSpec.safeParse({ verdict: "meh", headline: "h", reasoning: "r" }).success).toBe(false);
    expect(ProspectSpec.safeParse({ verdict: "challenging", headline: "Weak, wrong time", reasoning: "The loan matures in 4 years." }).success).toBe(true);
  });

  it("email body and recipients", () => {
    expect(EmailDraftSpec.safeParse({ subject: "s", to: ["Jane Doe <j@co.com>"], body: "b", signature: "— John" }).success).toBe(true);
  });
});

describe("call schemas", () => {
  it("accepts a valid call turn", () => {
    const r = CallTurnSpec.safeParse({
      ownerReply: "I might consider it.",
      suggestions: ["Great — can I send comps?", "When's a good time?", "No rush at all."],
      shouldEnd: false,
    });
    expect(r.success).toBe(true);
  });

  it("rejects more than 3 suggestions", () => {
    const r = CallTurnSpec.safeParse({
      ownerReply: "ok", suggestions: ["a", "b", "c", "d"], shouldEnd: false,
    });
    expect(r.success).toBe(false);
  });

  it("accepts a valid recap with a null opportunity", () => {
    const r = CallRecapSpec.safeParse({
      sentiment: "positive",
      keyPoints: ["Owner open to a valuation."],
      tasks: [{ title: "Send comps", due: "2026-07-28" }, { title: "Call back", due: null }],
      opportunity: null,
    });
    expect(r.success).toBe(true);
  });

  it("rejects an out-of-enum sentiment", () => {
    const r = CallRecapSpec.safeParse({
      sentiment: "curious", keyPoints: [], tasks: [], opportunity: null,
    });
    expect(r.success).toBe(false);
  });
});
