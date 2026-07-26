import { describe, it, expect, beforeEach } from "vitest";
import { useDataStore } from "#/data/dataStore";
import { generateDataset } from "#/data/seed";
import { isHeroCall } from "./heroRecapExtensions";
import type { CallTarget } from "./useCallStore";

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

const targetFor = (contactId: string, name: string): CallTarget => ({
  contactId, name, entity: "Delgado Properties LLC", phone: "555", initials: "RD",
  firstName: "Rosa", role: "owner", note: "",
});

describe("isHeroCall", () => {
  beforeEach(() => hydrate());

  it("is true for the signal owner, false otherwise", () => {
    const rosa = [...useDataStore.getState().contacts.values()].find((c) => c.heroKey === "rosa")!;
    const other = [...useDataStore.getState().contacts.values()].find((c) => c.heroKey !== "rosa" && !c.signal)!;
    expect(isHeroCall(targetFor(rosa.id, rosa.firstName))).toBe(true);
    expect(isHeroCall(targetFor(other.id, other.firstName))).toBe(false);
  });

  it("is false for a null target", () => {
    expect(isHeroCall(null)).toBe(false);
  });
});
