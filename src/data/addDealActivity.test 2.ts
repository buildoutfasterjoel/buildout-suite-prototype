import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { useDataStore } from "./dataStore";
import { generateDataset } from "./seed";
import { addDealActivity } from "./store";

describe("addDealActivity", () => {
  beforeEach(() => {
    const ds = generateDataset();
    useDataStore.setState({ listings: new Map(ds.listings.map((l) => [l.id, l])) } as never);
  });
  it("appends a DealActivity to the listing", () => {
    const id = [...useDataStore.getState().listings.values()][0].id;
    const before = useDataStore.getState().listings.get(id)!.activities.length;
    addDealActivity(id, { type: "bov", note: "Sent BOV — $5.4M–$6.0M", actor: "Ethan Thompson" });
    const after = useDataStore.getState().listings.get(id)!.activities;
    expect(after.length).toBe(before + 1);
    expect(after[after.length - 1]).toMatchObject({ type: "bov", note: "Sent BOV — $5.4M–$6.0M", actor: "Ethan Thompson" });
  });
  it("returns undefined for an unknown listing", () => {
    expect(addDealActivity("nope", { type: "x", note: "y", actor: "z" })).toBeUndefined();
  });
});
