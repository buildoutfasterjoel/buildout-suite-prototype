import { describe, it, expect } from "vitest";
import { composeCallNotes, isThinRecap } from "./callNotes";
import { callRecapFallback } from "#/ai/generate/fallbacks";
import type { CallRecapSpecT } from "#/ai/generate/schemas";

const recap = (over: Partial<CallRecapSpecT> = {}): CallRecapSpecT => ({
  sentiment: "positive",
  keyPoints: ["She found the balloon note", "Open to understanding her options"],
  tasks: [
    { title: "Review the T-12 and rent roll", due: "friday" },
    { title: "Follow up gently", due: null },
  ],
  opportunity: { name: "", address: "" },
  ...over,
});

describe("isThinRecap", () => {
  it("treats real callRecapFallback output as thin (guards the coupling)", () => {
    // If the fallback's wording changes, this fails instead of silently
    // degrading the drafted note back to a one-liner.
    expect(isThinRecap(callRecapFallback([{ speaker: "you", text: "Hi" }], "Rosa"))).toBe(true);
    expect(isThinRecap(callRecapFallback([], "Rosa"))).toBe(true);
  });

  it("treats a substantive recap as not thin", () => {
    expect(isThinRecap(recap())).toBe(false);
  });

  it("treats an empty recap as thin", () => {
    expect(isThinRecap(recap({ keyPoints: [] }))).toBe(true);
    expect(isThinRecap(recap({ keyPoints: ["   "] }))).toBe(true);
  });
});

describe("composeCallNotes", () => {
  it("includes what was discussed AND next steps from the recap's tasks", () => {
    const notes = composeCallNotes({ recap: recap(), firstName: "Rosa" });
    expect(notes).toContain("She found the balloon note.");
    expect(notes).toContain("Open to understanding her options.");
    expect(notes).toContain("Next steps:");
    expect(notes).toContain("- Review the T-12 and rent roll (friday)");
    expect(notes).toContain("- Follow up gently");
  });

  it("omits the next-steps block when the recap carries no tasks", () => {
    const notes = composeCallNotes({ recap: recap({ tasks: [] }), firstName: "Rosa" });
    expect(notes).not.toContain("Next steps:");
    expect(notes).toContain("She found the balloon note.");
  });

  it("uses the hand-authored persona summary when the recap is thin", () => {
    const notes = composeCallNotes({
      recap: callRecapFallback([{ speaker: "you", text: "Hi" }], "Rosa"),
      firstName: "Rosa",
      heroKey: "rosa",
    });
    // Detailed and on-story, not "review the transcript".
    expect(notes).not.toMatch(/review the transcript/i);
    expect(notes).toContain("balloon note");
    expect(notes).toContain("T-12 and rent roll");
    expect(notes).toContain("Next steps:");
  });

  it("prefers the real recap over the persona copy when the AI produced one", () => {
    const notes = composeCallNotes({ recap: recap(), firstName: "Rosa", heroKey: "rosa" });
    expect(notes).toContain("She found the balloon note.");
    expect(notes).not.toContain("Miguel's papers");
  });

  it("still composes something usable for a thin recap with no persona", () => {
    const notes = composeCallNotes({
      recap: callRecapFallback([{ speaker: "you", text: "Hi" }], "Marcus"),
      firstName: "Marcus",
    });
    expect(notes).toContain("Marcus");
    // The fallback's generic follow-up task still lands as an explicit next step.
    expect(notes).toContain("Next steps:");
    expect(notes).toContain("- Follow up with Marcus");
  });
});
