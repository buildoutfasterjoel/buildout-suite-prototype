import { describe, it, expect } from "vitest";
import { contactBriefFallback } from "./generators";

describe("contactBriefFallback", () => {
  it("echoes the supplied data as the brief", () => {
    const b = contactBriefFallback("NAME: Jane\nROLE: owner");
    expect(b.brief).toContain("Jane");
  });
});
