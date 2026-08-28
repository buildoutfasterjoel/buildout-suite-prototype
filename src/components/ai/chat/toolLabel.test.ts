import { describe, expect, it } from "vitest";
import {
  toolLabel,
  toolDoneLabel,
  SUITE_TOOL_LABELS,
  SUITE_TOOL_LABELS_DONE,
} from "./toolLabel";
import { TOOL_DEFS } from "#/ai/toolDefs";

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

describe("toolDoneLabel", () => {
  it("reads a landed call in the past tense", () => {
    expect(toolDoneLabel("getContactDetail")).toBe("Got contact detail");
  });

  it("lets a surface's own done map win", () => {
    expect(toolDoneLabel("readPage", { readPage: "Read the page" })).toBe("Read the page");
  });

  it("falls back to the present-tense label before humanizing", () => {
    // A surface that only named its tools in one tense still reads as its own
    // vocabulary — a slightly-off tense beats a raw identifier.
    expect(toolDoneLabel("addPage", undefined, { addPage: "Adding a page" })).toBe("Adding a page");
  });

  it("falls back to a de-snaked name for a tool in neither map", () => {
    expect(toolDoneLabel("some_new_tool")).toBe("Some new tool");
  });

  it("has a past-tense twin for every present-tense suite label", () => {
    // A tool with a running label and no done label silently reads in the wrong
    // tense once it lands, which nothing else catches.
    for (const name of Object.keys(SUITE_TOOL_LABELS)) {
      expect(SUITE_TOOL_LABELS_DONE[name]).toBeDefined();
    }
  });
});

describe("tool label coverage", () => {
  // The keys are the wire names the model calls, and nothing else reads them —
  // so a key that matches no tool fails silently, in the one place nobody looks:
  // the chip renders a de-snaked raw identifier and looks deliberate. That is
  // exactly how fifteen camelCase tools spent their lives labelled "Get contact
  // detail" while a hand-written "Reading the record" sat unused beside them.
  for (const def of TOOL_DEFS) {
    it(`labels ${def.name} in both tenses`, () => {
      expect(SUITE_TOOL_LABELS[def.name]).toBeDefined();
      expect(SUITE_TOOL_LABELS_DONE[def.name]).toBeDefined();
    });
  }

  it("has no label key that matches no tool", () => {
    const real = new Set<string>(TOOL_DEFS.map((d) => d.name));
    for (const key of Object.keys(SUITE_TOOL_LABELS)) {
      expect({ key, matchesATool: real.has(key) }).toEqual({ key, matchesATool: true });
    }
  });
});
