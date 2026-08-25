import { describe, expect, it } from "vitest";
import {
  readDesignTogglesShown,
  writeDesignTogglesShown,
  type DesignTogglesStore,
} from "./useDesignToggles";

/** An in-memory stand-in for localStorage. */
function fakeStore(initial?: string): DesignTogglesStore {
  const values = new Map<string, string>();
  if (initial !== undefined) values.set("dev_design_toggles", initial);
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

describe("readDesignTogglesShown", () => {
  it("is hidden with nothing stored", () => {
    expect(readDesignTogglesShown(fakeStore())).toBe(false);
  });

  it("is hidden on the server, where there is no store at all", () => {
    expect(readDesignTogglesShown(null)).toBe(false);
  });

  it("is shown only for the exact opt-in value", () => {
    expect(readDesignTogglesShown(fakeStore("show"))).toBe(true);
    expect(readDesignTogglesShown(fakeStore("hide"))).toBe(false);
  });

  // Anything unrecognized has to read as off: the failure mode of guessing wrong
  // is prototype scaffolding appearing in the corner of a demo.
  it("is hidden on an unrecognized value", () => {
    expect(readDesignTogglesShown(fakeStore("true"))).toBe(false);
    expect(readDesignTogglesShown(fakeStore(""))).toBe(false);
  });
});

describe("writeDesignTogglesShown", () => {
  it("round-trips through the store", () => {
    const store = fakeStore();
    writeDesignTogglesShown(true, store);
    expect(readDesignTogglesShown(store)).toBe(true);
    writeDesignTogglesShown(false, store);
    expect(readDesignTogglesShown(store)).toBe(false);
  });

  it("is a no-op without a store, rather than throwing during SSR", () => {
    expect(() => writeDesignTogglesShown(true, null)).not.toThrow();
  });
});
