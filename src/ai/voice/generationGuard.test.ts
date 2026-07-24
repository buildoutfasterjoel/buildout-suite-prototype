import { describe, it, expect } from "vitest";
import { createGenerationGuard } from "./generationGuard";

describe("createGenerationGuard", () => {
  it("starts at generation 0 and is current", () => {
    const g = createGenerationGuard();
    expect(g.current()).toBe(0);
    expect(g.isCurrent(0)).toBe(true);
  });

  it("next() invalidates the previous generation", () => {
    const g = createGenerationGuard();
    const mine = g.current();
    g.next();
    expect(g.isCurrent(mine)).toBe(false);
    expect(g.isCurrent(g.current())).toBe(true);
  });
});
