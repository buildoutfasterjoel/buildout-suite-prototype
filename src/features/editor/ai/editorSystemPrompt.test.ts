import { describe, expect, it } from "vitest";
import { buildEditorSystemPrompt } from "./editorSystemPrompt";
import { TEMPLATES } from "../templates";

describe("buildEditorSystemPrompt", () => {
  it("lists every designer template key, so the catalog can't drift from the gallery", () => {
    const prompt = buildEditorSystemPrompt();
    for (const template of TEMPLATES) {
      expect(prompt).toContain(template.key);
      expect(prompt).toContain(template.name);
    }
  });

  it("appends the live context when given", () => {
    const prompt = buildEditorSystemPrompt('{"document":{"name":"Proposal"}}');
    expect(prompt).toContain("CURRENT DOCUMENT");
    expect(prompt).toContain('"name":"Proposal"');
  });

  it("omits the context block when none is given", () => {
    expect(buildEditorSystemPrompt()).not.toContain("CURRENT DOCUMENT");
  });

  it("teaches the token syntax rather than leaving it to be guessed", () => {
    expect(buildEditorSystemPrompt()).toContain("{{property.city}}");
  });

  it("tells the agent to report an unfrozen layout rather than unfreezing silently", () => {
    const prompt = buildEditorSystemPrompt();
    expect(prompt).toContain("unlockedPages");
  });

  it("declines the capabilities this pass does not have", () => {
    const prompt = buildEditorSystemPrompt();
    const lower = prompt.toLowerCase();
    // Styling, photos, export/save/send and undo are out of scope — the prompt
    // must say so for each, rather than let the model promise them. Matched on
    // the substantive noun so the assertion survives a wording tweak, but can't
    // pass with the LIMITS section gutted to a single unrelated "cannot".
    expect(lower).toContain("cannot");
    expect(lower).toContain("styling");
    expect(lower).toContain("photo");
    expect(lower).toContain("export");
    expect(lower).toContain("undo");
  });
});
