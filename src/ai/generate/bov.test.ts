import { describe, it, expect } from "vitest";
import { BovSpec } from "./schemas";
import { bovFallback } from "./fallbacks";

describe("bovFallback", () => {
  it("is schema-valid and notes the occupancy gap when present", () => {
    const r = bovFallback(5_400_000, 6_000_000, { isMismatch: true, stated: 94, actual: 78 });
    expect(() => BovSpec.parse(r)).not.toThrow();
    expect(r.occupancyNote).not.toBe("");
  });
  it("empty occupancyNote when no mismatch", () => {
    const r = bovFallback(5_400_000, 6_000_000, { isMismatch: false, stated: 94, actual: 92 });
    expect(r.occupancyNote).toBe("");
  });
});
