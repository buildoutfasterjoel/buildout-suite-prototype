import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { useDataStore } from "#/data/dataStore";
import { useHeroOffer } from "#/ai/heroOffer";
import { useBovDraft } from "#/components/call/useBovDraft";
import { useCallStore } from "#/components/call/useCallStore";
import { useAssistant } from "#/ai/useAssistant";
import { useContactSession } from "#/components/contacts/useContactSession";
import { useHeroDemo, resetHeroDemo, arcCompleteText } from "./heroDemo";

describe("useHeroDemo", () => {
  it("marks and clears arc completion", () => {
    useHeroDemo.getState().markArcComplete();
    expect(useHeroDemo.getState().arcComplete).toBe(true);
    useHeroDemo.getState().clearComplete();
    expect(useHeroDemo.getState().arcComplete).toBe(false);
  });
});

describe("arcCompleteText", () => {
  it("closes the loop and offers a rerun", () => {
    const t = arcCompleteText().toLowerCase();
    expect(t).toContain("loop");
    expect(t).toContain("again");
  });
});

describe("resetHeroDemo", () => {
  beforeEach(() => {
    // seed some hero state to prove it all gets cleared
    useHeroOffer.getState().setOffer({ kind: "call", contactId: "m" });
    useContactSession.getState().addSimEvent("rosa-contact", {
      id: "sim-rosa-financials-email",
      type: "inbound-email",
      actor: { name: "Rosa" },
      direction: "in",
      timestamp: new Date().toISOString(),
      seq: 2_000_000,
      subject: "s",
      body: "b",
      source: "user",
    });
    useContactSession.getState().resolve("rosa-contact", "sim-rosa-financials-email");
    useBovDraft.setState({ armedDealId: "d", draft: null } as never);
    useCallStore.setState({ recap: { sentiment: "positive" } } as never);
    useAssistant.getState().setGreeted(true);
    useHeroDemo.getState().markArcComplete();
  });

  it("re-seeds a clean dataset, clears all hero stores, and re-arms the greeting", async () => {
    await resetHeroDemo();
    expect(useHeroOffer.getState().pendingOffer).toBeNull();
    expect(useBovDraft.getState().armedDealId).toBeNull();
    expect(useCallStore.getState().recap).toBeNull();
    expect(useHeroDemo.getState().arcComplete).toBe(false);
    expect(useAssistant.getState().greetedThisSession).toBe(false);
    // contact-session sim-events/resolved are cleared so a replay re-shows the emails
    expect(useContactSession.getState().simEvents["rosa-contact"] ?? []).toHaveLength(0);
    expect(useContactSession.getState().resolved["rosa-contact"] ?? []).toHaveLength(0);
    // re-seeded: Rosa exists again with a signal
    const rosa = [...useDataStore.getState().contacts.values()].find((c) => c.heroKey === "rosa");
    expect(rosa?.signal).toBeTruthy();
  });
});
