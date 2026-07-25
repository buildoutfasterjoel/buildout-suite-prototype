import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { useDataStore } from "#/data/dataStore";
import { useHeroOffer } from "#/ai/heroOffer";
import { useInboundEmail } from "#/components/call/useInboundEmail";
import { useBovDraft } from "#/components/call/useBovDraft";
import { useCallStore } from "#/components/call/useCallStore";
import { useAssistant } from "#/ai/useAssistant";
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
    useInboundEmail.getState().setInbound({
      dealId: "d", from: "Rosa", subject: "s", body: "b", tone: "interested",
      attachments: [], canUnderwrite: true,
    });
    useBovDraft.setState({ armedDealId: "d", draft: null } as never);
    useCallStore.setState({ heroActions: { dealId: "d" } } as never);
    useAssistant.getState().setGreeted(true);
    useHeroDemo.getState().markArcComplete();
  });

  it("re-seeds a clean dataset, clears all hero stores, and re-arms the greeting", async () => {
    await resetHeroDemo();
    expect(useHeroOffer.getState().pendingOffer).toBeNull();
    expect(useInboundEmail.getState().inbound).toBeNull();
    expect(useBovDraft.getState().armedDealId).toBeNull();
    expect(useCallStore.getState().heroActions).toBeNull();
    expect(useHeroDemo.getState().arcComplete).toBe(false);
    expect(useAssistant.getState().greetedThisSession).toBe(false);
    // re-seeded: Rosa exists again with a signal
    const rosa = [...useDataStore.getState().contacts.values()].find((c) => c.heroKey === "rosa");
    expect(rosa?.signal).toBeTruthy();
  });
});
