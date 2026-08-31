import { describe, it, expect } from "vitest";
import { noteFieldAsk } from "./fieldAsk";

const rosa = { contactId: "c1", fullName: "Rosa Delgado", firstName: "Rosa" };

describe("noteFieldAsk", () => {
  it("labels the chip with the record and the field", () => {
    expect(noteFieldAsk({ ...rosa, value: "" }).label).toBe("Rosa Delgado: Note");
  });

  it("asks what the note should cover when the field is empty", () => {
    const ask = noteFieldAsk({ ...rosa, value: "" });
    expect(ask.actions).toEqual([]);
    expect(ask.opener).toContain("What should this note about Rosa cover?");
  });

  // Whitespace is an empty field, not a note with nothing to say about it —
  // otherwise a stray newline offers three revisions of nothing.
  it("treats a whitespace-only value as empty", () => {
    expect(noteFieldAsk({ ...rosa, value: "  \n " }).actions).toEqual([]);
  });

  it("offers the revise presets once there is a value", () => {
    const ask = noteFieldAsk({ ...rosa, value: "talked re: 4th st, wants Q1" });
    expect(ask.actions.map((a) => a.label)).toEqual([
      "Shorten",
      "More formal",
      "Clean up the wording",
    ]);
  });

  // The value travels in the assistant's CURRENT CONTEXT, not inside the chip
  // prompts — so a preset stays a legible one-liner and follows the broker's
  // edits after the chip was pinned.
  it("keeps the note out of the preset prompts", () => {
    const note = "talked re: 4th st, wants Q1";
    const ask = noteFieldAsk({ ...rosa, value: note });
    for (const a of ask.actions) expect(a.prompt).not.toContain(note);
    expect(ask.value).toBe(note);
  });

  it("targets the contact whose note it is", () => {
    const ask = noteFieldAsk({ ...rosa, value: "" });
    expect(ask.target).toEqual({ kind: "contact-note", contactId: "c1" });
    expect(ask.description).toContain("Rosa Delgado");
  });
});
