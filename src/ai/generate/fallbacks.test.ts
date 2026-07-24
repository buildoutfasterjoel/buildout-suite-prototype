import { describe, it, expect } from "vitest";
import { filterFallback } from "./fallbacks";
import { callTurnFallback, callRecapFallback } from "./fallbacks";
import { CallTurnSpec, CallRecapSpec } from "./schemas";

describe("filterFallback", () => {
  it("dumps the query into search with an explanation", () => {
    const f = filterFallback("stale chicago office");
    expect(f.search).toBe("stale chicago office");
    expect(f.savedView).toBe("all");
    expect(f.assetClass).toBeNull();
    expect(f.explanation.toLowerCase()).toContain("stale chicago office");
  });
});

describe("call fallbacks", () => {
  it("callTurnFallback satisfies the schema and never ends the call", () => {
    const f = callTurnFallback();
    expect(CallTurnSpec.safeParse(f).success).toBe(true);
    expect(f.shouldEnd).toBe(false);
  });

  it("callRecapFallback satisfies the schema and drafts one follow-up task", () => {
    const f = callRecapFallback(
      [{ speaker: "you", text: "hi" }, { speaker: "them", text: "hello" }],
      "Marcus",
    );
    expect(CallRecapSpec.safeParse(f).success).toBe(true);
    expect(f.tasks.length).toBeGreaterThanOrEqual(1);
    expect(f.tasks[0].title).toContain("Marcus");
  });
});
