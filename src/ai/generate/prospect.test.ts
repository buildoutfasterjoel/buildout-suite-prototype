import { describe, it, expect } from "vitest";
import { prospectFallback } from "./generators";
import { ProspectSpec } from "./schemas";

describe("prospectFallback", () => {
  it("returns a schema-valid moderate default", () => {
    const p = prospectFallback();
    expect(ProspectSpec.safeParse(p).success).toBe(true);
    expect(p.verdict).toBe("moderate");
  });
});
