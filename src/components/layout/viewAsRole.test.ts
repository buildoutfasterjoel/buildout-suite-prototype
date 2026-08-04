import { describe, expect, it } from "vitest";
import {
  VIEW_AS_ORDER,
  identityLine,
  readViewAsRole,
  viewAsLabel,
  writeViewAsRole,
  type ViewAsStore,
} from "./viewAsRole";

/** Map-backed stand-in for localStorage — Vitest runs in the node env. */
function fakeStore(initial?: Record<string, string>): ViewAsStore {
  const map = new Map(Object.entries(initial ?? {}));
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
  };
}

describe("view-as roles", () => {
  it("offers every system role, in ROLES order", () => {
    expect(VIEW_AS_ORDER.map(viewAsLabel)).toEqual([
      "Broker",
      "Managing Director",
      "Marketing Assistant",
      "Transaction Coordinator",
      "Office Admin",
    ]);
  });
});

describe("readViewAsRole", () => {
  it("defaults to broker when nothing is stored", () => {
    expect(readViewAsRole(fakeStore())).toBe("broker");
  });

  it("returns the stored role", () => {
    expect(readViewAsRole(fakeStore({ dev_role: "managing-director" }))).toBe(
      "managing-director",
    );
  });

  it("falls back to broker when the stored value is not a role", () => {
    expect(readViewAsRole(fakeStore({ dev_role: "wizard" }))).toBe("broker");
  });

  it("falls back to broker when the stored value is an inherited object key", () => {
    expect(readViewAsRole(fakeStore({ dev_role: "toString" }))).toBe("broker");
  });

  it("falls back to broker when there is no store (SSR)", () => {
    expect(readViewAsRole(null)).toBe("broker");
  });
});

describe("writeViewAsRole", () => {
  it("persists under the dev_role key", () => {
    const store = fakeStore();
    writeViewAsRole("managing-director", store);
    expect(store.getItem("dev_role")).toBe("managing-director");
  });

  it("round-trips through readViewAsRole", () => {
    const store = fakeStore();
    writeViewAsRole("transaction-coordinator", store);
    expect(readViewAsRole(store)).toBe("transaction-coordinator");
  });

  it("is a no-op without a store", () => {
    expect(() => writeViewAsRole("broker", null)).not.toThrow();
  });
});

describe("identityLine", () => {
  it("joins the active role and company", () => {
    expect(identityLine("managing-director", "Buildout")).toBe(
      "Managing Director · Buildout",
    );
  });

  it("shows the role alone when there is no company", () => {
    expect(identityLine("broker")).toBe("Broker");
  });
});
