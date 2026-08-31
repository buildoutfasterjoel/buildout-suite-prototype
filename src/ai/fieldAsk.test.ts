import { describe, it, expect } from "vitest";
import { activityFieldAsk, fieldAskLabel } from "./fieldAsk";

const rosa = { contactId: "c1", fullName: "Rosa Delgado", firstName: "Rosa" };
const ask = (activity: Parameters<typeof activityFieldAsk>[0]["activity"], value: string) =>
  activityFieldAsk({ ...rosa, activity, value });

describe("fieldAskLabel", () => {
  it("names what the click will do on an empty field, per kind", () => {
    expect(fieldAskLabel("note", false)).toBe("Generate Note");
    expect(fieldAskLabel("call", false)).toBe("Generate Call Summary");
    expect(fieldAskLabel("email", false)).toBe("Draft Email");
    expect(fieldAskLabel("tour", false)).toBe("Generate Tour Note");
  });

  it("is Revise once there is something to revise", () => {
    expect(fieldAskLabel("note", true)).toBe("Revise");
    expect(fieldAskLabel("email", true)).toBe("Revise");
  });
});

describe("activityFieldAsk", () => {
  it("labels the chip with the record and the field", () => {
    expect(ask("note", "").label).toBe("Rosa Delgado: Note");
    expect(ask("call", "").label).toBe("Rosa Delgado: Call Summary");
    expect(ask("meeting", "").label).toBe("Rosa Delgado: Meeting Note");
  });

  it("targets the contact and the tab the field lives on", () => {
    expect(ask("tour", "").target).toEqual({
      kind: "contact-activity",
      contactId: "c1",
      activity: "tour",
    });
  });

  it("asks what the field should cover when it is empty, in that field's terms", () => {
    expect(ask("note", "").actions).toEqual([]);
    expect(ask("note", "").opener).toContain("What should this note about Rosa cover?");
    expect(ask("call", "").opener).toContain("What did you and Rosa talk about?");
    expect(ask("email", "").opener).toContain("What should this email to Rosa say?");
  });

  // Whitespace is an empty field, not a note with nothing to say about it —
  // otherwise a stray newline offers three revisions of nothing.
  it("treats a whitespace-only value as empty", () => {
    expect(ask("meeting", "  \n ").actions).toEqual([]);
  });

  it("offers the recap presets once a logged field has a value", () => {
    for (const kind of ["note", "call", "meeting", "tour"] as const) {
      expect(ask(kind, "talked re: 4th st").actions.map((a) => a.label)).toEqual([
        "Shorten",
        "More formal",
        "Clean up the wording",
      ]);
    }
  });

  // An email is addressed TO someone rather than about them, so its revisions
  // are about how it lands, not how it reads back.
  it("gives email its own presets", () => {
    expect(ask("email", "Hi Rosa —").actions.map((a) => a.label)).toEqual([
      "Shorten",
      "Warmer",
      "More direct",
    ]);
  });

  // The value travels in the assistant's CURRENT CONTEXT, not inside the chip
  // prompts — so a preset stays a legible one-liner and follows the broker's
  // edits after the chip was pinned.
  it("keeps the field's text out of the preset prompts", () => {
    const text = "talked re: 4th st, wants Q1";
    const a = ask("note", text);
    for (const action of a.actions) expect(action.prompt).not.toContain(text);
    expect(a.value).toBe(text);
  });

  it("describes the field to the model by name and record", () => {
    expect(ask("call", "").description).toContain("Rosa Delgado");
    expect(ask("call", "").description).toContain("call-summary field");
    expect(ask("email", "").description).toContain("NOT sent");
  });
});
