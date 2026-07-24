import { describe, it, expect, beforeEach } from "vitest";
import { useDataStore, seedSlice } from "#/data/dataStore";
import { buildAssistantContext, serializeContext } from "./context";

beforeEach(() => { useDataStore.setState(seedSlice()); });

describe("buildAssistantContext", () => {
  it("summarizes the live store", () => {
    const ctx = buildAssistantContext();
    expect(ctx.broker.name).toBeTruthy();
    expect(ctx.pipeline.openDeals).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(ctx.contacts)).toBe(true);
  });

  it("caps the serialized size", () => {
    const s = serializeContext(buildAssistantContext(), 3072);
    expect(s.length).toBeLessThanOrEqual(3072);
  });
});
