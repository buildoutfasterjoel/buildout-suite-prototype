import { describe, it, expect } from "vitest";
import { DraftReplySpec } from "./schemas";
import { draftReplyFallback } from "./fallbacks";

describe("draftReplyFallback", () => {
  it("produces a schema-valid interested reply signed with the first name", () => {
    const r = draftReplyFallback("Marcus");
    expect(() => DraftReplySpec.parse(r)).not.toThrow();
    expect(r.tone).toBe("interested");
    expect(r.body).toContain("Marcus");
  });
});
