import { describe, it, expect, beforeEach, vi } from "vitest";
import "fake-indexeddb/auto";
import { useDataStore } from "#/data/dataStore";
import { generateDataset } from "#/data/seed";
import { useContactSession } from "#/components/contacts/useContactSession";
import { rosaClosing, ROSA_AGREEMENT_EMAIL_ID } from "./rosaClosing";
import { ROSA_SIGNED_AGREEMENT } from "./rosaDocs";

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

describe("rosaClosing arm/onArrive", () => {
  beforeEach(() => {
    hydrate();
    useContactSession.setState({ logged: {}, simEvents: {}, resolved: {}, flags: {} });
    vi.useFakeTimers();
  });

  it("files the signed agreement to the deal and posts an email row to the timeline ~6s after arm", async () => {
    const ds = useDataStore.getState();
    const rosa = [...ds.contacts.values()].find((c) => c.heroKey === "rosa")!;
    const dealId = [...ds.listings.values()][0].id;
    rosaClosing.arm(dealId, rosa.id);
    await vi.advanceTimersByTimeAsync(6_000);
    const deal = useDataStore.getState().listings.get(dealId)!;
    expect((deal.documents ?? []).some((d) => d.name === ROSA_SIGNED_AGREEMENT.name)).toBe(true);
    const events = useContactSession.getState().simEvents[rosa.id] ?? [];
    const email = events.find((e) => e.id === ROSA_AGREEMENT_EMAIL_ID);
    expect(email).toBeTruthy();
    expect(email?.actionBar?.primary).toBe("Activate Listing");
    expect(email?.attachments?.[0]?.name).toBe(ROSA_SIGNED_AGREEMENT.name);
  });

  it("completes the open listing-agreement task if present", async () => {
    const ds = useDataStore.getState();
    const rosa = [...ds.contacts.values()].find((c) => c.heroKey === "rosa")!;
    const dealId = [...ds.listings.values()][0].id;
    const deal = useDataStore.getState().listings.get(dealId)!;
    useDataStore.setState((s) => {
      const listings = new Map(s.listings);
      listings.set(dealId, {
        ...deal,
        tasks: [
          ...deal.tasks,
          { id: "task-listing-agreement", label: "Upload executed listing agreement", status: "pending" } as never,
        ],
      });
      return { listings } as never;
    });
    rosaClosing.arm(dealId, rosa.id);
    await vi.advanceTimersByTimeAsync(6_000);
    const updated = useDataStore.getState().listings.get(dealId)!;
    const task = updated.tasks.find((t) => t.label === "Upload executed listing agreement");
    expect(task?.status).toBe("complete");
  });

  it("cancel() before the timer fires drops the arrival", async () => {
    const ds = useDataStore.getState();
    const rosa = [...ds.contacts.values()].find((c) => c.heroKey === "rosa")!;
    const dealId = [...ds.listings.values()][0].id;
    rosaClosing.arm(dealId, rosa.id);
    rosaClosing.cancel();
    await vi.advanceTimersByTimeAsync(6_000);
    const deal = useDataStore.getState().listings.get(dealId)!;
    expect((deal.documents ?? []).some((d) => d.name === ROSA_SIGNED_AGREEMENT.name)).toBe(false);
    expect((useContactSession.getState().simEvents[rosa.id] ?? []).length).toBe(0);
  });
});
