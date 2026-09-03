import { describe, expect, it } from "vitest";
import {
  QUICK_EDITS,
  fieldSparkleLabel,
  fieldTextFallback,
  fieldTextPrompt,
  instructionPlaceholder,
} from "./fieldText";

const rosa = { fullName: "Rosa Delgado", firstName: "Rosa", contactData: "NAME: Rosa Delgado" };

describe("fieldSparkleLabel", () => {
  it("names what an empty field's sparkle will generate", () => {
    expect(fieldSparkleLabel("note", false)).toBe("Generate Note");
    expect(fieldSparkleLabel("call", false)).toBe("Generate Call Summary");
    expect(fieldSparkleLabel("email", false)).toBe("Draft Email");
    expect(fieldSparkleLabel("tour", false)).toBe("Generate Tour Note");
  });

  it("offers to revise once the field has text", () => {
    expect(fieldSparkleLabel("note", true)).toBe("Revise with AI");
  });
});

describe("instructionPlaceholder", () => {
  it("says Generating... while a run is in flight, whatever the field holds", () => {
    expect(instructionPlaceholder("generating", false)).toBe("Generating...");
    expect(instructionPlaceholder("generating", true)).toBe("Generating...");
  });

  it("asks for a change once the field has text, and for a brief before", () => {
    expect(instructionPlaceholder("idle", true)).toBe("Describe your change");
    expect(instructionPlaceholder("idle", false)).toBe("What should be written?");
  });
});

describe("QUICK_EDITS", () => {
  it("is the three one-click revisions, in menu order", () => {
    expect(QUICK_EDITS.map((q) => q.label)).toEqual([
      "More Formal",
      "Friendlier",
      "Shorten",
    ]);
  });
});

describe("fieldTextPrompt", () => {
  it("scopes the system prompt to the field and carries the record", () => {
    const { system } = fieldTextPrompt({
      ...rosa,
      activity: "call",
      instruction: "summarize",
      current: "",
    });
    expect(system).toContain("call-summary field");
    expect(system).toContain("Rosa Delgado's contact page");
    expect(system).toContain("NAME: Rosa Delgado");
    expect(system).toContain("field text only");
  });

  it("puts the current text and the instruction in the user turn", () => {
    const { user } = fieldTextPrompt({
      ...rosa,
      activity: "note",
      instruction: "Shorten this.",
      current: "Met Rosa. Talked pricing.",
    });
    expect(user).toContain("CURRENT FIELD TEXT:\nMet Rosa. Talked pricing.");
    expect(user).toContain("INSTRUCTION:\nShorten this.");
  });

  it("marks an empty field as empty rather than sending a blank", () => {
    const { user } = fieldTextPrompt({ ...rosa, activity: "note", instruction: "x", current: "  " });
    expect(user).toContain("CURRENT FIELD TEXT:\n(empty)");
  });

  it("tells the email field to write a body and no subject", () => {
    const { system } = fieldTextPrompt({ ...rosa, activity: "email", instruction: "x", current: "" });
    expect(system).toContain("never a subject line");
  });
});

describe("fieldTextFallback", () => {
  it("shortens by keeping the first half of the sentences", () => {
    const out = fieldTextFallback({
      ...rosa,
      activity: "note",
      instruction: QUICK_EDITS[2].prompt,
      current: "One. Two. Three. Four.",
    });
    expect(out).toBe("One. Two.");
  });

  it("writes something addressed to the contact for an empty email", () => {
    const out = fieldTextFallback({
      ...rosa,
      activity: "email",
      instruction: "ask about the LOI timing",
      current: "",
    });
    expect(out.startsWith("Hi Rosa,")).toBe(true);
    expect(out).toContain("Ask about the LOI timing.");
  });

  it("writes a first-person recap for an empty note", () => {
    const out = fieldTextFallback({
      ...rosa,
      activity: "tour",
      instruction: "she liked the corner suite",
      current: "",
    });
    expect(out.startsWith("Spoke with Rosa.")).toBe(true);
    expect(out).toContain("tour note");
  });
});
