import { describe, expect, it } from "vitest";
import {
  readRailExpanded,
  writeRailExpanded,
  type RailStore,
} from "./useRailExpanded";

/** An in-memory stand-in for localStorage. */
function fakeStore(initial?: string): RailStore {
  const values = new Map<string, string>();
  if (initial !== undefined) values.set("dev_rail_expanded", initial);
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

describe("readRailExpanded", () => {
  it("defaults to collapsed with nothing stored", () => {
    expect(readRailExpanded(fakeStore())).toBe(false);
  });

  it("defaults to collapsed on the server, where there is no store at all", () => {
    expect(readRailExpanded(null)).toBe(false);
  });

  it("returns the stored width", () => {
    expect(readRailExpanded(fakeStore("expanded"))).toBe(true);
    expect(readRailExpanded(fakeStore("collapsed"))).toBe(false);
  });

  it("falls back to collapsed on an unrecognized value", () => {
    expect(readRailExpanded(fakeStore("true"))).toBe(false);
  });
});

describe("writeRailExpanded", () => {
  it("round-trips through the store", () => {
    const store = fakeStore();
    writeRailExpanded(true, store);
    expect(readRailExpanded(store)).toBe(true);
    writeRailExpanded(false, store);
    expect(readRailExpanded(store)).toBe(false);
  });

  it("is a no-op without a store, rather than throwing during SSR", () => {
    expect(() => writeRailExpanded(true, null)).not.toThrow();
  });
});
