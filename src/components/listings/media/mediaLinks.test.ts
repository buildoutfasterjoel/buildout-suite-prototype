import { describe, it, expect } from "vitest";
import type { MediaLink } from "#/data/types";
import { LINK_KINDS, linkInScope, upsertLink } from "./mediaLinks";

const link = (over: Partial<MediaLink>): MediaLink => ({
  id: "x",
  url: "https://example.com/x",
  kind: "video",
  unitId: null,
  ...over,
});

describe("LINK_KINDS", () => {
  it("names exactly the three destinations, in display order", () => {
    expect(LINK_KINDS.map((k) => k.kind)).toEqual(["video", "matterport", "virtualTour"]);
  });
});

describe("linkInScope", () => {
  const all = [
    link({ id: "b-video", kind: "video", unitId: null }),
    link({ id: "u-video", kind: "video", unitId: "unit-1" }),
    link({ id: "u-mp", kind: "matterport", unitId: "unit-1" }),
    // Building-wide but absent from unit-1: without this, "does not fall back"
    // below would pass whether or not a fallback existed, since there would be
    // nothing for a fallback to find either.
    link({ id: "b-tour", kind: "virtualTour", unitId: null }),
  ];

  it("finds the one link of a kind in a unit's scope", () => {
    expect(linkInScope(all, "video", "unit-1")?.id).toBe("u-video");
  });

  it("does not fall back to the building's link for a unit", () => {
    // Links are single-value per scope. Falling back would make a suite look like
    // it has its own video when it is showing the building's.
    expect(linkInScope(all, "virtualTour", "unit-1")).toBeUndefined();
  });

  it("finds a building-wide link for a null scope", () => {
    expect(linkInScope(all, "video", null)?.id).toBe("b-video");
  });
});

describe("upsertLink", () => {
  it("adds a link when the scope has none of that kind", () => {
    const next = upsertLink([], "video", "unit-1", "https://v/1");
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ kind: "video", unitId: "unit-1", url: "https://v/1" });
  });

  it("updates in place rather than adding a second of the same kind", () => {
    // The UI renders one row per kind, so two records of a kind in one scope would
    // make the second unreachable and silently authoritative-or-not.
    const all = [link({ id: "keep", kind: "video", unitId: "unit-1", url: "old" })];
    const next = upsertLink(all, "video", "unit-1", "new");
    expect(next).toHaveLength(1);
    expect(next[0].url).toBe("new");
    expect(next[0].id).toBe("keep");
  });

  it("removes the record when the url is cleared", () => {
    const all = [link({ id: "gone", kind: "video", unitId: "unit-1" })];
    expect(upsertLink(all, "video", "unit-1", "")).toEqual([]);
  });

  it("treats whitespace as cleared", () => {
    const all = [link({ id: "gone", kind: "video", unitId: "unit-1" })];
    expect(upsertLink(all, "video", "unit-1", "   ")).toEqual([]);
  });

  it("is a no-op when clearing a kind that was never set", () => {
    expect(upsertLink([], "video", "unit-1", "")).toEqual([]);
  });

  it("leaves other kinds and other scopes alone", () => {
    const all = [
      link({ id: "b-video", kind: "video", unitId: null }),
      link({ id: "u-mp", kind: "matterport", unitId: "unit-1" }),
    ];
    const next = upsertLink(all, "video", "unit-1", "https://v/new");
    expect(next.map((l) => l.id).sort()).toEqual(["b-video", "u-mp", "unit-1-video"].sort());
  });

  it("does not mutate the input", () => {
    const all = [link({ id: "a", kind: "video", unitId: null })];
    upsertLink(all, "video", null, "changed");
    expect(all[0].url).toBe("https://example.com/x");
  });
});
