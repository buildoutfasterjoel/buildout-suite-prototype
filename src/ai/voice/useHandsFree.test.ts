import { describe, it, expect } from "vitest";
import { assembleTranscript } from "./useHandsFree";

describe("assembleTranscript", () => {
  it("joins all segments in order (continuous mode keeps earlier words)", () => {
    expect(assembleTranscript([
      { transcript: "call " }, { transcript: "Marcus " }, { transcript: "today" },
    ])).toBe("call Marcus today");
  });
  it("collapses whitespace and trims", () => {
    expect(assembleTranscript([{ transcript: "  hey   " }, { transcript: " there " }])).toBe("hey there");
  });
  it("returns empty string for no segments", () => {
    expect(assembleTranscript([])).toBe("");
  });
});
