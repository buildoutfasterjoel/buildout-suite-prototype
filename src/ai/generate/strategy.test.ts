import { describe, it, expect } from "vitest";
import { strategyFallback } from "./generators";

describe("strategyFallback", () => {
  it("returns a non-empty grounded answer string", () => {
    const s = strategyFallback("PIPELINE: 3 open deals\nJane Doe — pitching — no touch in 45 days");
    expect(s.answer.length).toBeGreaterThan(0);
  });
});
