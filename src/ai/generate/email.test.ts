import { describe, it, expect } from "vitest";
import { emailFallback } from "./generators";

describe("emailFallback", () => {
  it("produces a not-configured draft with a usable subject/body", () => {
    const e = emailFallback("price reduction", "123 Main St");
    expect(e.subject.length).toBeGreaterThan(0);
    expect(e.body.length).toBeGreaterThan(0);
    expect(Array.isArray(e.to)).toBe(true);
  });
});
