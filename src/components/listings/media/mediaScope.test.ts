import { describe, it, expect } from "vitest";
import type { DealMarketing, MediaAsset } from "#/data/types";
import { assetsInScope, removeAsset } from "./mediaScope";

const asset = (over: Partial<MediaAsset>): MediaAsset => ({
  id: "x",
  url: "https://example.com/x.jpg",
  kind: "photo",
  caption: "",
  unitId: null,
  ...over,
});

const marketing = (photos: MediaAsset[]) => ({ photos }) as unknown as DealMarketing;

describe("assetsInScope", () => {
  const m = marketing([
    asset({ id: "b1", unitId: null }),
    asset({ id: "u1", unitId: "unit-1" }),
    asset({ id: "u1-plan", unitId: "unit-1", kind: "floorPlan" }),
    asset({ id: "u2", unitId: "unit-2" }),
  ]);

  it("returns a unit's own photos and never the building's", () => {
    expect(assetsInScope(m, "unit-1", "photo").map((a) => a.id)).toEqual(["u1"]);
  });

  it("filters by kind, so a floor plan never lands in the photo grid", () => {
    expect(assetsInScope(m, "unit-1", "floorPlan").map((a) => a.id)).toEqual(["u1-plan"]);
  });

  it("returns building-wide photos for a null scope", () => {
    expect(assetsInScope(m, null, "photo").map((a) => a.id)).toEqual(["b1"]);
  });

  it("ignores a building-wide floor plan, which has no section to render in", () => {
    const stray = marketing([asset({ id: "stray", kind: "floorPlan", unitId: null })]);
    expect(assetsInScope(stray, null, "photo")).toEqual([]);
  });

  it("treats absent photos as empty rather than throwing", () => {
    expect(assetsInScope({} as DealMarketing, null, "photo")).toEqual([]);
  });
});

describe("removeAsset", () => {
  it("removes by id and leaves the rest in order", () => {
    const all = [asset({ id: "a" }), asset({ id: "b" }), asset({ id: "c" })];
    expect(removeAsset(all, "b").map((a) => a.id)).toEqual(["a", "c"]);
  });

  it("is a no-op for an id that is not there", () => {
    const all = [asset({ id: "a" })];
    expect(removeAsset(all, "zzz").map((a) => a.id)).toEqual(["a"]);
  });
});
