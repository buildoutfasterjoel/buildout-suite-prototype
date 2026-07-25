import { describe, it, expect, beforeEach, vi } from "vitest";
import "fake-indexeddb/auto";
import { useDataStore } from "#/data/dataStore";
import { generateDataset } from "#/data/seed";
import { useContactSession } from "#/components/contacts/useContactSession";
import {
  synthesizedOriginal,
  inboundSummaryText,
  heroInbound,
  ROSA_FINANCIALS_EMAIL_ID,
} from "./heroInbound";

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
    const o = synthesizedOriginal("Rosa");
    expect(o.body).toContain("Rosa");
    expect(o.body.toLowerCase()).toContain("rent roll");
    expect(o.body.toLowerCase()).toContain("t-12");
  });
});

describe("inboundSummaryText", () => {
  it("is a one-line offer that mentions the attachments and underwriting", () => {
    const s = inboundSummaryText({
      dealId: "d", from: "Rosa Delgado", subject: "s", body: "b",
      tone: "interested", attachments: ["Rent Roll", "T-12"], canUnderwrite: true,
    });
    expect(s.toLowerCase()).toContain("rosa");
    expect(s.toLowerCase()).toContain("underwrite");
  });
});

describe("heroInbound arm/onArrive", () => {
  beforeEach(() => {
    hydrate();
    useContactSession.setState({ logged: {}, simEvents: {}, resolved: {}, flags: {} });
    vi.useFakeTimers();
  });

  it("posts the financials email to the owner's contact timeline after ~10s (no deal yet)", async () => {
    const ds = useDataStore.getState();
    const rosa = [...ds.contacts.values()].find((c) => c.heroKey === "rosa")!;
    heroInbound.arm(rosa.id);
    await vi.advanceTimersByTimeAsync(10_500);
    const events = useContactSession.getState().simEvents[rosa.id] ?? [];
    const email = events.find((e) => e.id === ROSA_FINANCIALS_EMAIL_ID);
    expect(email).toBeTruthy();
    expect(email?.type).toBe("inbound-email");
    expect(email?.actionBar?.primary).toBe("Start a Deal");
    expect(email?.attachments?.length).toBe(2); // T-12 + rent roll
    expect(email?.hasAttachment).toBe(true);
    // No deal is created at arrival — the deal comes from "Start a Deal".
    expect(email?.source).toBe("user");
  });

  it("cancel() before the timer fires drops the arrival", async () => {
    const ds = useDataStore.getState();
    const rosa = [...ds.contacts.values()].find((c) => c.heroKey === "rosa")!;
    heroInbound.arm(rosa.id);
    heroInbound.cancel();
    await vi.advanceTimersByTimeAsync(10_500);
    expect((useContactSession.getState().simEvents[rosa.id] ?? []).length).toBe(0);
  });
});
