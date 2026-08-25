import { describe, expect, it } from "vitest";
import {
  navModeLabel,
  readNavMode,
  writeNavMode,
  type NavModeStore,
} from "./useNavMode";

/** An in-memory stand-in for localStorage. */
function fakeStore(initial?: string): NavModeStore {
  const values = new Map<string, string>();
  if (initial !== undefined) values.set("dev_nav_mode", initial);
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

describe("readNavMode", () => {
  it("defaults to the app shell with nothing stored", () => {
    expect(readNavMode(fakeStore())).toBe("app");
  });

  it("defaults to the app shell on the server, where there is no store at all", () => {
    expect(readNavMode(null)).toBe("app");
  });

  it("returns a stored mode, including the non-default one", () => {
    expect(readNavMode(fakeStore("classic"))).toBe("classic");
    expect(readNavMode(fakeStore("app"))).toBe("app");
  });

  // A stale key from an earlier prototype must not leave the shell rendering a
  // mode that no longer exists.
  it("falls back to the default on an unrecognized value", () => {
    expect(readNavMode(fakeStore("sidebar-v2"))).toBe("app");
  });
});

describe("writeNavMode", () => {
  it("round-trips through the store", () => {
    const store = fakeStore();
    writeNavMode("classic", store);
    expect(readNavMode(store)).toBe("classic");
    writeNavMode("app", store);
    expect(readNavMode(store)).toBe("app");
  });

  it("is a no-op without a store, rather than throwing during SSR", () => {
    expect(() => writeNavMode("app", null)).not.toThrow();
  });
});

describe("navModeLabel", () => {
  it("names both shapes", () => {
    expect(navModeLabel("app")).toBe("App shell");
    expect(navModeLabel("classic")).toBe("Classic nav");
  });
});
