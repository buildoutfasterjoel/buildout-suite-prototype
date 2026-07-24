import { describe, it, expect } from "vitest";
import { CallBriefSpec } from "./schemas";
import { callBriefFallback } from "./fallbacks";

describe("callBriefFallback", () => {
  it("produces a schema-valid brief from the signal", () => {
    const brief = callBriefFallback("A $4.2M loan matures in 90 days.", "Marcus");
    expect(() => CallBriefSpec.parse(brief)).not.toThrow();
    expect(brief.voicemail).toContain("Marcus");
  });
});
