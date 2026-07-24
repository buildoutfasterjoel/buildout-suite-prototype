import { describe, it, expect } from "vitest";
import { docFallback } from "./generators";

describe("docFallback", () => {
  it("uses the property name as tagline and a safe CTA", () => {
    const d = docFallback("123 Main St");
    expect(d.tagline).toContain("123 Main St");
    expect(d.callToAction.length).toBeGreaterThan(0);
    expect(Array.isArray(d.highlights)).toBe(true);
  });
});
