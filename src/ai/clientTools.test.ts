import { describe, it, expect, beforeEach } from "vitest";
import { useDataStore, seedSlice } from "#/data/dataStore";
import { resolveContactByName } from "./tools";

beforeEach(() => { useDataStore.setState(seedSlice()); });

describe("resolveContactByName", () => {
  it("resolves a full name to a contact", () => {
    const first = [...useDataStore.getState().contacts.values()][0];
    const full = `${first.firstName} ${first.lastName}`.trim();
    expect(resolveContactByName(full)?.id).toBe(first.id);
  });
  it("returns null for an unknown name", () => {
    expect(resolveContactByName("Zzz Nobody")).toBeNull();
  });
});
