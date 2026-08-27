import { describe, it, expect, beforeEach } from "vitest";
import { matchUnderwritingIntent, useUnderwritingOffer } from "./underwritingOffer";

describe("matchUnderwritingIntent", () => {
  it("reads a plain affirmative as yes", () => {
    for (const t of ["yes", "Yes please", "yeah", "sure", "go ahead", "do it", "sounds good"]) {
      expect(matchUnderwritingIntent(t)).toBe("yes");
    }
  });

  it("reads the domain verbs as yes", () => {
    expect(matchUnderwritingIntent("build it")).toBe("yes");
    expect(matchUnderwritingIntent("underwrite it")).toBe("yes");
  });

  it("refuses a negation even when it carries an affirmative word", () => {
    // The bug this guards: "don't underwrite it yet" matching on "underwrite".
    expect(matchUnderwritingIntent("no")).toBeNull();
    expect(matchUnderwritingIntent("not yet")).toBeNull();
    expect(matchUnderwritingIntent("don't underwrite it yet")).toBeNull();
    expect(matchUnderwritingIntent("no, skip it")).toBeNull();
  });

  it("returns null for anything that isn't an answer", () => {
    expect(matchUnderwritingIntent("")).toBeNull();
    expect(matchUnderwritingIntent("what's her phone number?")).toBeNull();
  });
});

describe("useUnderwritingOffer", () => {
  beforeEach(() => useUnderwritingOffer.getState().clearOffer());

  it("arms unasked, and a new offer re-arms the question", () => {
    const offer = { dealId: "d1", contactId: "c1", dealName: "The Delgado Building" };
    useUnderwritingOffer.getState().offer(offer);
    expect(useUnderwritingOffer.getState().asked).toBe(false);
    useUnderwritingOffer.getState().markAsked();
    expect(useUnderwritingOffer.getState().asked).toBe(true);
    // A second deal must ask again rather than inherit the first's `asked`.
    useUnderwritingOffer.getState().offer({ ...offer, dealId: "d2" });
    expect(useUnderwritingOffer.getState().asked).toBe(false);
  });

  it("clears both the offer and the asked flag", () => {
    useUnderwritingOffer.getState().offer({ dealId: "d1", contactId: "c1", dealName: "X" });
    useUnderwritingOffer.getState().markAsked();
    useUnderwritingOffer.getState().clearOffer();
    expect(useUnderwritingOffer.getState().pendingOffer).toBeNull();
    expect(useUnderwritingOffer.getState().asked).toBe(false);
  });
});
