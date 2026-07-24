import { describe, it, expect } from "vitest";
import { resolveVoiceId, AL_VOICE_ID, OWNER_VOICES, ALLOWED_VOICE_IDS } from "./ttsConfig";

describe("ttsConfig", () => {
  it("resolves a whitelisted voice id unchanged", () => {
    const known = OWNER_VOICES.female[0];
    expect(resolveVoiceId(known)).toBe(known);
  });

  it("falls back to the Al voice for an unknown id", () => {
    expect(resolveVoiceId("not-a-real-voice")).toBe(AL_VOICE_ID);
    expect(resolveVoiceId(undefined)).toBe(AL_VOICE_ID);
  });

  it("includes the Al voice and every owner voice in the whitelist", () => {
    expect(ALLOWED_VOICE_IDS.has(AL_VOICE_ID)).toBe(true);
    for (const id of [...OWNER_VOICES.female, ...OWNER_VOICES.male]) {
      expect(ALLOWED_VOICE_IDS.has(id)).toBe(true);
    }
  });
});
