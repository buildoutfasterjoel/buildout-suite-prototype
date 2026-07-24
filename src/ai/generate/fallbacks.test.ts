import { describe, it, expect } from "vitest";
import { filterFallback } from "./fallbacks";

describe("filterFallback", () => {
  it("dumps the query into search with an explanation", () => {
    const f = filterFallback("stale chicago office");
    expect(f.search).toBe("stale chicago office");
    expect(f.savedView).toBe("all");
    expect(f.assetClass).toBeNull();
    expect(f.explanation.toLowerCase()).toContain("stale chicago office");
  });
});
