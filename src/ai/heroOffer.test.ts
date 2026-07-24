import { describe, it, expect } from "vitest";
import { matchOfferIntent, useHeroOffer } from "./heroOffer";

describe("matchOfferIntent", () => {
  it("recognises yes-intents as 'call'", () => {
    for (const t of ["yes", "Yeah", "sure", "go ahead", "do it", "let's go", "call him", "please do"]) {
      expect(matchOfferIntent(t)).toBe("call");
    }
  });
  it("recognises brief-intents as 'brief'", () => {
    for (const t of ["brief me first", "brief me", "what's the signal?", "give me more first"]) {
      expect(matchOfferIntent(t)).toBe("brief");
    }
  });
  it("returns null for anything else", () => {
    for (const t of ["who is he", "no thanks", "show my tasks", "later"]) {
      expect(matchOfferIntent(t)).toBeNull();
    }
  });
});

describe("useHeroOffer", () => {
  it("sets and clears the pending offer", () => {
    useHeroOffer.getState().setOffer({ kind: "call", contactId: "m" });
    expect(useHeroOffer.getState().pendingOffer).toEqual({ kind: "call", contactId: "m" });
    useHeroOffer.getState().clearOffer();
    expect(useHeroOffer.getState().pendingOffer).toBeNull();
  });
});
