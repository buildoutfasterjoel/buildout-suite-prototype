import { describe, it, expect, beforeEach, vi } from "vitest";
import "fake-indexeddb/auto";
import { useDataStore } from "#/data/dataStore";
import { generateDataset } from "#/data/seed";
import { useClosingEmail } from "./useClosingEmail";
import { rosaClosing, SIGNED_AGREEMENT_DOC } from "./rosaClosing";

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
    useClosingEmail.setState({ pending: null });
    vi.useFakeTimers();
  });

  it("files the signed agreement ~6s after arm", async () => {
    const ds = useDataStore.getState();
    const rosa = [...ds.contacts.values()].find((c) => c.heroKey === "rosa")!;
    const dealId = [...ds.listings.values()][0].id;
    rosaClosing.arm(dealId, rosa.id);
    await vi.advanceTimersByTimeAsync(6_000);
    const deal = useDataStore.getState().listings.get(dealId)!;
    expect((deal.documents ?? []).some((d) => d.name === SIGNED_AGREEMENT_DOC.name)).toBe(true);
    expect(useClosingEmail.getState().pending?.dealId).toBe(dealId);
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
    expect((deal.documents ?? []).some((d) => d.name === SIGNED_AGREEMENT_DOC.name)).toBe(false);
    expect(useClosingEmail.getState().pending).toBeNull();
  });
});
