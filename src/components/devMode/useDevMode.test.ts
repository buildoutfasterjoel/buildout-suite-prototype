import { describe, expect, it } from "vitest";
import {
  readDevModeEnabled,
  writeDevModeEnabled,
  type DevModeStore,
} from "./useDevMode";

/** An in-memory stand-in for localStorage. */
function fakeStore(initial?: string): DevModeStore {
  const values = new Map<string, string>();
  if (initial !== undefined) values.set("dev_mode", initial);
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

describe("readDevModeEnabled", () => {
  it("is off with nothing stored", () => {
    expect(readDevModeEnabled(fakeStore())).toBe(false);
  });

  it("is off on the server, where there is no store at all", () => {
    expect(readDevModeEnabled(null)).toBe(false);
  });

  it("is on only for the exact opt-in value", () => {
    expect(readDevModeEnabled(fakeStore("on"))).toBe(true);
    expect(readDevModeEnabled(fakeStore("off"))).toBe(false);
  });

  // Anything unrecognized has to read as off: the failure mode of guessing wrong
  // is dev tooling appearing in the corner of a demo.
  it("is off on an unrecognized value", () => {
    expect(readDevModeEnabled(fakeStore("true"))).toBe(false);
    expect(readDevModeEnabled(fakeStore("1"))).toBe(false);
    expect(readDevModeEnabled(fakeStore(""))).toBe(false);
  });
});

describe("writeDevModeEnabled", () => {
  it("round-trips through the store", () => {
    const store = fakeStore();
    writeDevModeEnabled(true, store);
    expect(readDevModeEnabled(store)).toBe(true);
    writeDevModeEnabled(false, store);
    expect(readDevModeEnabled(store)).toBe(false);
  });

  it("is a no-op without a store, rather than throwing during SSR", () => {
    expect(() => writeDevModeEnabled(true, null)).not.toThrow();
  });
});
