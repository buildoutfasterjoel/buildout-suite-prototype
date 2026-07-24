import { describe, it, expect } from "vitest";
import { genderFromFirstName, ownerVoiceFor } from "./ownerVoice";
import { OWNER_VOICES } from "./ttsConfig";

describe("genderFromFirstName", () => {
  it("classifies common female names", () => {
    expect(genderFromFirstName("Sarah")).toBe("female");
    expect(genderFromFirstName("Emily")).toBe("female");
  });
  it("classifies common male names", () => {
    expect(genderFromFirstName("Marcus")).toBe("male");
    expect(genderFromFirstName("John")).toBe("male");
  });
  it("defaults unknown names to male", () => {
    expect(genderFromFirstName("Xyzzy")).toBe("male");
  });
});

describe("ownerVoiceFor", () => {
  it("returns a voice from the gendered pool", () => {
    const v = ownerVoiceFor({ id: "c1", firstName: "Sarah" });
    expect(OWNER_VOICES.female).toContain(v);
  });
  it("is stable per contact id across calls", () => {
    const a = ownerVoiceFor({ id: "c-42", firstName: "Marcus" });
    const b = ownerVoiceFor({ id: "c-42", firstName: "Marcus" });
    expect(a).toBe(b);
  });
  it("different ids can map to different voices in the pool", () => {
    const voices = new Set(
      ["a", "b", "c", "d", "e", "f", "g", "h"].map((id) =>
        ownerVoiceFor({ id, firstName: "Marcus" }),
      ),
    );
    expect(voices.size).toBeGreaterThan(1);
  });
});
