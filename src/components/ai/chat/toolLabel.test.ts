import { describe, expect, it } from "vitest";
import { toolLabel, SUITE_TOOL_LABELS } from "./toolLabel";

describe("toolLabel", () => {
  it("uses the shared map", () => {
    expect(toolLabel("draft_email")).toBe("Drafting email");
  });

  it("lets an extra map win over the shared one", () => {
    expect(toolLabel("draft_email", { draft_email: "Writing it" })).toBe("Writing it");
  });

  it("falls back to a de-snaked name for an unmapped tool", () => {
    expect(toolLabel("some_new_tool")).toBe("Some new tool");
  });

  it("splits camelCase in the fallback", () => {
    expect(toolLabel("readPage")).toBe("Read page");
  });

  it("keeps every label the suite rail already had", () => {
    expect(Object.keys(SUITE_TOOL_LABELS).length).toBeGreaterThan(25);
  });
});
