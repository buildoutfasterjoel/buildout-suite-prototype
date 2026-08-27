import { describe, it, expect } from "vitest";
import { personaRecap } from "./heroRecapExtensions";
import { composeCallNotes, isThinRecap } from "./callNotes";
import { composeRecapReport } from "./callRecap";
import { CallRecapSpec } from "#/ai/generate/schemas";
import { callRecapFallback } from "#/ai/generate/fallbacks";

describe("personaRecap", () => {
  it("has none for a contact who isn't a persona", () => {
    expect(personaRecap(undefined)).toBeUndefined();
  });

  it("gives Rosa a schema-valid recap that is NOT thin", () => {
    const r = personaRecap("rosa")!;
    expect(CallRecapSpec.safeParse(r).success).toBe(true);
    // The whole point: it must survive the thinness test, or the substitution
    // in `callFlow.endCall` would loop back on itself.
    expect(isThinRecap(r)).toBe(false);
  });

  it("carries enough for BOTH surfaces — the logged note and the rail's card", () => {
    const r = personaRecap("rosa")!;
    const notes = composeCallNotes({ recap: r, firstName: "Rosa" });
    expect(notes).toContain("balloon note");
    expect(notes).toContain("Next steps:");

    // The bug this closes: the modal wrote three detailed sentences while the
    // rail's card said "the call felt neutral" with nothing under it.
    const report = composeRecapReport(r, "Rosa Delgado");
    expect(report.detail).toContain("balloon note");
    expect(report.detail).toContain("T-12 and rent roll");
    expect(report.tasks.length).toBeGreaterThan(0);
  });

  it("is what a thin model recap gets swapped for (the endCall rule)", () => {
    const thin = callRecapFallback([{ speaker: "you", text: "Hi" }], "Rosa");
    const chosen = isThinRecap(thin) ? (personaRecap("rosa") ?? thin) : thin;
    expect(chosen).toBe(personaRecap("rosa"));
    expect(composeRecapReport(chosen, "Rosa Delgado").detail).not.toMatch(
      /review the transcript/i,
    );
  });
});
