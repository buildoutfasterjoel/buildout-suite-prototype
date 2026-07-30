import { describe, expect, it } from "vitest";
import {
  PERSONA_LABELS,
  PERSONA_ORDER,
  identityLine,
  readPersona,
  writePersona,
  type PersonaStore,
} from "./accountMenu";

/** Map-backed stand-in for localStorage — Vitest runs in the node env. */
function fakeStore(initial?: Record<string, string>): PersonaStore {
  const map = new Map(Object.entries(initial ?? {}));
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
  };
}

describe("persona labels", () => {
  it("labels every persona in display order", () => {
    expect(PERSONA_ORDER.map((p) => PERSONA_LABELS[p])).toEqual([
      "Principal",
      "Broker",
      "Marketing",
    ]);
  });
});

describe("readPersona", () => {
  it("defaults to principal when nothing is stored", () => {
    expect(readPersona(fakeStore())).toBe("principal");
  });

  it("returns the stored persona", () => {
    expect(readPersona(fakeStore({ dev_role: "marketing" }))).toBe("marketing");
  });

  it("falls back to principal when the stored value is not a persona", () => {
    expect(readPersona(fakeStore({ dev_role: "wizard" }))).toBe("principal");
  });

  it("falls back to principal when there is no store (SSR)", () => {
    expect(readPersona(null)).toBe("principal");
  });
});

describe("writePersona", () => {
  it("persists under the dev_role key", () => {
    const store = fakeStore();
    writePersona("broker", store);
    expect(store.getItem("dev_role")).toBe("broker");
  });

  it("is a no-op without a store", () => {
    expect(() => writePersona("broker", null)).not.toThrow();
  });
});

describe("identityLine", () => {
  it("joins the active persona and company", () => {
    expect(identityLine("marketing", "Buildout")).toBe("Marketing · Buildout");
  });

  it("shows the persona alone when there is no company", () => {
    expect(identityLine("broker")).toBe("Broker");
  });
});
