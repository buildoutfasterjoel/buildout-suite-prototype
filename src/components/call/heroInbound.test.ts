import { describe, it, expect, beforeEach, vi } from "vitest";
import "fake-indexeddb/auto";
import { useDataStore } from "#/data/dataStore";
import { generateDataset } from "#/data/seed";
import { useInboundEmail } from "./useInboundEmail";

// The generator is a server fn; mock it to a fixed interested reply.
vi.mock("#/ai/generate", () => ({
  generateDraftReply: vi.fn(async () => ({ tone: "interested", body: "Sending the rent roll and T-12. — Marcus" })),
}));

import { synthesizedOriginal, inboundSummaryText, heroInbound } from "./heroInbound";

function hydrate() {
  const ds = generateDataset();
  useDataStore.setState({
    properties: new Map(ds.properties.map((p) => [p.id, p])),
    listings: new Map(ds.listings.map((l) => [l.id, l])),
    contacts: new Map(ds.contacts.map((c) => [c.id, c])),
    tasks: new Map(),
  } as never);
  return ds;
}

describe("synthesizedOriginal", () => {
  it("asks for the rent roll and T-12 and names the owner", () => {
    const o = synthesizedOriginal("Marcus");
    expect(o.body).toContain("Marcus");
    expect(o.body.toLowerCase()).toContain("rent roll");
    expect(o.body.toLowerCase()).toContain("t-12");
  });
});

describe("inboundSummaryText", () => {
  it("is a one-line offer that mentions the attachments and underwriting", () => {
    const s = inboundSummaryText({
      dealId: "d", from: "Marcus Pinckney", subject: "s", body: "b",
      tone: "interested", attachments: ["Rent Roll", "T-12"], canUnderwrite: true,
    });
    expect(s.toLowerCase()).toContain("marcus");
    expect(s.toLowerCase()).toContain("underwrite");
  });
});

describe("heroInbound arm/onArrive", () => {
  beforeEach(() => {
    hydrate();
    useInboundEmail.setState({ inbound: null });
    vi.useFakeTimers();
  });

  it("files two docs + a message + sets the inbound after ~10s", async () => {
    const ds = useDataStore.getState();
    const marcus = [...ds.contacts.values()].find((c) => c.heroKey === "marcus")!;
    const dealId = [...ds.listings.values()][0].id; // any listing to file onto
    heroInbound.arm(dealId, marcus.id);
    await vi.advanceTimersByTimeAsync(10_500);
    const deal = useDataStore.getState().listings.get(dealId)!;
    expect((deal.documents ?? []).filter((d) => d.aiGenerated === false).length).toBeGreaterThanOrEqual(2);
    expect(deal.messages.length).toBeGreaterThanOrEqual(1);
    expect(useInboundEmail.getState().inbound?.dealId).toBe(dealId);
    expect(useInboundEmail.getState().inbound?.canUnderwrite).toBe(true); // Marcus's property is multifamily
  });

  it("cancel() before the timer fires drops the arrival", async () => {
    const ds = useDataStore.getState();
    const marcus = [...ds.contacts.values()].find((c) => c.heroKey === "marcus")!;
    const dealId = [...ds.listings.values()][0].id;
    heroInbound.arm(dealId, marcus.id);
    heroInbound.cancel();
    await vi.advanceTimersByTimeAsync(10_500);
    expect(useInboundEmail.getState().inbound).toBeNull();
  });
});
